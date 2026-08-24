-- =============================================================================
-- 013_financial_enums_and_queue_updated.sql
-- 1. revenues/expenses.payment_method VARCHAR(100) -> payment_method ENUM
--    (map any legacy Arabic labels; unmapped values -> NULL so the cast
--     always succeeds)
-- 2. notification_queue.updated_at — accurate stale-'processing' recovery
-- =============================================================================

BEGIN;

UPDATE revenues
   SET payment_method = CASE payment_method
        WHEN 'نقدي' THEN 'cash'
        WHEN 'تحويل بنكي' THEN 'bank_transfer'
        WHEN 'شيك' THEN 'check'
        WHEN 'بطاقة' THEN 'card'
        WHEN 'أخرى' THEN 'other'
        WHEN 'cash' THEN 'cash'
        WHEN 'bank_transfer' THEN 'bank_transfer'
        WHEN 'check' THEN 'check'
        WHEN 'card' THEN 'card'
        WHEN 'other' THEN 'other'
        ELSE NULL
       END
 WHERE payment_method IS NOT NULL
   AND payment_method::text NOT IN ('cash','bank_transfer','check','card','other');

ALTER TABLE revenues
  ALTER COLUMN payment_method TYPE payment_method
  USING payment_method::payment_method;

UPDATE expenses
   SET payment_method = CASE payment_method
        WHEN 'نقدي' THEN 'cash'
        WHEN 'تحويل بنكي' THEN 'bank_transfer'
        WHEN 'شيك' THEN 'check'
        WHEN 'بطاقة' THEN 'card'
        WHEN 'أخرى' THEN 'other'
        WHEN 'cash' THEN 'cash'
        WHEN 'bank_transfer' THEN 'bank_transfer'
        WHEN 'check' THEN 'check'
        WHEN 'card' THEN 'card'
        WHEN 'other' THEN 'other'
        ELSE NULL
       END
 WHERE payment_method IS NOT NULL
   AND payment_method::text NOT IN ('cash','bank_transfer','check','card','other');

ALTER TABLE expenses
  ALTER COLUMN payment_method TYPE payment_method
  USING payment_method::payment_method;

ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

COMMIT;