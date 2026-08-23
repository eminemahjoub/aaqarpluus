# AaqarPlus — Architecture

Snapshot as of the security + notifications hardening session. Single Next.js 16 monorepo (`apps/web`), TypeORM 0.3 + PostgreSQL 16.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS, shadcn-style components (`components/ui/*`, hand-rolled, no cva/Radix except zero deps) |
| Data fetching | TanStack React Query 5 + `authFetch` (credentials + CSRF header) |
| Database | PostgreSQL 16 via TypeORM 0.3 (EntitySchema) + raw SQL |
| Auth | Custom JWT (jose HS256) — staff/owner/admin; PIN JWT for tenants |
| Email | nodemailer (SMTP env-driven, dev fallback) |
| PDF | pdf-lib + HTML templates (Arabic RTL) |
| AI | brain.js (predictive maintenance) + Cerebras/OpenAI LLM insights |
| Deploy | Docker Compose (Postgres + standalone Next) → VPS via SSH GitHub Action |

## Layered structure

```
Presentation  dashboard / agency / admin / tenant / (auth) / landing
API layer     route handlers wrapped in withAuth -> scope asserts -> zod
Scope layer   lib/auth/scope.ts              (authorization spine)
Validation    lib/validation/{contracts,payments}.ts + validationFailed()
Domain        finance-service · auto-payments · recurring-tasks ·
              owner-tenant-privacy · receipt-pdf · lease-template
Services      lib/email/service.ts           (SMTP)
              lib/notifications/             (dispatcher → providers → queue)
Data          TypeORM entities + migrations (5 TS + 006 SQL)
```

## AuthZ model (`lib/auth/scope.ts`)

- `resolveContext(officeId?)` — JWT cookie → fresh `users` row → role (`superadmin→admin`, `agency→manager`, `owner/personal→owner`, else viewer) + officeId.
- `assertPropertyAccess / assertUnitAccess / assertContractAccess / assertTaskAccess` — throw `AuthError(404)` for missing **and** unauthorized (IDOR-safe); task access handles unit-level and property-level (unit_id NULL) tasks.
- `requireCapability(ctx, …)` — properties_mutate (agency), contracts_mutate (agency/superadmin), tasks/payments/finance/documents_mutate (admin/app users), app_data.
- `getPropertyIdsForContext(ctx)` — list-scoping helper (office links / legacy fallback / ownership).
- `withAuth(resolver, handler)` — HOF; AppError → `{error, code, details}` JSON.

All 8 formerly copy-pasted scoping blocks are consolidated here.

## Data model

Core: users, offices, office_owner_links, office_property_links, properties, units, property_images, contacts, contracts, contract_payments, revenues, expenses, documents, tasks, conversations/messages, notifications, audit_logs, subscriptions, platform_settings.

006 additions: `payment_method` enum, `contracts.contract_number/office_id` (+partial unique), `tasks.assigned_to/sla_deadline/materials_cost/materials`, `office_invoice_counters`, `password_resets`, `notification_preferences/log/queue`.

Language rule: `payment_frequency` stored **English canonically** (monthly/quarterly/biannual/annual/weekly/one_time); GET maps to Arabic, POST/PUT map to English.

## Notifications

`dispatch()` → registry (in_app always + requested channels gated by availability/preferences/quiet-hours) → `notification_log` audit (pending→sent/failed) → providers: in-app (notifications table), email + sms (queue rows), tenant (virtual — fans out contact SMS/email via metadata.tenantId). Processor drains `notification_queue` every 5 min (boot in root layout) or via admin `/api/notifications/process`. Preferences API: `/api/notifications/preferences`.

Recipient rule: `notifications.user_id` FK → `users`; tenants are `contacts` → never used as in-app recipients (owned by owner/staff; tenant channel rides in metadata).

## Security

JWT (15m access / 7d refresh, token_version session invalidation) · CSRF double-submit · rate limiting (DB-backed) · bcrypt(12) passwords, SHA-256+timingSafeEqual reset tokens · uploads server-named + extension allowlists + path-containment guards · HSTS/CSP/headers · PDPL tenant-PII masking · audit logs · soft deletes.

## Feature modules

Tenant receipts (list + dual-auth PDF) · forgot-password (two APIs + two-state UI) · maintenance components (AssignmentSelect, SLABadge, MaterialsEditor, sla.ts) · automation engine (expiry → unit free → renewal tasks) · predictive maintenance (brain.js + LLM insights).

## Known debt

1. `dashboard/properties/page.tsx` ~6k-line monolith (extraction planned)
2. `properties/route.ts` & documents POST still legacy-style (unmigrated to scope)
3. Notifications: no preferences UI; SMS stub; processor relied on layout boot
4. ZATCA / EJAR integrations absent
5. Lint pipeline broken repo-wide (`next lint` config error); tsc is the gate