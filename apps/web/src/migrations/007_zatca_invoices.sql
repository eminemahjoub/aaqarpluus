-- =============================================================================
-- 007_zatca_invoices.sql
-- ZATCA invoice storage (invoice numbering lives in office_invoice_counters
-- from migration 006; numbering itself is an atomic upsert in lib/zatca).
-- UNSIGNED invoices only — Phase-2 signing requires ZATCA CSID credentials.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS zatca_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  payment_id UUID REFERENCES contract_payments(id) ON DELETE SET NULL,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  vat_amount DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(4,4) NOT NULL DEFAULT 0.15,
  payment_method PAYMENT_METHOD NOT NULL DEFAULT 'cash',
  seller_name TEXT NOT NULL,
  seller_vat TEXT,
  buyer_name TEXT,
  buyer_vat TEXT,
  xml_payload TEXT,
  qr_payload TEXT,
  previous_invoice_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('generated', 'signed', 'reported', 'cancelled')) DEFAULT 'generated',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_zatca_invoice_number UNIQUE (invoice_number, office_id)
);

CREATE INDEX IF NOT EXISTS idx_zatca_invoices_office ON zatca_invoices(office_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_zatca_invoices_payment ON zatca_invoices(payment_id) WHERE payment_id IS NOT NULL;

COMMIT;