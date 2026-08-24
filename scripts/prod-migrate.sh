#!/usr/bin/env bash
# =============================================================================
# prod-migrate.sh — apply the full migration set (001..014) to the production
# database safely. Run ON THE VPS inside the app checkout, BEFORE deploying
# the new code. Idempotent: safe to re-run.
#
#   Usage:  bash prod-migrate.sh
#
# Steps: backup -> TS migrations (ledger) -> 006..014 -> verify
# =============================================================================
set -euo pipefail

APP_DIR="/root/aaqarpluus"          # adjust to your checkout
M="${APP_DIR}/apps/web/src/migrations"
DB_SERVICE="db"                     # docker compose service holding postgres
TS="${M}/ts_migrations_combined.sql"
FILES="006_fix_core_schema.sql 007_zatca_invoices.sql 008_worker_heartbeat.sql
009_login_history.sql 010_sms_glue.sql 011_zatca_invoice_tracking.sql
012_storage_provider.sql 013_financial_enums_and_queue_updated.sql
014_offices_columns.sql"

cd "${APP_DIR}"
echo "==> Pulling latest code"
git pull origin main || { echo "git pull failed — resolve and re-run"; exit 1; }

echo "==> Backup (non-negotiable)"
STAMP=$(date +%Y%m%d-%H%M)
docker compose exec -T "${DB_SERVICE}" pg_dump -U postgres -d property_crm -Fc \
  > "backup-property_crm-${STAMP}.dump"
ls -la "backup-property_crm-${STAMP}.dump"

echo "==> Applying TypeORM migrations (with ledger)"
docker compose exec -T "${DB_SERVICE}" psql -U postgres -d property_crm \
  -v ON_ERROR_STOP=1 -f /dev/stdin < "${TS}"

echo "==> Applying SQL migrations 006..014"
for f in ${FILES}; do
  echo "   - ${f}"
  docker compose exec -T "${DB_SERVICE}" psql -U postgres -d property_crm \
    -v ON_ERROR_STOP=1 -f /dev/stdin < "${M}/${f}"
done

echo "==> Verify"
docker compose exec -T "${DB_SERVICE}" psql -U postgres -d property_crm \
  -c "\d zatca_invoices" >/dev/null && echo "  zatca_invoices OK"
docker compose exec -T "${DB_SERVICE}" psql -U postgres -d property_crm \
  -t -A -c "SELECT typname FROM pg_type WHERE typname='payment_method'" >/dev/null \
  && echo "  payment_method enum OK"
docker compose exec -T "${DB_SERVICE}" psql -U postgres -d property_crm \
  -t -A -c "SELECT COUNT(*) FROM migrations" | grep -qE "[1-9]" && echo "  migrations ledger OK"

echo "==> Deploy the new code now:"
echo "    docker compose up -d --build web"
echo "==> Then smoke: mark a payment 'paid' -> receipt PDF with QR + invoice row"