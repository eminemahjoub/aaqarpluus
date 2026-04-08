-- Add Hijri date mirrors for key date fields.
-- We store Hijri as a simple text "YYYY-MM-DD" (Hijri calendar) computed in the app.

alter table public.contracts
  add column if not exists start_date_hijri text,
  add column if not exists end_date_hijri text,
  add column if not exists actual_end_date_hijri text;

alter table public.contract_payments
  add column if not exists due_date_hijri text,
  add column if not exists paid_at_hijri text;

alter table public.revenues
  add column if not exists received_at_hijri text;

alter table public.expenses
  add column if not exists paid_at_hijri text;

alter table public.invoices
  add column if not exists issue_date_hijri text,
  add column if not exists due_date_hijri text;

alter table public.tasks
  add column if not exists due_date_hijri text;

