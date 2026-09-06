import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The aging sweep is a background job, not tied to any single facility's
 * request — it legitimately needs to look across every facility at once
 * to find conflicts that have been open too long. That's a genuine,
 * narrow exception to RLS, same category as login/device-lookup/facility-
 * creation: a SECURITY DEFINER function that does exactly one well-
 * audited thing and nothing else.
 */
export class AddEscalationSweepFunction1735600600000 implements MigrationInterface {
  name = "AddEscalationSweepFunction1735600600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION escalate_aging_conflicts(p_threshold_minutes int)
      RETURNS TABLE (id uuid, facility_id uuid, field_id uuid)
      LANGUAGE sql SECURITY DEFINER AS $$
        UPDATE conflicts
        SET status = 'escalated', escalated_at = now()
        WHERE status = 'open'
          AND opened_at < now() - (p_threshold_minutes || ' minutes')::interval
        RETURNING id, facility_id, field_id;
      $$;
    `);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION escalate_aging_conflicts(int) TO wardlink_app;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS escalate_aging_conflicts(int);`);
  }
}