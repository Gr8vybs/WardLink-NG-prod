import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sending a referral requires picking a DESTINATION facility — but
 * facilities' own RLS policy deliberately restricts a session to seeing
 * only its own row. Same pattern as every other deliberate RLS
 * exception in this app: a narrow SECURITY DEFINER function that
 * returns only what's needed — id, name, and type, NOT the NDPR
 * compliance contact or anything else a facility might not want
 * broadcast to every other facility on the platform.
 */
export class AddFacilityDirectory1735600900000 implements MigrationInterface {
  name = "AddFacilityDirectory1735600900000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION list_facility_directory()
      RETURNS TABLE (id uuid, name text, type text)
      LANGUAGE sql SECURITY DEFINER AS $$
        SELECT id, name, type FROM facilities ORDER BY name;
      $$;
    `);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION list_facility_directory() TO wardlink_app;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS list_facility_directory();`);
  }
}