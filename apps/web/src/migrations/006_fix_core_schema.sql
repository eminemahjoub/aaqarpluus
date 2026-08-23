-- =============================================================================
-- 006_fix_core_schema.sql
-- -----------------------------------------------------------------------------
-- 1. Enum payment_method + contract_payments.payment_method
-- 2. contracts.contract_number (+ office_id prerequisite) with partial unique index
-- 3. tasks: assigned_to, sla_deadline, materials_cost, materials
-- 4. office_invoice_counters
-- 5. password_resets
-- 6. notification_preferences
-- 7. notification_log
-- 8. notification_queue
--
-- Idempotent: safe to re-run. PostgreSQL 16 (gen_random_uuid() is built-in).
--
-- SCHEMA ADAPTATIONS (verified against the live schema):
--  * contracts has no office_id column, but the requested unique index
--    (contract_number, office_id) needs one -> office_id UUID NULL is added here.
--  * There is no office_members table (agency staff are users rows with
--    office_id) -> tasks.assigned_to references users(id) instead.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. payment_method enum + contract_payments column
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'check', 'card', 'other');
  END IF;
END $$;

ALTER TABLE contract_payments
  ADD COLUMN IF NOT EXISTS payment_method payment_method NOT NULL DEFAULT 'cash';

-- ---------------------------------------------------------------------------
-- 2. contracts.contract_number + unique index (per office, where not null)
-- ---------------------------------------------------------------------------
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contract_number TEXT;

-- Prerequisite for the unique index below: contracts previously had no
-- office linkage column. Populate it from the contract owner's agency when
-- applicable (see note at bottom).
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES offices(id);

-- NULLS NOT DISTINCT also prevents duplicate numbers on contracts with no
-- office linkage (office_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS ux_contracts_contract_number_office_id
  ON contracts (contract_number, office_id) NULLS NOT DISTINCT
  WHERE contract_number IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. tasks: assignment, SLA, materials
-- ---------------------------------------------------------------------------
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS materials_cost DECIMAL(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS materials JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);

-- ---------------------------------------------------------------------------
-- 4. office_invoice_counters (one counter row per office)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS office_invoice_counters (
  office_id UUID PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
  counter   INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- 5. password_resets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- UNIQUE constraint also creates the requested token_hash index
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 6. notification_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_preferences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours      JSONB NOT NULL DEFAULT '{"start": "22:00", "end": "08:00"}',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. notification_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL,
  actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  office_id    UUID NOT NULL REFERENCES offices(id),
  metadata     JSONB NOT NULL DEFAULT '{}',
  channels     TEXT[] NOT NULL,
  results      JSONB NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at      TIMESTAMPTZ,
  CONSTRAINT chk_notification_log_status
    CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_notification_log_recipient
  ON notification_log (recipient_id, created_at);

CREATE INDEX IF NOT EXISTS idx_notification_log_office_created
  ON notification_log (office_id, created_at);

-- ---------------------------------------------------------------------------
-- 8. notification_queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notification_log(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL,
  payload         JSONB,
  scheduled_for   TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending',
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  CONSTRAINT chk_notification_queue_status
    CHECK (status IN ('pending', 'scheduled', 'sent', 'failed'))
);

-- Worker pickup index: only rows awaiting dispatch
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled
  ON notification_queue (scheduled_for, status)
  WHERE status IN ('pending', 'scheduled');

COMMIT;

-- =============================================================================
-- FOLLOW-UP NOTES (not executed here):
--  * Existing contract numbers live in contracts.extra->>'contract_number'.
--    Backfill after setting office_id (only where uniqueness can be
--    guaranteed):
--      UPDATE contracts c
--         SET contract_number = c.extra->>'contract_number'
--       WHERE c.contract_number IS NULL AND c.extra ? 'contract_number';
--  * Suggested office_id backfill (agency = managing office of the property):
--      UPDATE contracts c
--         SET office_id = p.managing_office_id
--        FROM properties p
--       WHERE p.id = c.property_id AND c.office_id IS NULL;
-- =============================================================================
