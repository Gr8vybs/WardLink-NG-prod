import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("patients")
export class Patient {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "jsonb" })
  demographics: { name: string; age: number; sex: string; allergies: string };

  @Column({ name: "facility_of_origin_id", type: "uuid" })
  facilityOfOriginId: string;

  // The tenant-scoping column every RLS policy filters on.
  @Column({ name: "current_facility_id", type: "uuid" })
  currentFacilityId: string;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt: Date;

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy: string | null;
}
