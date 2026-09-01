import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Creates the core tables (Patient, Handoff, StructuredField, FieldOp) and
 * enables Row-Level Security on each, scoped by facility_id.
 *
 * RLS is the single most important isolation control in the shared-backend
 * multi-tenancy design: even if application code has a bug and forgets a
 * WHERE clause, the database itself will not return rows outside the
 * current session's facility.
 *
 * The app is expected to run `SET app.current_facility_id = '<uuid>'` at
 * the start of each request (via a middleware/interceptor using the
 * caller's JWT facility claim) before touching these tables.
 */
export class InitCoreTablesWithRLS1735600000000 implements MigrationInterface {
  name = "InitCoreTablesWithRLS1735600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE patients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        demographics jsonb NOT NULL,
        facility_of_origin_id uuid NOT NULL,
        current_facility_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE handoffs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patients(id),
        ward_id uuid NOT NULL,
        author_id uuid NOT NULL,
        device_id uuid NOT NULL,
        shift_period text NOT NULL,
        status text NOT NULL DEFAULT 'open',
        hlc jsonb NOT NULL,
        facility_id uuid NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE structured_fields (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patients(id),
        field_type text NOT NULL,
        current_value text NOT NULL,
        current_hlc jsonb NOT NULL,
        current_author_id uuid NOT NULL,
        facility_id uuid NOT NULL
      );
    `);

    // Append-only op log — source of truth for conflict detection & audit.
    await queryRunner.query(`
      CREATE TABLE field_ops (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        field_id uuid NOT NULL REFERENCES structured_fields(id),
        value text NOT NULL,
        hlc jsonb NOT NULL,
        author_id uuid NOT NULL,
        device_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        facility_id uuid NOT NULL
      );
    `);

    // Indexes for the two hot paths: conflict lookups and patient history reads.
    await queryRunner.query(`CREATE INDEX idx_field_ops_field_hlc ON field_ops (field_id, created_at);`);
    await queryRunner.query(`CREATE INDEX idx_handoffs_patient_time ON handoffs (patient_id, shift_period);`);
    await queryRunner.query(`CREATE INDEX idx_patients_facility ON patients (current_facility_id);`);

    // --- Row-Level Security ---
    for (const table of ["patients", "handoffs", "structured_fields", "field_ops"]) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
    }

    // patients uses current_facility_id; the others use the denormalized facility_id column.
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_patients ON patients
      USING (current_facility_id = current_setting('app.current_facility_id')::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_handoffs ON handoffs
      USING (facility_id = current_setting('app.current_facility_id')::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_structured_fields ON structured_fields
      USING (facility_id = current_setting('app.current_facility_id')::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_field_ops ON field_ops
      USING (facility_id = current_setting('app.current_facility_id')::uuid);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS field_ops;`);
    await queryRunner.query(`DROP TABLE IF EXISTS structured_fields;`);
    await queryRunner.query(`DROP TABLE IF EXISTS handoffs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS patients;`);
  }
}
