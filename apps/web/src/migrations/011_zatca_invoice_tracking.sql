-- =============================================================================
-- 011_zatca_invoice_tracking.sql
-- ZATCA Phase-2 tracking columns on the EXISTING zatca_invoices table.
-- (No separate `invoices` table exists; the status CHECK is extended with
-- 'warning' and 'error' instead of adding a parallel status column.)
-- =============================================================================

BEGIN;

ALTER TABLE zatca_invoices
  ADD COLUMN IF NOT EXISTS zatca_report_id VARCHAR(100);
ALTER TABLE zatca_invoices
  ADD COLUMN IF NOT EXISTS zatca_invoice_hash TEXT;
ALTER TABLE zatca_invoices
  ADD COLUMN IF NOT EXISTS zatca_signed_xml TEXT;
ALTER TABLE zatca_invoices
  ADD COLUMN IF NOT EXISTS zatca_submitted_at TIMESTAMPTZ;
ALTER TABLE zatca_invoices
  ADD COLUMN IF NOT EXISTS zatca_response_raw JSONB;
ALTER TABLE zatca_invoices
  ADD COLUMN IF NOT EXISTS zatca_retry_count INT NOT NULL DEFAULT 0;

ALTER TABLE zatca_invoices DROP CONSTRAINT IF EXISTS chk_zatca_invoices_status;
ALTER TABLE zatca_invoices ADD CONSTRAINT chk_zatca_invoices_status
  CHECK (status IN ('generated', 'signed', 'reported', 'cancelled', 'warning', 'error'));

COMMIT;