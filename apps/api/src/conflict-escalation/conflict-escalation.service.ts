import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Conflict } from "../entities/conflict.entity";
import { FieldOp } from "../entities/field-op.entity";
import { StructuredField } from "../entities/structured-field.entity";
import { withFacilityContext } from "../common/tenant-context";
import type { HLC } from "@wardlink/shared";

@Injectable()
export class ConflictEscalationService {
  constructor(private readonly dataSource: DataSource) {}

  /** Open conflicts for this facility — what a ward head's queue reads
   * from. Escalated ones surface here too; resolved ones don't, since
   * they no longer need anyone's attention. */
  async listOpen(facilityId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Conflict).find({
        where: [{ status: "open" }, { status: "escalated" }],
        order: { openedAt: "ASC" },
      }),
    );
  }

  /** Detail view: the conflict record plus the actual competing writes,
   * so the resolver can see both values side by side. */
  async getDetail(facilityId: string, conflictId: string) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const conflict = await qr.manager.getRepository(Conflict).findOne({ where: { id: conflictId } });
      if (!conflict) throw new NotFoundException("Conflict not found");

      const competingOps = await qr.manager.getRepository(FieldOp).find({
        where: conflict.competingOpIds.map((id) => ({ id })),
      });

      return { conflict, competingOps };
    });
  }

  /**
   * Resolving a conflict is itself an attributed write — it becomes a new
   * FieldOp, authored by whoever resolved it, not a silent edit to the
   * field's current value. The server mints the HLC for this op (rather
   * than a client supplying one) because resolution inherently requires
   * having just read the field's true current state — there's no
   * meaningful "based on stale data" case here the way there is for a
   * normal device write.
   */
  async resolve(facilityId: string, conflictId: string, resolvedBy: string, resolutionValue: string) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const conflictRepo = qr.manager.getRepository(Conflict);
      const fieldRepo = qr.manager.getRepository(StructuredField);
      const fieldOpRepo = qr.manager.getRepository(FieldOp);

      const conflict = await conflictRepo.findOne({ where: { id: conflictId } });
      if (!conflict) throw new NotFoundException("Conflict not found");
      if (conflict.status === "resolved") {
        throw new BadRequestException("This conflict has already been resolved");
      }

      const field = await fieldRepo.findOne({ where: { id: conflict.fieldId } });
      if (!field) throw new NotFoundException("Field not found for this conflict");

      const resolutionHlc: HLC = {
        counter: field.currentHlc.counter + 1,
        deviceId: `resolution:${resolvedBy}`,
        wallClockHint: new Date().toISOString(),
      };

      await fieldOpRepo.save({
        fieldId: field.id,
        value: resolutionValue,
        hlc: resolutionHlc,
        baseHlc: field.currentHlc, // always "clean" — resolution reads current state first
        authorId: resolvedBy,
        deviceId: resolvedBy, // no real "device" for a server-side resolution; the resolving user's own id stands in, since device_id is a uuid column
        facilityId,
      });

      field.currentValue = resolutionValue;
      field.currentHlc = resolutionHlc;
      field.currentAuthorId = resolvedBy;
      await fieldRepo.save(field);

      conflict.status = "resolved";
      conflict.resolvedAt = new Date();
      conflict.resolvedBy = resolvedBy;
      conflict.resolutionValue = resolutionValue;
      await conflictRepo.save(conflict);

      return { conflict, field };
    });
  }
}