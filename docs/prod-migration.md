# Production Migration Runbook

Applies the full migration set the code now depends on. **Must run BEFORE deploying the current code**
— entity metadata SELECTs `payment_method`, `contract_number`, `zatca_invoices`, etc., so an un-migrated
prod DB will 500 on first contract/payment/notification query.

## Prerequisites

- SSH access to the VPS (or a TCP-routed psql to prod)
- `pg_dump` available locally or on the VPS
- Freeze deploys during the window

## 1. Backup (non-negotiable)

```bash
pg_dump -h PROD_HOST -U PROD_USER -d property_crm -Fc \
  > /tmp/pre-migration-$(date +%Y%m%d-%H%M).dump
# sanity: confirm non-trivial size and that it restores
ls -la /tmp/pre-migration-*.dump
```

## 2. Apply migrations in order

The 5 TypeORM migrations exist as TS class files (TypeORM `migration:run` also works if the CLI
can find a DataSource export — otherwise apply their SQL manually, they are idempotent):

```bash
psql -h PROD_HOST -U PROD_USER -d property_crm -f 20260625000000FinancialAndMaintenance.sql   # extract from TS up()
psql -h PROD_HOST -U PROD_USER -d property_crm -f 20260626000000AddContactPinPlain.sql
psql -h PROD_HOST -U PROD_USER -d property_crm -f 20260627000000AddContactUniqueConstraints.sql
psql -h PROD_HOST -U PROD_USER -d property_crm -f 20260629000000AddRevenuePaymentId.sql
psql -h PROD_HOST -U PROD_USER -d property_crm -f 20260809000004AddMaintenancePredictionFields.sql

psql -h PROD_HOST -U PROD_USER -d property_crm -f 006_fix_core_schema.sql
psql -h PROD_HOST -U PROD_USER -d property_crm -f 007_zatca_invoices.sql
```

If the app can reach prod itself, the simpler path is to boot it once with TypeORM migrations
enabled and let `data-source.ts` run its 5 registered TS migrations, then apply 006/007 SQL.

## 3. Verify

```bash
psql -h PROD_HOST -U PROD_USER -d property_crm -c "\d zatca_invoices"
psql -h PROD_HOST -U PROD_USER -d property_crm -c "SELECT typname FROM pg_type WHERE typname = 'payment_method'"
psql -h PROD_HOST -U PROD_USER -d property_crm -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name='contracts' AND column_name IN ('contract_number','office_id')"
psql -h PROD_HOST -U PROD_USER -d property_crm -c "SELECT COUNT(*) FROM migrations;"
```

## 4. Deploy code (normal pipeline: git pull + docker compose up -d --build web)

## 5. Smoke test (after deploy)

1. Log in as an agency with an office
2. Create / mark a payment `paid` → expect receipt PDF + ZATCA invoice row (no 500)
3. Open the tenant receipts page and download the PDF (QR visible)
4. Trigger `/api/notifications/process` as superadmin → email queue drains
5. `npm audit` on the build host (already 0 locally)

## Rollback

Restore the dump and redeploy the previous image:

```bash
pg_restore -h PROD_HOST -U PROD_USER -d property_crm --clean --if-exists /tmp/pre-migration-*.dump
```

All migrations are additive + idempotent (`IF NOT EXISTS`), so the realistic failure mode is not
schema corruption but a bad deploy — rollback means restoring the dump + previous image.