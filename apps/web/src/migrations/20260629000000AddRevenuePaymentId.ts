import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRevenuePaymentId20260629000000 implements MigrationInterface {
  name = "AddRevenuePaymentId20260629000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE revenues
      ADD COLUMN IF NOT EXISTS payment_id uuid DEFAULT NULL
    `);

    // Extract payment_id from descriptions in the format "UUID# دفعة إيجار"
    await queryRunner.query(`
      UPDATE revenues
      SET payment_id = (
        CASE
          WHEN position('#' in description) > 0 THEN
            trim(both ' ' from split_part(description, '#', 1))
          ELSE NULL
        END
      )::uuid,
      description = 'دفعة إيجار'
      WHERE description IS NOT NULL
        AND description LIKE '%# دفعة إيجار'
    `);

    // Extract payment_id from descriptions in the format "دفعة إيجار #UUID"
    await queryRunner.query(`
      UPDATE revenues
      SET payment_id = (
        CASE
          WHEN position('#' in description) > 0 THEN
            trim(both ' ' from split_part(description, '#', 2))
          ELSE NULL
        END
      )::uuid,
      description = 'دفعة إيجار'
      WHERE description IS NOT NULL
        AND description LIKE 'دفعة إيجار #%'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_revenues_payment_id
      ON revenues (payment_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_revenues_payment_id`);
    await queryRunner.query(`
      ALTER TABLE revenues
      DROP COLUMN IF EXISTS payment_id
    `);
  }
}
