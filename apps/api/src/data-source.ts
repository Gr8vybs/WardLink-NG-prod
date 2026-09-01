import "reflect-metadata";
import { DataSource } from "typeorm";
import { Patient } from "./entities/patient.entity";
import { Handoff } from "./entities/handoff.entity";
import { StructuredField } from "./entities/structured-field.entity";
import { FieldOp } from "./entities/field-op.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  // Migrations need elevated privileges (CREATE TABLE/ROLE/POLICY), so
  // this intentionally uses the admin credentials, not the runtime
  // DB_USERNAME/DB_PASSWORD the app connects with in app.module.ts.
  username: process.env.ADMIN_DB_USERNAME ?? "postgres",
  password: process.env.ADMIN_DB_PASSWORD ?? "postgres",
  database: process.env.DB_NAME ?? "wardlink_ng",
  entities: [Patient, Handoff, StructuredField, FieldOp],
  migrations: ["src/migrations/*.ts"],
});
