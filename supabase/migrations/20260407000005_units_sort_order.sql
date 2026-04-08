-- Add sort_order column to units table for ordered display
alter table public.units add column if not exists sort_order int not null default 0;

create index if not exists units_property_sort_order_idx on public.units(property_id, sort_order asc);
