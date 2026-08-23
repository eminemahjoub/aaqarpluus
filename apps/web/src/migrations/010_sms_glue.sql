-- =============================================================================
-- 010_sms_glue.sql
-- SMS delivery support on notification_queue + dead-letter table.
-- =============================================================================

BEGIN;

ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

CREATE TABLE IF NOT EXISTS failed_sms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES notification_queue(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  body TEXT,
  error TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_sms_created ON failed_sms(created_at DESC);

COMMIT;