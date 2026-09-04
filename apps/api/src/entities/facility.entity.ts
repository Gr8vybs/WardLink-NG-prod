import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("facilities")
export class Facility {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  type: "PHC" | "hospital" | "teaching_hospital";

  @Column({ name: "ndpr_compliance_contact" })
  ndprComplianceContact: string;
}