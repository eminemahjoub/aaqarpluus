-- ═══════════════════════════════════════════════════════════════
-- RLS Policies (owner_id multi-tenant)
-- Each authenticated user can only access rows where owner_id = auth.uid()
-- Applies to ALL core tables.
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.contacts enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_payments enable row level security;
alter table public.revenues enable row level security;
alter table public.expenses enable row level security;
alter table public.invoices enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;

-- Helper to (re)create standard owner policies
create or replace function public.apply_owner_policies(_table regclass)
returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists %I on %s', 'select_own', _table);
  execute format('create policy %I on %s for select to authenticated using (auth.uid() = owner_id)', 'select_own', _table);

  execute format('drop policy if exists %I on %s', 'insert_own', _table);
  execute format('create policy %I on %s for insert to authenticated with check (auth.uid() = owner_id)', 'insert_own', _table);

  execute format('drop policy if exists %I on %s', 'update_own', _table);
  execute format('create policy %I on %s for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id)', 'update_own', _table);

  execute format('drop policy if exists %I on %s', 'delete_own', _table);
  execute format('create policy %I on %s for delete to authenticated using (auth.uid() = owner_id)', 'delete_own', _table);
end;
$$;

-- Apply to all tables
select public.apply_owner_policies('public.profiles'::regclass);
select public.apply_owner_policies('public.properties'::regclass);
select public.apply_owner_policies('public.units'::regclass);
select public.apply_owner_policies('public.contacts'::regclass);
select public.apply_owner_policies('public.contracts'::regclass);
select public.apply_owner_policies('public.contract_payments'::regclass);
select public.apply_owner_policies('public.revenues'::regclass);
select public.apply_owner_policies('public.expenses'::regclass);
select public.apply_owner_policies('public.invoices'::regclass);
select public.apply_owner_policies('public.tasks'::regclass);
select public.apply_owner_policies('public.documents'::regclass);

