import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { StructuredField } from "../entities/structured-field.entity";
import { FieldOp } from "../entities/field-op.entity";
import { Conflict } from "../entities/conflict.entity";
import { withFacilityContext } from "../common/tenant-context";
import { compareHlc, hlcEquals } from "./hlc.util";
import { FieldOpInputDto } from "./dto/push-sync.dto";

export interface SyncResult {
  patientId: string;
  fieldType: string;
  status: "applied" | "conflict";
  currentValue: string;
  currentHlc: unknown;
  conflictId?: string;
}

@Injectable()
export class SyncMergeService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Applies one device's batch of FieldOps. Every op is appended to the
   * op log unconditionally (never rejected, never edited) — that's the
   * audit trail. Whether it also updates the field's "current" value, or
   * gets flagged as a conflict instead, depends on whether the device's
   * baseHlc still matches the field's actual current HLC:
   *
   *  - No existing field yet          -> first write, always clean.
   *  - baseHlc matches current HLC    -> device had the latest data,
   *                                       clean update.
   *  - baseHlc does NOT match         -> someone else changed this field
   *                                       after this device last saw it.
   *                                       Genuine conflict: both writes
   *                                       are preserved, a Conflict
   *                                       record is opened, and the
   *                                       field's current value is set
   *                                       by HLC tiebreak so the app
   *                                       keeps working — but the
   *                                       conflict stays visible until
   *                                       someone resolves it.
   */
  async push(facilityId: string, authorId: string, ops: FieldOpInputDto[]): Promise<SyncResult[]> {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const fieldRepo = qr.manager.getRepository(StructuredField);
      const fieldOpRepo = qr.manager.getRepository(FieldOp);
      const conflictRepo = qr.manager.getRepository(Conflict);
      const results: SyncResult[] = [];

      // Sequential on purpose, not Promise.all — ops may target the same
      // field within one batch, and each must see the previous one's
      // effect to merge correctly.
      for (const op of ops) {
        let field = await fieldRepo.findOne({
          where: { patientId: op.patientId, fieldType: op.fieldType },
        });

        if (!field) {
          field = await fieldRepo.save({
            patientId: op.patientId,
            fieldType: op.fieldType,
            currentValue: op.value,
            currentHlc: op.hlc,
            currentAuthorId: authorId,
            facilityId,
          });
          await fieldOpRepo.save({
            fieldId: field.id,
            value: op.value,
            hlc: op.hlc,
            baseHlc: null,
            authorId,
            deviceId: op.hlc.deviceId,
            facilityId,
          });
          results.push({
            patientId: op.patientId,
            fieldType: op.fieldType,
            status: "applied",
            currentValue: field.currentValue,
            currentHlc: field.currentHlc,
          });
          continue;
        }

        // Capture the field's state BEFORE this op touches it — this is
        // what we're comparing the incoming baseHlc against.
        const priorHlc = field.currentHlc;
        const cleanUpdate = hlcEquals(op.baseHlc, priorHlc);

        const savedOp = await fieldOpRepo.save({
          fieldId: field.id,
          value: op.value,
          hlc: op.hlc,
          baseHlc: op.baseHlc,
          authorId,
          deviceId: op.hlc.deviceId,
          facilityId,
        });

        if (cleanUpdate) {
          field.currentValue = op.value;
          field.currentHlc = op.hlc;
          field.currentAuthorId = authorId;
          await fieldRepo.save(field);
          results.push({
            patientId: op.patientId,
            fieldType: op.fieldType,
            status: "applied",
            currentValue: field.currentValue,
            currentHlc: field.currentHlc,
          });
          continue;
        }

        // Conflict: this device edited the field without having seen
        // its actual current value. Keep the app usable by picking a
        // winner via HLC tiebreak, but open a Conflict so it stays
        // visible until a human resolves it — never silently drop
        // either write (both are already preserved in field_ops
        // regardless of this choice).
        const incomingWins = compareHlc(op.hlc, priorHlc) > 0;
        if (incomingWins) {
          field.currentValue = op.value;
          field.currentHlc = op.hlc;
          field.currentAuthorId = authorId;
          await fieldRepo.save(field);
        }

        const recentOps = await fieldOpRepo.find({
          where: { fieldId: field.id },
          order: { createdAt: "DESC" },
          take: 2, // [0] is the one we just inserted, [1] is the one before it
        });
        const priorOp = recentOps[1] ?? null;

        const conflict = await conflictRepo.save({
          fieldId: field.id,
          competingOpIds: priorOp ? [priorOp.id, savedOp.id] : [savedOp.id],
          status: "open",
          facilityId,
        });

        results.push({
          patientId: op.patientId,
          fieldType: op.fieldType,
          status: "conflict",
          currentValue: field.currentValue,
          currentHlc: field.currentHlc,
          conflictId: conflict.id,
        });
      }

      return results;
    });
  }

  /**
   * Returns the current state of every structured field for the given
   * patients — how a device catches up after being offline. Simplified
   * to "pull full current state" rather than incremental op-log-since-
   * a-cursor sync; a real production version would page this and return
   * only what changed since the device's last sync token.
   */
  async pull(facilityId: string, patientIds: string[]) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(StructuredField).find({
        where: patientIds.map((patientId) => ({ patientId })),
      }),
    );
  }
}