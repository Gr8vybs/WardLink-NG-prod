import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Starting a shared-device session has the same chicken-and-egg problem as
 * login: we need to discover the device's facility_id before we can set
 * app.current_facility_id, but reading the devices table requires it (RLS
 * is FORCE'd). Same fix as login — a narrow SECURITY DEFINER function that
 * returns only what's needed to start a session.
 */
export class AddDeviceLookupFunction1735600300000 implements MigrationInterface {
  name = "AddDeviceLookupFunction1735600300000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION lookup_device_for_session(p_device_id uuid)
      RETURNS TABLE (id uuid, facility_id uuid, ward_id uuid, device_type text)
      LANGUAGE sql SECURITY DEFINER AS $$
        SELECT id, facility_id, ward_id, device_type
        FROM devices
        WHERE id = p_device_id;
      $$;
    `);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION lookup_device_for_session(uuid) TO wardlink_app;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS lookup_device_for_session(uuid);`);
  }
}