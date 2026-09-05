import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("conflicts")
export class Conflict {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "field_id", type: "uuid" })
  fieldId: string;

  @Column({ name: "competing_op_ids", type: "uuid", array: true })
  competingOpIds: string[];

  @Column({ default: "open" })
  status: "open" | "escalated" | "resolved";

  @Column({ name: "opened_at", type: "timestamptz", default: () => "now()" })
  openedAt: Date;

  @Column({ name: "escalated_at", type: "timestamptz", nullable: true })
  escalatedAt: Date | null;

  @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
  resolvedAt: Date | null;

  @Column({ name: "resolved_by", type: "uuid", nullable: true })
  resolvedBy: string | null;

  @Column({ name: "resolution_value", type: "text", nullable: true })
  resolutionValue: string | null;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;
}