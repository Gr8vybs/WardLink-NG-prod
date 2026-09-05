import "reflect-metadata";
import { DataSource } from "typeorm";
import { Patient } from "./entities/patient.entity";
import { Handoff } from "./entities/handoff.entity";
import { StructuredField } from "./entities/structured-field.entity";
import { FieldOp } from "./entities/field-op.entity";
import { Conflict } from "./entities/conflict.entity";
import { User } from "./entities/user.entity";
import { Device } from "./entities/device.entity";
import { Facility } from "./entities/facility.entity";
import { Ward } from "./entities/ward.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.ADMIN_DB_USERNAME ?? "postgres",
  password: process.env.ADMIN_DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? "wardlink_ng",
  entities: [Patient, Handoff, StructuredField, FieldOp, User, Device, Facility, Ward, Conflict],
  migrations: ["src/migrations/*.ts"],
});