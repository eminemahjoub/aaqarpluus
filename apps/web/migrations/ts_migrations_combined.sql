-- Combined up() SQL of the 5 TypeORM migrations (records them in the
-- `migrations` ledger so the app considers them applied).
-- Applied by scripts/prod-migrate.sh as step 1; idempotent (IF NOT EXISTS).

BEGIN;

-- ============ 20260625000000 FinancialAndMaintenance ============
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
);
CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_reference ON notifications(reference_id, reference_type);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255) NULL;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS unit_id UUID NULL;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS contact_id UUID NULL;
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100) NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unit_id UUID NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS contact_id UUID NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100) NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type VARCHAR(50) NULL DEFAULT 'task';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id UUID NULL;

-- ============ 20260626000000 AddContactPinPlain ============
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pin_plain varchar(255) DEFAULT NULL;

-- ============ 20260627000000 AddContactUniqueConstraints ============
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email varchar(255) DEFAULT NULL;

UPDATE contacts SET deleted_at = NOW()
WHERE id NOT IN (
  SELECT DISTINCT ON (phone) id FROM contacts
  WHERE phone IS NOT NULL AND deleted_at IS NULL
  ORDER BY phone, created_at DESC
) AND phone IS NOT NULL AND deleted_at IS NULL;

UPDATE contacts SET deleted_at = NOW()
WHERE id NOT IN (
  SELECT DISTINCT ON (email) id FROM contacts
  WHERE email IS NOT NULL AND deleted_at IS NULL
  ORDER BY email, created_at DESC
) AND email IS NOT NULL AND deleted_at IS NULL;

UPDATE contacts SET deleted_at = NOW()
WHERE id NOT IN (
  SELECT DISTINCT ON (id_number) id FROM contacts
  WHERE id_number IS NOT NULL AND deleted_at IS NULL
  ORDER BY id_number, created_at DESC
) AND id_number IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS UQ_contacts_phone
  ON contacts (phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS UQ_contacts_email
  ON contacts (email) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS UQ_contacts_id_number
  ON contacts (id_number) WHERE id_number IS NOT NULL AND deleted_at IS NULL;

-- ============ 20260629000000 AddRevenuePaymentId ============
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS payment_id uuid DEFAULT NULL;

UPDATE revenues
SET payment_id = (
  CASE WHEN position('#' in description) > 0 THEN
    trim(both ' ' from split_part(description, '#', 1))
  ELSE NULL END
)::uuid,
description = 'دفعة إيجار'
WHERE description IS NOT NULL AND description LIKE '%# دفعة إيجار';

UPDATE revenues
SET payment_id = (
  CASE WHEN position('#' in description) > 0 THEN
    trim(both ' ' from split_part(description, '#', 2))
  ELSE NULL END
)::uuid,
description = 'دفعة إيجار'
WHERE description IS NOT NULL AND description LIKE 'دفعة إيجار #%';

CREATE INDEX IF NOT EXISTS IDX_revenues_payment_id ON revenues (payment_id);

-- ============ 20260809000004 AddMaintenancePredictionFields ============
ALTER TABLE units ADD COLUMN IF NOT EXISTS last_ac_service_date DATE NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS last_plumbing_check_date DATE NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS last_electrical_check_date DATE NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS maintenance_risk_score INTEGER DEFAULT 0;
ALTER TABLE units ADD COLUMN IF NOT EXISTS maintenance_risk_level VARCHAR(50) DEFAULT 'low';

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
);
CREATE INDEX IF NOT EXISTS idx_maintenance_predictions_unit_id ON maintenance_predictions(unit_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_predictions_risk_level ON maintenance_predictions(risk_level) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_maintenance_predictions_failure_date ON maintenance_predictions(predicted_failure_date) WHERE is_resolved = false;

-- ============ DropContactPinPlain20260929000000 ============
ALTER TABLE contacts DROP COLUMN IF EXISTS pin_plain;

-- ============ TypeORM migrations ledger ============
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL
);
INSERT INTO migrations (timestamp, name) VALUES
  (20260625000000, 'FinancialAndMaintenance20260625000000'),
  (20260626000000, 'AddContactPinPlain20260626000000'),
  (20260627000000, 'AddContactUniqueConstraints20260627000000'),
  (20260629000000, 'AddRevenuePaymentId20260629000000'),
  (20260809000004, 'AddMaintenancePredictionFields20260809000004'),
  (20260929000000, 'DropContactPinPlain20260929000000')
ON CONFLICT DO NOTHING;

COMMIT;