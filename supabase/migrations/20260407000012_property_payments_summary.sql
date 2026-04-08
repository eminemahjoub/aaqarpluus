-- Payments summary per property (for dashboards).
-- Computes totals from contract_payments joined through contracts.

create or replace view public.v_property_payments_summary as
with p as (
  select
    c.owner_id,
    c.property_id,
    cp.id as payment_id,
    cp.due_date,
    cp.amount_sar,
    cp.status
  from public.contract_payments cp
  join public.contracts c on c.id = cp.contract_id
)
select
  owner_id,
  property_id,
  coalesce(sum(amount_sar), 0) as total_due_sar,
  coalesce(sum(amount_sar) filter (where status = 'paid'), 0) as total_paid_sar,
  coalesce(sum(amount_sar) filter (where status <> 'paid'), 0) as total_unpaid_sar,
  case
    when coalesce(sum(amount_sar),0) = 0 then 0
    else round((coalesce(sum(amount_sar) filter (where status = 'paid'),0) / coalesce(sum(amount_sar),0)) * 100, 2)
  end as collection_rate_percent,
  min(due_date) filter (where status <> 'paid') as next_due_date,
  (
    select cp2.amount_sar
    from public.contract_payments cp2
    join public.contracts c2 on c2.id = cp2.contract_id
    where c2.property_id = p.property_id
      and c2.owner_id = p.owner_id
      and cp2.status <> 'paid'
      and cp2.due_date is not null
    order by cp2.due_date asc, cp2.created_at asc
    limit 1
  ) as next_due_amount_sar
from p
group by owner_id, property_id;

