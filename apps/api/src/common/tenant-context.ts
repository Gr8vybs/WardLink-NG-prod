import { DataSource } from "typeorm";

/**
 * Runs `callback` inside a transaction with the Postgres session variable
 * `app.current_facility_id` scoped to that transaction only.
 *
 * Why this matters: with a pooled connection, a bare `SET` persists on
 * that physical connection and can leak into the *next* unrelated request
 * that happens to reuse it. `SET LOCAL` inside a transaction is scoped to
 * that transaction alone and is automatically cleared on COMMIT/ROLLBACK
 * — the pool can safely hand the connection to a different facility's
 * request immediately after.
 *
 * Every read/write that touches an RLS-protected table (patients,
 * handoffs, structured_fields, field_ops) must go through this — never
 * query those tables on a bare, unscoped connection. Because RLS is set
 * to FORCE and the app role has NOBYPASSRLS, forgetting this wrapper
 * doesn't leak data — it throws (see the "no context set" test in the
 * project notes) — but it does mean the request fails, so this should sit
 * in one shared place (e.g. a Nest interceptor) rather than being called
 * ad hoc in every service.
 */
export async function withFacilityContext<T>(
  dataSource: DataSource,
  facilityId: string,
  callback: (queryRunner: import("typeorm").QueryRunner) => Promise<T>,
): Promise<T> {
  // Postgres does not support bind parameters ($1) inside SET statements,
  // so we can't parameterize this the normal way. Guard against injection
  // by strictly validating the shape instead — a facilityId that isn't a
  // well-formed UUID is rejected before it ever reaches SQL.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(facilityId)) {
    throw new Error(`withFacilityContext: facilityId is not a valid UUID: ${facilityId}`);
  }

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.query(`SET LOCAL app.current_facility_id = '${facilityId}'`);
    const result = await callback(queryRunner);
    await queryRunner.commitTransaction();
    return result;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
