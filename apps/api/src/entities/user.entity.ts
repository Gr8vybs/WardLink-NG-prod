import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;

  // Staff ID used to log in (e.g. "NCH-2291"), not an email — matches how
  // staff actually identify themselves on the ward.
  @Column({ name: "staff_id", unique: true })
  staffId: string;

  @Column()
  role: "nurse" | "doctor" | "ward_head" | "director";

  // bcryptjs hash. Used for individual login.
  @Column({ name: "password_hash" })
  passwordHash: string;

  // bcryptjs hash of a 4-digit PIN. Used for per-action re-auth on shared
  // ward devices — never for individual login on a personal device.
  @Column({ name: "pin_hash", type: "text", nullable: true })
  pinHash: string | null;

  @Column({ default: true })
  active: boolean;
}