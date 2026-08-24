-- =============================================================================
-- 016_property_compliance.sql
-- Properties.extra (jsonb) for EJAR/ZATCA/condition fields not modeled as
-- columns + a partial unique index guarding duplicate title_deed_number.
-- =============================================================================

BEGIN;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS extra JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS uq_properties_title_deed
  ON properties (title_deed_number)
  WHERE title_deed_number IS NOT NULL AND deleted_at IS NULL;

COMMIT;