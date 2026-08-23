import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMaintenancePredictionFields20260809000004 implements MigrationInterface {
  name = "AddMaintenancePredictionFields20260809000004";

  async up(queryRunner: QueryRunner): Promise<void> {
    // Service-date & risk columns on units
    await queryRunner.query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS last_ac_service_date DATE NULL`);
    await queryRunner.query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS last_plumbing_check_date DATE NULL`);
    await queryRunner.query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS last_electrical_check_date DATE NULL`);
    await queryRunner.query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS maintenance_risk_score INTEGER DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE units ADD COLUMN IF NOT EXISTS maintenance_risk_level VARCHAR(50) DEFAULT 'low'`);

    // Predictive maintenance results
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS maintenance_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id UUID NOT NULL,
        prediction_date DATE NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_level VARCHAR(50) NOT NULL,
        predicted_failure_type VARCHAR(50) NOT NULL,
        predicted_failure_date DATE NULL,
        suggested_action TEXT NOT NULL,
        estimated_cost_sar NUMERIC(14,2) NULL,
        is_resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_maintenance_predictions_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_predictions_unit_id ON maintenance_predictions(unit_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_predictions_risk_level ON maintenance_predictions(risk_level) WHERE is_resolved = false`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_predictions_failure_date ON maintenance_predictions(predicted_failure_date) WHERE is_resolved = false`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS maintenance_predictions`);
    await queryRunner.query(`ALTER TABLE units DROP COLUMN IF EXISTS last_ac_service_date`);
    await queryRunner.query(`ALTER TABLE units DROP COLUMN IF EXISTS last_plumbing_check_date`);
    await queryRunner.query(`ALTER TABLE units DROP COLUMN IF EXISTS last_electrical_check_date`);
    await queryRunner.query(`ALTER TABLE units DROP COLUMN IF EXISTS maintenance_risk_score`);
    await queryRunner.query(`ALTER TABLE units DROP COLUMN IF EXISTS maintenance_risk_level`);
  }
}
