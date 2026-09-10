import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("referrals")
export class Referral {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "patient_id", type: "uuid" })
  patientId: string;

  @Column({ name: "origin_facility_id", type: "uuid" })
  originFacilityId: string;

  @Column({ name: "dest_facility_id", type: "uuid" })
  destFacilityId: string;

  @Column({ name: "snapshot_ref", type: "text" })
  snapshotRef: string;

  @Column({ default: "sent" })
  status: "sent" | "claimed";

  @Column({ name: "sent_by", type: "uuid" })
  sentBy: string;

  @Column({ name: "claimed_by", type: "uuid", nullable: true })
  claimedBy: string | null;

  @Column({ name: "sent_at", type: "timestamptz", default: () => "now()" })
  sentAt: Date;

  @Column({ name: "claimed_at", type: "timestamptz", nullable: true })
  claimedAt: Date | null;
}