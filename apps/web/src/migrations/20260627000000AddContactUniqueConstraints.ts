import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactUniqueConstraints20260627000000 implements MigrationInterface {
  name = "AddContactUniqueConstraints20260627000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE contacts
      ADD COLUMN IF NOT EXISTS email varchar(255) DEFAULT NULL
    `);

    // Remove duplicates: keep the newest row, soft-delete older ones
    await queryRunner.query(`
      UPDATE contacts SET deleted_at = NOW()
      WHERE id NOT IN (
        SELECT DISTINCT ON (phone) id
        FROM contacts
        WHERE phone IS NOT NULL AND deleted_at IS NULL
        ORDER BY phone, created_at DESC
      )
      AND phone IS NOT NULL AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      UPDATE contacts SET deleted_at = NOW()
      WHERE id NOT IN (
        SELECT DISTINCT ON (email) id
        FROM contacts
        WHERE email IS NOT NULL AND deleted_at IS NULL
        ORDER BY email, created_at DESC
      )
      AND email IS NOT NULL AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      UPDATE contacts SET deleted_at = NOW()
      WHERE id NOT IN (
        SELECT DISTINCT ON (id_number) id
        FROM contacts
        WHERE id_number IS NOT NULL AND deleted_at IS NULL
        ORDER BY id_number, created_at DESC
      )
      AND id_number IS NOT NULL AND deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_contacts_phone
      ON contacts (phone)
      WHERE phone IS NOT NULL AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_contacts_email
      ON contacts (email)
      WHERE email IS NOT NULL AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_contacts_id_number
      ON contacts (id_number)
      WHERE id_number IS NOT NULL AND deleted_at IS NULL
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
