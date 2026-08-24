-- =============================================================================
-- 015_subscriptions.sql — SaaS billing layer.
-- Adaptations vs the original spec:
--  * NO `agencies` table — subscriptions stay on agencies via `user_id`
--    (admin routes join users) + `office_id` (the billable tenant).
--  * `subscriptions` table is EXTENDED, not recreated (existing admin API).
--  * `plan` column doubles as plans(id) reference.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(20) PRIMARY KEY,
  name_ar VARCHAR(50) NOT NULL,
  name_en VARCHAR(50) NOT NULL,
  price_sar DECIMAL(10,2) NOT NULL,
  unit_limit INT,
  billing_interval VARCHAR(20) DEFAULT 'monthly',
  features JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO plans (id, name_ar, name_en, price_sar, unit_limit, features) VALUES
('free',    'مجاني', 'Free',    0.00, 3,   '{"contracts":true,"payments":true,"documents":true,"reports":true,"ejar":false,"zatca":false,"sms":false,"owner_portal":false,"api":false,"branding":false}'),
('starter', 'البداية', 'Starter', 49.00, 10, '{"contracts":true,"payments":true,"documents":true,"reports":true,"ejar":true,"zatca":true,"sms":true,"owner_portal":false,"api":false,"branding":false}'),
('growth',  'النمو', 'Growth',  199.00, 50, '{"contracts":true,"payments":true,"documents":true,"reports":true,"ejar":true,"zatca":true,"sms":true,"owner_portal":true,"api":false,"branding":false}'),
('pro',     'احترافي', 'Pro',    9.00,  NULL, '{"contracts":true,"payments":true,"documents":true,"reports":true,"ejar":true,"zatca":true,"sms":true,"owner_portal":true,"api":true,"branding":true}')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES offices(id),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gateway_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gateway_subscription_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(255),
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_subscriptions_office ON subscriptions(office_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS saas_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id),
  subscription_id UUID REFERENCES subscriptions(id),
  plan_id VARCHAR(20) NOT NULL,
  amount_sar DECIMAL(10,2) NOT NULL,
  tax_sar DECIMAL(10,2) NOT NULL,
  total_sar DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  zatca_invoice_id UUID REFERENCES zatca_invoices(id),
  paid_at TIMESTAMPTZ,
  due_date DATE NOT NULL,
  gateway_payment_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  gateway_token VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  last_four VARCHAR(4),
  expiry_month INT,
  expiry_year INT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saas_invoices_office ON saas_invoices(office_id, created_at DESC);

COMMIT;