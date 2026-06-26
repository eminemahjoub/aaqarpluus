import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactPinPlain20260626000000 implements MigrationInterface {
  name = "AddContactPinPlain20260626000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS pin_plain varchar(255) DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE contacts
      DROP COLUMN IF EXISTS pin_plain
    `);
  }
}
