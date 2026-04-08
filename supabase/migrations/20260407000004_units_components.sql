-- Add JSONB components to units to persist the units builder UI.
-- This keeps the frontend feature "no mocks" while storing real data in Supabase.

alter table public.units
  add column if not exists components jsonb not null default '[]'::jsonb;

create index if not exists units_owner_id_property_id_idx
  on public.units (owner_id, property_id);

