import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("devices")
export class Device {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "facility_id", type: "uuid" })
  facilityId: string;

  @Column({ name: "ward_id", type: "uuid" })
  wardId: string;

  @Column({ name: "device_type" })
  deviceType: "shared_ward_device" | "personal";

  @Column({ name: "device_name" })
  deviceName: string; // e.g. "Ward 4B - Device 02"
}