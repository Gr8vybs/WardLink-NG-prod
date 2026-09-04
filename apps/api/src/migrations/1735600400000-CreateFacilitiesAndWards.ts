import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFacilitiesAndWards1735600400000 implements MigrationInterface {
  name = "CreateFacilitiesAndWards1735600400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE facilities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        type text NOT NULL,
        ndpr_compliance_contact text NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE wards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        facility_id uuid NOT NULL REFERENCES facilities(id),
        name text NOT NULL,
        acuity_level text NOT NULL DEFAULT 'standard'
      );
    `);

    // Track who admitted/created each patient record — useful for audit,
    // separate from current_author_id on individual structured fields.
    await queryRunner.query(`ALTER TABLE patients ADD COLUMN created_by uuid;`);

    // --- Wards: standard facility_id-scoped isolation, same pattern as
    // patients/handoffs/etc. Both reads and writes require facility
    // context to already be set (true for any request past login).
    await queryRunner.query(`ALTER TABLE wards ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE wards FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_wards ON wards
      USING (facility_id = current_setting('app.current_facility_id')::uuid);
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON wards TO wardlink_app;`);

    // --- Facilities are the tenant boundary itself, not a row scoped BY a
    // facility_id column — a facility can only ever see/modify its own
    // row (matched on id).
    await queryRunner.query(`ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE facilities FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY facilities_read_own ON facilities
      FOR SELECT USING (id = current_setting('app.current_facility_id')::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY facilities_update_own ON facilities
      FOR UPDATE USING (id = current_setting('app.current_facility_id')::uuid);
    `);
    await queryRunner.query(`GRANT SELECT, UPDATE ON facilities TO wardlink_app;`);

    // Creating a facility has the same chicken-and-egg problem as login
    // and device-session start: no facility context can exist yet. It's
    // tempting to fix this with a permissive `WITH CHECK (true)` INSERT
    // policy, but that's not enough on its own — Postgres also applies
    // the table's SELECT policy to an INSERT ... RETURNING clause (which
    // is what the ORM uses to read back the generated id), so the read-
    // back would still fail with no context set. The real fix is the
    // same pattern as login/device lookup: a narrow SECURITY DEFINER
    // function, owned by an admin role, that bypasses RLS for exactly
    // this one operation and nothing else. In a real deployment this
    // would additionally sit behind a separate secured onboarding path
    // rather than a public endpoint — see FacilityController.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION create_facility(p_name text, p_type text, p_ndpr_contact text)
      RETURNS facilities
      LANGUAGE sql SECURITY DEFINER AS $$
        INSERT INTO facilities (name, type, ndpr_compliance_contact)
        VALUES (p_name, p_type, p_ndpr_contact)
        RETURNING *;
      $$;
    `);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION create_facility(text, text, text) TO wardlink_app;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS create_facility(text, text, text);`);
    await queryRunner.query(`ALTER TABLE patients DROP COLUMN IF EXISTS created_by;`);
    await queryRunner.query(`DROP TABLE IF EXISTS wards;`);
    await queryRunner.query(`DROP TABLE IF EXISTS facilities;`);
  }
}