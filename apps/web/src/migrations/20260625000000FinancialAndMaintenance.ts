import { MigrationInterface, QueryRunner } from "typeorm";

export class FinancialAndMaintenance20260625000000 implements MigrationInterface {
  name = "FinancialAndMaintenance20260625000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NULL,
        reference_id UUID NULL,
        reference_type VARCHAR(50) NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, is_read)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notif_reference ON notifications(reference_id, reference_type)`);

    await queryRunner.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE revenues ADD COLUMN IF NOT EXISTS unit_id UUID NULL`);
    await queryRunner.query(`ALTER TABLE revenues ADD COLUMN IF NOT EXISTS contact_id UUID NULL`);
    await queryRunner.query(`ALTER TABLE revenues ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100) NULL`);
    await queryRunner.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unit_id UUID NULL`);
    await queryRunner.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS contact_id UUID NULL`);
    await queryRunner.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100) NULL`);
    await queryRunner.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type VARCHAR(50) NULL DEFAULT 'task'`);
    await queryRunner.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id UUID NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
    await queryRunner.query(`ALTER TABLE contacts DROP COLUMN IF EXISTS pin_hash`);
    await queryRunner.query(`ALTER TABLE revenues DROP COLUMN IF EXISTS unit_id`);
    await queryRunner.query(`ALTER TABLE revenues DROP COLUMN IF EXISTS contact_id`);
    await queryRunner.query(`ALTER TABLE revenues DROP COLUMN IF EXISTS payment_method`);
    await queryRunner.query(`ALTER TABLE expenses DROP COLUMN IF EXISTS unit_id`);
    await queryRunner.query(`ALTER TABLE expenses DROP COLUMN IF EXISTS contact_id`);
    await queryRunner.query(`ALTER TABLE expenses DROP COLUMN IF EXISTS payment_method`);
    await queryRunner.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS tenant_id`);
    await queryRunner.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS type`);
  }
}
