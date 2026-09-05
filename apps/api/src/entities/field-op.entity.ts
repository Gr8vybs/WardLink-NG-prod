import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

/** Append-only. Rows here are never updated or deleted — this is the
 * source of truth for conflict detection and the audit trail. */
@Entity("field_ops")
export class FieldOp {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "field_id", type: "uuid" })
  fieldId: string;

  @Column({ type: "text" })
  value: string;

  @Column({ type: "jsonb" })
  hlc: { counter: number; deviceId: string; wallClockHint: string };

  @Column({ name: "base_hlc", type: "jsonb", nullable: true })
  baseHlc: { counter: number; deviceId: string; wallClockHint: string } | null;

  @Column({ name: "author_id", type: "uuid" })
  authorId: string;

  @Column({ name: "device_id", type: "uuid" })
  deviceId: string;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;
}
