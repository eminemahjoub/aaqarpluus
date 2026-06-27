import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactUniqueConstraints20260627000000 implements MigrationInterface {
  name = "AddContactUniqueConstraints20260627000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS email varchar(255) DEFAULT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_contacts_phone
      ON contacts (phone)
      WHERE phone IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_contacts_email
      ON contacts (email)
      WHERE email IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_contacts_id_number
      ON contacts (id_number)
      WHERE id_number IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS UQ_contacts_phone`);
    await queryRunner.query(`DROP INDEX IF EXISTS UQ_contacts_email`);
    await queryRunner.query(`DROP INDEX IF EXISTS UQ_contacts_id_number`);
    await queryRunner.query(`
      ALTER TABLE contacts
      DROP COLUMN IF EXISTS email
    `);
  }
}
