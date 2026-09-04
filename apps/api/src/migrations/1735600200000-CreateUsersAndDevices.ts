import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersAndDevices1735600200000 implements MigrationInterface {
  name = "CreateUsersAndDevices1735600200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        facility_id uuid NOT NULL,
        staff_id text NOT NULL UNIQUE,
        role text NOT NULL,
        password_hash text NOT NULL,
        pin_hash text,
        active boolean NOT NULL DEFAULT true
      );
    `);

    await queryRunner.query(`
      CREATE TABLE devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        facility_id uuid NOT NULL,
        ward_id uuid NOT NULL,
        device_type text NOT NULL,
        device_name text NOT NULL
      );
    `);

    for (const table of ["users", "devices"]) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation_${table} ON ${table}
        USING (facility_id = current_setting('app.current_facility_id')::uuid);
      `);
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO wardlink_app;`,
      );
    }

    // Login (staff_id lookup) happens before a facility context can be set —
    // the user's own row is how we discover their facility in the first
    // place. So login specifically needs a narrow, deliberate exception:
    // a SECURITY DEFINER function that looks up credentials by staff_id
    // without requiring app.current_facility_id to already be set. It
    // returns only the columns login needs, nothing else.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION lookup_user_for_login(p_staff_id text)
      RETURNS TABLE (id uuid, facility_id uuid, role text, password_hash text, active boolean)
      LANGUAGE sql SECURITY DEFINER AS $$
        SELECT id, facility_id, role, password_hash, active
        FROM users
        WHERE staff_id = p_staff_id;
      $$;
    `);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION lookup_user_for_login(text) TO wardlink_app;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS lookup_user_for_login(text);`);
    await queryRunner.query(`DROP TABLE IF EXISTS devices;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);
  }
}