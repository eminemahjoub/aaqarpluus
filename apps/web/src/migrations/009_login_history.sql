-- =============================================================================
-- 009_login_history.sql
-- Login attempt audit. user_id is NULLABLE on purpose: tenant (PIN) logins
-- have no users row — they are recorded with user_id=NULL and email=phone.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at DESC);

COMMIT;