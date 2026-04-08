-- Fix occupancy logic for properties.status
-- Treat a unit as occupied if it has an active contract whose dates include "today",
-- allowing open-ended contracts (end_date is null).

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
   and (c.start_date is null or c.start_date <= current_date)
   and (c.end_date is null or c.end_date >= current_date)
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

