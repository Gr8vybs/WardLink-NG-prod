import { Injectable } from "@nestjs/common";
import { DataSource, IsNull } from "typeorm";
import { Notification } from "../entities/notification.entity";
import { withFacilityContext } from "../common/tenant-context";

@Injectable()
export class NotificationService {
  constructor(private readonly dataSource: DataSource) {}

  async create(
    facilityId: string,
    recipientId: string,
    type: Notification["type"],
    payload: Record<string, unknown>,
  ) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Notification).save({
        facilityId,
        recipientId,
        type,
        payload,
      }),
    );
  }

  async listUnread(facilityId: string, recipientId: string) {
    return withFacilityContext(this.dataSource, facilityId, (qr) =>
      qr.manager.getRepository(Notification).find({
        where: { recipientId, readAt: IsNull() },
        order: { createdAt: "DESC" },
      }),
    );
  }

  async markRead(facilityId: string, id: string) {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const repo = qr.manager.getRepository(Notification);
      const notification = await repo.findOne({ where: { id } });
      if (!notification) return null;
      notification.readAt = new Date();
      return repo.save(notification);
    });
  }

  /** Finds ward_head/director users in a facility — used by the
   * escalation sweep, which discovers WHICH facilities had a conflict
   * escalate but not WHO in that facility should hear about it. */
  async findEscalationRecipients(facilityId: string): Promise<string[]> {
    return withFacilityContext(this.dataSource, facilityId, async (qr) => {
      const rows: Array<{ id: string }> = await qr.query(
        `SELECT id FROM users WHERE role IN ('ward_head', 'director') AND active = true`,
      );
      return rows.map((r) => r.id);
    });
  }
}