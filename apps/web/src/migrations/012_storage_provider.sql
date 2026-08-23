-- =============================================================================
-- 012_storage_provider.sql
-- Storage tracking columns. Covering documents AND property_images — both
-- live on the local disk (uploads) and both must participate in DR.
-- =============================================================================

BEGIN;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_key VARCHAR(500);

ALTER TABLE property_images
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE property_images
  ADD COLUMN IF NOT EXISTS storage_key VARCHAR(500);

COMMIT;