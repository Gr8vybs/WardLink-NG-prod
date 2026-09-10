import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Referral } from "../entities/referral.entity";
import { Patient } from "../entities/patient.entity";
import { StructuredField } from "../entities/structured-field.entity";
import { CreateReferralDto } from "./dto/create-referral.dto";
import { withFacilityContext } from "../common/tenant-context";

interface Snapshot {
  demographics: { name: string; age: number; sex: string; allergies: string };
  structuredFields: Array<{ fieldType: string; value: string }>;
  reason: string;
  capturedAt: string;
}

@Injectable()
export class ReferralService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Sends a referral: captures a frozen snapshot of the patient's
   * demographics and current structured fields RIGHT NOW, serialized
   * into snapshotRef. The receiving facility will only ever see this
   * snapshot, never a live view into the origin's ongoing data — that's
   * what makes a referral safe to send across a tenant boundary.
   */
  async send(originFacilityId: string, sentBy: string, dto: CreateReferralDto) {
    return withFacilityContext(this.dataSource, originFacilityId, async (qr) => {
      const patient = await qr.manager.getRepository(Patient).findOne({ where: { id: dto.patientId } });
      if (!patient) throw new NotFoundException("Patient not found");

      const fields = await qr.manager.getRepository(StructuredField).find({ where: { patientId: dto.patientId } });

      const snapshot: Snapshot = {
        demographics: patient.demographics,
        structuredFields: fields.map((f) => ({ fieldType: f.fieldType, value: f.currentValue })),
        reason: dto.reason,
        capturedAt: new Date().toISOString(),
      };

      return qr.manager.getRepository(Referral).save({
        patientId: dto.patientId,
        originFacilityId,
        destFacilityId: dto.destFacilityId,
        snapshotRef: JSON.stringify(snapshot),
        status: "sent",
        sentBy,
      });
    });
  }

  async listOutgoing(facilityId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Referral).find({ where: { originFacilityId: facilityId } }),
    );
  }

  async listIncoming(facilityId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Referral).find({ where: { destFacilityId: facilityId } }),
    );
  }

  /**
   * Claiming NEVER merges into an existing patient record — it always
   * creates a brand-new Patient row in the destination facility, with
   * facilityOfOriginId preserving where it actually came from.
   *
   * IMPORTANT: the actual claim is done via a raw UPDATE ... RETURNING,
   * not repo.save(). This table's SELECT and UPDATE RLS policies are
   * deliberately different (either side can read, only the destination
   * can update) — and TypeORM's repo.save() does not check whether an
   * UPDATE actually affected a row. If RLS silently filters it to zero
   * rows, repo.save() would resolve successfully anyway using whatever
   * was already in memory, incorrectly reporting success. Checking the
   * actual row count explicitly, before creating anything, closes that.
   *
   * Also note: queryRunner.query() returns a [rows, affectedCount] tuple
   * for non-SELECT statements, not just the rows array — destructure it
   * explicitly rather than treating the whole result as the rows array.
   */
  async claim(destFacilityId: string, claimedBy: string, referralId: string) {
    return withFacilityContext(this.dataSource, destFacilityId, async (qr) => {
      const referralRepo = qr.manager.getRepository(Referral);
      const existing = await referralRepo.findOne({ where: { id: referralId } });
      if (!existing) throw new NotFoundException("Referral not found");
      if (existing.status === "claimed") {
        throw new BadRequestException("This referral has already been claimed");
      }

      const [rows]: [Array<{ id: string; snapshot_ref: string; origin_facility_id: string }>, number] = await qr.query(
        `UPDATE referrals
         SET status = 'claimed', claimed_by = $1, claimed_at = now()
         WHERE id = $2 AND status != 'claimed'
         RETURNING id, snapshot_ref, origin_facility_id`,
        [claimedBy, referralId],
      );

      if (rows.length === 0) {
        throw new ForbiddenException("Only the receiving facility can claim this referral");
      }

      const referral = rows[0];
      const snapshot: Snapshot = JSON.parse(referral.snapshot_ref);

      const newPatient = await qr.manager.getRepository(Patient).save({
        demographics: snapshot.demographics,
        facilityOfOriginId: referral.origin_facility_id,
        currentFacilityId: destFacilityId,
        createdBy: claimedBy,
      });

      return { referralId: referral.id, newPatient };
    });
  }
}