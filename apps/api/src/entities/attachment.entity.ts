import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("attachments")
export class Attachment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "patient_id", type: "uuid" })
  patientId: string;

  @Column({ name: "uploaded_by", type: "uuid" })
  uploadedBy: string;

  @Column({ type: "jsonb" })
  hlc: { counter: number; deviceId: string; wallClockHint: string };

  @Column({ name: "file_ref", type: "text", nullable: true })
  fileRef: string | null;

  @Column({ name: "mime_type" })
  mimeType: string;

  @Column({ name: "upload_status", default: "queued" })
  uploadStatus: "queued" | "uploading" | "synced" | "failed";

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;
}