import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

/** Append-only record of who received a handoff and when. */
@Entity("acknowledgments")
export class Acknowledgment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "handoff_id", type: "uuid" })
  handoffId: string;

  @Column({ name: "acknowledged_by", type: "uuid" })
  acknowledgedBy: string;

  @Column({ type: "jsonb" })
  hlc: { counter: number; deviceId: string; wallClockHint: string };

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;
}