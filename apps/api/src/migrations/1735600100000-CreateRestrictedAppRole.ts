import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Creates the restricted Postgres role the NestJS API connects as at
 * runtime. This role deliberately has NOSUPERUSER and NOBYPASSRLS —
 * Postgres superusers (and, by default, table owners without FORCE RLS)
 * bypass Row-Level Security entirely, which would silently defeat the
 * tenant isolation set up in the previous migration.
 *
 * Migrations themselves should keep running as an admin/owner role
 * (e.g. the default `postgres` user) since they need to CREATE/ALTER
 * tables and policies — only the *runtime* API connection should use
 * `wardlink_app`.
 *
 * The password below is a local-dev placeholder. In any real deployment,
 * generate this via your secrets manager and never commit it.
 */
export class CreateRestrictedAppRole1735600100000 implements MigrationInterface {
  name = "CreateRestrictedAppRole1735600100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wardlink_app') THEN
          CREATE ROLE wardlink_app WITH LOGIN PASSWORD 'app_password_change_me' NOSUPERUSER NOBYPASSRLS;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`GRANT CONNECT ON DATABASE ${queryRunner.connection.options.database} TO wardlink_app;`);
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO wardlink_app;`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wardlink_app;`);
    // Ensure future tables (from later migrations) are covered automatically too.
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wardlink_app;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM wardlink_app;`);
    await queryRunner.query(`DROP ROLE IF EXISTS wardlink_app;`);
  }
}
