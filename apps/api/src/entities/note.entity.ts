import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

/** Append-only. Never edited. Patient-scoped (not handoff-scoped) — a
 * running feed that spans shifts, matching the mockup's notes feed. */
@Entity("notes")
export class Note {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "patient_id", type: "uuid" })
  patientId: string;

  @Column({ name: "author_id", type: "uuid" })
  authorId: string;

  @Column({ type: "jsonb" })
  hlc: { counter: number; deviceId: string; wallClockHint: string };

  @Column({ type: "text" })
  text: string;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;
}