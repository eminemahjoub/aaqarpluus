-- ═══════════════════════════════════════════════════════════════
-- Real Estate SaaS Core Schema (multi-tenant per owner_id)
-- - Supabase Auth (auth.users)
-- - PostgreSQL tables for dashboard features
-- - Triggers for updated_at
-- ═══════════════════════════════════════════════════════════════

-- Extensions
create extension if not exists "pgcrypto";

-- Keep this function available for all updated_at triggers.
-- Safe to re-create (idempotent).
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────
-- ENUMS
-- ───────────────────────────────────────────────────────────────
do $$ begin
  create type public.contact_type as enum ('tenant','owner','service_provider','client','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.property_status as enum ('active','expired','vacant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_status as enum ('active','ended','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending','paid','failed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash','transfer','card','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('draft','sent','paid','overdue','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('pending','completed','overdue','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_type as enum ('image','pdf','excel','doc','other');
exception when duplicate_object then null; end $$;

-- ───────────────────────────────────────────────────────────────
-- PROFILES (each user is an OWNER)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  user_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_owner_equals_id check (owner_id = id)
);

create index if not exists profiles_owner_id_idx on public.profiles(owner_id);

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- Auto-create profile row on signup (in addition to any existing auth triggers)
create or replace function public.handle_new_user_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, owner_id, full_name, phone, user_type)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'user_type', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profiles on auth.users;
create trigger on_auth_user_created_profiles
after insert on auth.users
for each row execute function public.handle_new_user_profiles();

-- ───────────────────────────────────────────────────────────────
-- PROPERTIES
-- ───────────────────────────────────────────────────────────────
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  title text,
  property_model_type text,
  status public.property_status not null default 'active',

  region text,
  city text,
  neighborhood text,
  address text,

  units_count int not null default 0,
  apartments_count int not null default 0,
  shops_count int not null default 0,
  other_units_count int not null default 0,
  unit_identifiers text,

  area_m2 numeric(12,2),
  property_cost numeric(14,2),
  annual_rent_expected numeric(14,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_owner_id_idx on public.properties(owner_id);
create index if not exists properties_owner_created_at_idx on public.properties(owner_id, created_at desc);

drop trigger if exists update_properties_updated_at on public.properties;
create trigger update_properties_updated_at
before update on public.properties
for each row execute function public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────
-- UNITS
-- ───────────────────────────────────────────────────────────────
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  property_id uuid not null references public.properties(id) on delete cascade,

  label text not null,
  unit_type text,
  bedrooms int,
  bathrooms int,
  living_rooms int,

  price_sar numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists units_owner_id_idx on public.units(owner_id);
create index if not exists units_property_id_idx on public.units(property_id);
create index if not exists units_property_created_at_idx on public.units(property_id, created_at desc);

drop trigger if exists update_units_updated_at on public.units;
create trigger update_units_updated_at
before update on public.units
for each row execute function public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────
-- CONTACTS
-- ───────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  phone text,
  alternative_phone text,
  type public.contact_type not null default 'other',
  status text not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_owner_id_idx on public.contacts(owner_id);
create index if not exists contacts_owner_type_idx on public.contacts(owner_id, type);

drop trigger if exists update_contacts_updated_at on public.contacts;
create trigger update_contacts_updated_at
before update on public.contacts
for each row execute function public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────
-- CONTRACTS
-- ───────────────────────────────────────────────────────────────
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  contact_id uuid not null references public.contacts(id) on delete restrict,

  contract_number text,
  status public.contract_status not null default 'active',

  start_date date not null,
  end_date date not null,
  actual_end_date date,

  rent_total_sar numeric(14,2) not null default 0,
  billing_cycle text,

  terms text,
  notes text,
  extra jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contracts_owner_id_idx on public.contracts(owner_id);
create index if not exists contracts_property_id_idx on public.contracts(property_id);
create index if not exists contracts_contact_id_idx on public.contracts(contact_id);
create index if not exists contracts_owner_status_idx on public.contracts(owner_id, status);
create unique index if not exists contracts_owner_contract_number_uq
  on public.contracts(owner_id, contract_number)
  where contract_number is not null;

drop trigger if exists update_contracts_updated_at on public.contracts;
create trigger update_contracts_updated_at
before update on public.contracts
for each row execute function public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────
-- CONTRACT PAYMENTS (INSTALLMENTS)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.contract_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  contract_id uuid not null references public.contracts(id) on delete cascade,
  due_date date,
  paid_at timestamptz,
  amount_sar numeric(14,2) not null default 0,
  status public.payment_status not null default 'pending',
  method public.payment_method,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_payments_owner_id_idx on public.contract_payments(owner_id);
create index if not exists contract_payments_contract_id_idx on public.contract_payments(contract_id);
create index if not exists contract_payments_owner_paid_at_idx on public.contract_payments(owner_id, paid_at desc);
create index if not exists contract_payments_owner_status_idx on public.contract_payments(owner_id, status);

drop trigger if exists update_contract_payments_updated_at on public.contract_payments;
create trigger update_contract_payments_updated_at
before update on public.contract_payments
for each row execute function public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────
-- REVENUES
-- ───────────────────────────────────────────────────────────────
create table if not exists public.revenues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,

  type text not null,
  amount_sar numeric(14,2) not null default 0,
  status public.payment_status not null default 'paid',
  received_at timestamptz,
  method public.payment_method,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists revenues_owner_id_idx on public.revenues(owner_id);
create index if not exists revenues_property_id_idx on public.revenues(property_id);
create index if not exists revenues_owner_received_at_idx on public.revenues(owner_id, received_at desc);

drop trigger if exists update_revenues_updated_at on public.revenues;
create trigger update_revenues_updated_at
before update on public.revenues
for each row execute function public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────
-- EXPENSES
-- ───────────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,

  type text not null,
  amount_sar numeric(14,2) not null default 0,
  status public.payment_status not null default 'paid',
  paid_at timestamptz,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_owner_id_idx on public.expenses(owner_id);
create index if not exists expenses_property_id_idx on public.expenses(property_id);
create index if not exists expenses_owner_paid_at_idx on public.expenses(owner_id, paid_at desc);

drop trigger if exists update_expenses_updated_at on public.expenses;
create trigger update_expenses_updated_at
before update on public.expenses
for each row execute function public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────
-- INVOICES
-- ───────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  property_id uuid not null references public.properties(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,

  invoice_number text,
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,

  subtotal_sar numeric(14,2) not null default 0,
  tax_sar numeric(14,2) not null default 0,
  total_sar numeric(14,2) not null default 0,

  notes text,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_owner_id_idx on public.invoices(owner_id);
create index if not exists invoices_property_id_idx on public.invoices(property_id);
create unique index if not exists invoices_owner_invoice_number_uq
  on public.invoices(owner_id, invoice_number)
  where invoice_number is not null;

drop trigger if exists update_invoices_updated_at on public.invoices;
create trigger update_invoices_updated_at
before update on public.invoices
for each row execute function public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────
-- TASKS
-- ───────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  property_id uuid references public.properties(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,

  title text not null,
  description text,
  due_date date,
  status public.task_status not null default 'pending',
  priority text not null default 'medium',
  cost_sar numeric(14,2) not null default 0,
  attachments jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_owner_id_idx on public.tasks(owner_id);
create index if not exists tasks_owner_due_date_idx on public.tasks(owner_id, due_date);
create index if not exists tasks_owner_status_idx on public.tasks(owner_id, status);

drop trigger if exists update_tasks_updated_at on public.tasks;
create trigger update_tasks_updated_at
before update on public.tasks
for each row execute function public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────
-- DOCUMENTS (metadata; binary in Storage)
-- Linked to property OR contract (exclusive)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  property_id uuid references public.properties(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete cascade,

  bucket text not null,        -- 'documents' or 'property-images'
  object_path text not null,   -- storage.objects.name
  file_name text not null,
  mime_type text,
  type public.document_type not null default 'other',
  size_bytes bigint,
  public_url text,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_link_check check (
    (property_id is not null and contract_id is null)
    or (property_id is null and contract_id is not null)
  )
);

create index if not exists documents_owner_id_idx on public.documents(owner_id);
create index if not exists documents_property_id_idx on public.documents(property_id);
create index if not exists documents_contract_id_idx on public.documents(contract_id);
create index if not exists documents_bucket_path_idx on public.documents(bucket, object_path);

drop trigger if exists update_documents_updated_at on public.documents;
create trigger update_documents_updated_at
before update on public.documents
for each row execute function public.update_updated_at_column();

