import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotesAndAcknowledgments1735600700000 implements MigrationInterface {
  name = "CreateNotesAndAcknowledgments1735600700000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patients(id),
        author_id uuid NOT NULL,
        hlc jsonb NOT NULL,
        text text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        facility_id uuid NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE acknowledgments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        handoff_id uuid NOT NULL REFERENCES handoffs(id),
        acknowledged_by uuid NOT NULL,
        hlc jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        facility_id uuid NOT NULL
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_notes_patient_time ON notes (patient_id, created_at);`);

    for (const table of ["notes", "acknowledgments"]) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation_${table} ON ${table}
        USING (facility_id = current_setting('app.current_facility_id')::uuid);
      `);
      await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO wardlink_app;`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS acknowledgments;`);
    await queryRunner.query(`DROP TABLE IF EXISTS notes;`);
  }
}