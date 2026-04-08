-- Automatically maintain properties.status based on unit occupancy.
-- Rule:
-- - If property has 0 units: keep current status (don't force)
-- - If all units are occupied (100%): status -> 'active' (مؤجرة)
-- - Otherwise: status -> 'vacant' (شاغرة)
-- - If status is 'expired', we do not override it.

create or replace function public.sync_property_status(_property_id uuid)
returns void
language plpgsql
as $$
declare
  tot int;
  occ int;
  cur_status public.property_status;
begin
  select status into cur_status
  from public.properties
  where id = _property_id;

  if cur_status is null then
    return;
  end if;

  if cur_status = 'expired' then
    return;
  end if;

  select
    count(u.id)::int as total_units,
    count(u.id) filter (where c.id is not null)::int as occupied_units
  into tot, occ
  from public.units u
  left join public.contracts c
    on c.unit_id = u.id
   and c.status = 'active'
   and current_date between c.start_date and c.end_date
  where u.property_id = _property_id;

  if tot is null or tot = 0 then
    return;
  end if;

  if occ = tot then
    update public.properties set status = 'active' where id = _property_id and status <> 'expired';
  else
    update public.properties set status = 'vacant' where id = _property_id and status <> 'expired';
  end if;
end;
$$;

create or replace function public.trg_sync_property_status_from_contracts()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.sync_property_status(new.property_id);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.property_id is distinct from new.property_id then
      perform public.sync_property_status(old.property_id);
    end if;
    perform public.sync_property_status(new.property_id);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.sync_property_status(old.property_id);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_property_status_contracts on public.contracts;
create trigger sync_property_status_contracts
after insert or update or delete on public.contracts
for each row execute function public.trg_sync_property_status_from_contracts();

create or replace function public.trg_sync_property_status_from_units()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.sync_property_status(new.property_id);
    return new;
  elsif tg_op = 'UPDATE' then
    if old.property_id is distinct from new.property_id then
      perform public.sync_property_status(old.property_id);
    end if;
    perform public.sync_property_status(new.property_id);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.sync_property_status(old.property_id);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_property_status_units on public.units;
create trigger sync_property_status_units
after insert or update or delete on public.units
for each row execute function public.trg_sync_property_status_from_units();

