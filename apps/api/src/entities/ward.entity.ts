import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("wards")
export class Ward {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;

  @Column()
  name: string;

  @Column({ name: "acuity_level", default: "standard" })
  acuityLevel: "standard" | "high_acuity";
}