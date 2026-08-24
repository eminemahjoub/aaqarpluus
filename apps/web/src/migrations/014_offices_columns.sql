-- =============================================================================
-- 014_offices_columns.sql
-- Schema drift fix: the offices entity (TypeORM) has columns the DB never
-- got (older synchronize-era schema). Missing: CR/VAT numbers, logo, and
-- the Arabic/English descriptions — all read by the logo route, office
-- settings, receipts and ZATCA invoice generation.
-- =============================================================================

BEGIN;

ALTER TABLE offices ADD COLUMN IF NOT EXISTS cr_number VARCHAR(20);
ALTER TABLE offices ADD COLUMN IF NOT EXISTS vat_number VARCHAR(20);
ALTER TABLE offices ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);
ALTER TABLE offices ADD COLUMN IF NOT EXISTS description_ar VARCHAR(255);
ALTER TABLE offices ADD COLUMN IF NOT EXISTS description_en VARCHAR(255);

COMMIT;