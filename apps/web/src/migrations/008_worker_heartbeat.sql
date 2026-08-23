-- =============================================================================
-- 008_worker_heartbeat.sql
-- 1. worker_heartbeats — health monitor for background workers
-- 2. Extend notification_queue.status CHECK with 'processing' so the queue
--    processor can claim rows atomically (FOR UPDATE SKIP LOCKED) without
--    racing other instances.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_name TEXT PRIMARY KEY,
  last_beat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Statuses: pending | scheduled | processing | sent | failed
ALTER TABLE notification_queue DROP CONSTRAINT IF EXISTS chk_notification_queue_status;
ALTER TABLE notification_queue ADD CONSTRAINT chk_notification_queue_status
  CHECK (status IN ('pending', 'scheduled', 'processing', 'sent', 'failed'));

-- Stale 'processing' rows (crashed worker) must be claimable again — created_at
-- doubles as the claim timestamp source.
CREATE INDEX IF NOT EXISTS idx_notification_queue_processing
  ON notification_queue (status, created_at)
  WHERE status = 'processing';

COMMIT;