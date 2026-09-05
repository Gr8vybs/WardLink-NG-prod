import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSyncMergeSupport1735600500000 implements MigrationInterface {
  name = "AddSyncMergeSupport1735600500000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE field_ops ADD COLUMN base_hlc jsonb;`);

    // Exactly one "current state" row per (patient, field type) — this is
    // what SyncMergeService finds-or-creates against.
    await queryRunner.query(`
      ALTER TABLE structured_fields
      ADD CONSTRAINT unique_patient_field UNIQUE (patient_id, field_type);
    `);

    await queryRunner.query(`
      CREATE TABLE conflicts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        field_id uuid NOT NULL REFERENCES structured_fields(id),
        competing_op_ids uuid[] NOT NULL,
        status text NOT NULL DEFAULT 'open',
        opened_at timestamptz NOT NULL DEFAULT now(),
        escalated_at timestamptz,
        resolved_at timestamptz,
        resolved_by uuid,
        resolution_value text,
        facility_id uuid NOT NULL
      );
    `);

    await queryRunner.query(`ALTER TABLE conflicts ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE conflicts FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_conflicts ON conflicts
      USING (facility_id = current_setting('app.current_facility_id')::uuid);
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON conflicts TO wardlink_app;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS conflicts;`);
    await queryRunner.query(`ALTER TABLE structured_fields DROP CONSTRAINT IF EXISTS unique_patient_field;`);
    await queryRunner.query(`ALTER TABLE field_ops DROP COLUMN IF EXISTS base_hlc;`);
  }
}