import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("handoffs")
export class Handoff {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "patient_id", type: "uuid" })
  patientId: string;

  @Column({ name: "ward_id", type: "uuid" })
  wardId: string;

  @Column({ name: "author_id", type: "uuid" })
  authorId: string;

  @Column({ name: "device_id", type: "uuid" })
  deviceId: string;

  @Column({ name: "shift_period" })
  shiftPeriod: string;

  @Column({ default: "open" })
  status: "open" | "acknowledged";

  @Column({ type: "jsonb" })
  hlc: { counter: number; deviceId: string; wallClockHint: string };

  // Tenant-scoping column, denormalized from ward -> facility for fast RLS checks.
  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;
}
