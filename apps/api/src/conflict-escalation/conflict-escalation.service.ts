import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DataSource } from "typeorm";
import { Conflict } from "../entities/conflict.entity";
import { FieldOp } from "../entities/field-op.entity";
import { StructuredField } from "../entities/structured-field.entity";
import { withFacilityContext } from "../common/tenant-context";
import { NotificationService } from "../notification/notification.service";
import type { HLC } from "@wardlink/shared";

@Injectable()
export class ConflictEscalationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  async listOpen(facilityId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Conflict).find({
        where: [{ status: "open" }, { status: "escalated" }],
        order: { openedAt: "ASC" },
      }),
    );
  }

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
        baseHlc: field.currentHlc,
        authorId: resolvedBy,
        deviceId: resolvedBy,
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

  /**
   * Finds every conflict still 'open' past the threshold, across ALL
   * facilities, and marks it 'escalated'. Also creates a Notification
   * for every ward_head/director in each affected facility.
   */
  async runAgingSweep(thresholdMinutes?: number): Promise<Array<{ id: string; facility_id: string; field_id: string }>> {
    const threshold = thresholdMinutes ?? Number(process.env.ESCALATION_THRESHOLD_MINUTES ?? 30);
    const escalated: Array<{ id: string; facility_id: string; field_id: string }> = await this.dataSource.query(
      `SELECT * FROM escalate_aging_conflicts($1)`,
      [threshold],
    );

    const byFacility = new Map<string, Array<{ id: string; field_id: string }>>();
    for (const row of escalated) {
      const list = byFacility.get(row.facility_id) ?? [];
      list.push({ id: row.id, field_id: row.field_id });
      byFacility.set(row.facility_id, list);
    }

    for (const [facilityId, conflicts] of byFacility) {
      const recipients = await this.notificationService.findEscalationRecipients(facilityId);
      for (const recipientId of recipients) {
        for (const conflict of conflicts) {
          await this.notificationService.create(facilityId, recipientId, "conflict_escalated", {
            conflictId: conflict.id,
            fieldId: conflict.field_id,
          });
        }
      }
    }

    return escalated;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  private async handleScheduledSweep() {
    await this.runAgingSweep();
  }
}