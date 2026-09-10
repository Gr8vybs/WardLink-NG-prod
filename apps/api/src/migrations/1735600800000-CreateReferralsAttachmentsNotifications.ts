import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReferralsAttachmentsNotifications1735600800000 implements MigrationInterface {
  name = "CreateReferralsAttachmentsNotifications1735600800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE referrals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL,
        origin_facility_id uuid NOT NULL,
        dest_facility_id uuid NOT NULL,
        snapshot_ref text NOT NULL,
        status text NOT NULL DEFAULT 'sent',
        sent_by uuid NOT NULL,
        claimed_by uuid,
        sent_at timestamptz NOT NULL DEFAULT now(),
        claimed_at timestamptz
      );
    `);

    await queryRunner.query(`
      CREATE TABLE attachments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL REFERENCES patients(id),
        uploaded_by uuid NOT NULL,
        hlc jsonb NOT NULL,
        file_ref text,
        mime_type text NOT NULL,
        upload_status text NOT NULL DEFAULT 'queued',
        created_at timestamptz NOT NULL DEFAULT now(),
        facility_id uuid NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        facility_id uuid NOT NULL,
        recipient_id uuid NOT NULL,
        type text NOT NULL,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        read_at timestamptz
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_notifications_recipient ON notifications (recipient_id, read_at);`);

    for (const table of ["attachments", "notifications"]) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation_${table} ON ${table}
        USING (facility_id = current_setting('app.current_facility_id')::uuid);
      `);
      await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO wardlink_app;`);
    }

    // --- Referrals: the one table where two DIFFERENT facilities
    // legitimately need visibility into the same row — needs three
    // separate, narrower policies instead of the usual one:
    //   - SELECT: either the sender OR the receiver can see it
    //   - INSERT: only the sender, only on their own facility's behalf
    //   - UPDATE: only the receiver (to claim it)
    await queryRunner.query(`ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE referrals FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY referrals_select_either_side ON referrals
      FOR SELECT USING (
        origin_facility_id = current_setting('app.current_facility_id')::uuid
        OR dest_facility_id = current_setting('app.current_facility_id')::uuid
      );
    `);
    await queryRunner.query(`
      CREATE POLICY referrals_insert_by_origin ON referrals
      FOR INSERT WITH CHECK (
        origin_facility_id = current_setting('app.current_facility_id')::uuid
      );
    `);
    await queryRunner.query(`
      CREATE POLICY referrals_update_by_dest ON referrals
      FOR UPDATE USING (
        dest_facility_id = current_setting('app.current_facility_id')::uuid
      );
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON referrals TO wardlink_app;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notifications;`);
    await queryRunner.query(`DROP TABLE IF EXISTS attachments;`);
    await queryRunner.query(`DROP TABLE IF EXISTS referrals;`);
  }
}