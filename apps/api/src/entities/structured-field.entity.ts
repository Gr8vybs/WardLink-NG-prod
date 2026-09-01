import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("structured_fields")
export class StructuredField {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "patient_id", type: "uuid" })
  patientId: string;

  @Column({ name: "field_type" })
  fieldType: "vitals" | "meds" | "allergies" | "codeStatus";

  @Column({ name: "current_value", type: "text" })
  currentValue: string;

  @Column({ name: "current_hlc", type: "jsonb" })
  currentHlc: { counter: number; deviceId: string; wallClockHint: string };

  @Column({ name: "current_author_id", type: "uuid" })
  currentAuthorId: string;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;
}
