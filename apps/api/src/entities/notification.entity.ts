import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;

  @Column({ name: "recipient_id", type: "uuid" })
  recipientId: string;

  @Column()
  type: "conflict_escalated" | "referral_received";

  @Column({ type: "jsonb" })
  payload: Record<string, unknown>;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt: Date | null;
}