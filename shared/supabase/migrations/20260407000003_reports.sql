-- ═══════════════════════════════════════════════════════════════
-- Report views (owner-scoped via RLS)
-- These views are safe to expose since base tables are protected by RLS.
-- ═══════════════════════════════════════════════════════════════

-- Total revenue per property (paid payments + paid revenues)
create or replace view public.v_property_total_revenue as
select
  p.id as property_id,
  p.owner_id,
  p.name,
  coalesce(sum(cp.amount_sar) filter (where cp.status = 'paid'), 0) +
  coalesce(sum(r.amount_sar) filter (where r.status = 'paid'), 0) as total_revenue_sar
from public.properties p
left join public.contracts c on c.property_id = p.id
left join public.contract_payments cp on cp.contract_id = c.id
left join public.revenues r on r.property_id = p.id
group by p.id, p.owner_id, p.name;

-- Monthly net income (income - expenses)
create or replace view public.v_monthly_net_income as
with paid_income as (
  select date_trunc('month', cp.paid_at) as month, c.owner_id, sum(cp.amount_sar) as amount
  from public.contract_payments cp
  join public.contracts c on c.id = cp.contract_id
  where cp.status = 'paid' and cp.paid_at is not null
  group by 1, 2
  union all
  select date_trunc('month', r.received_at) as month, r.owner_id, sum(r.amount_sar) as amount
  from public.revenues r
  where r.status = 'paid' and r.received_at is not null
  group by 1, 2
),
paid_expenses as (
  select date_trunc('month', e.paid_at) as month, e.owner_id, sum(e.amount_sar) as amount
  from public.expenses e
  where e.status = 'paid' and e.paid_at is not null
  group by 1, 2
)
select
  i.owner_id,
  i.month,
  coalesce(sum(i.amount),0) as income_sar,
  coalesce(e.amount,0) as expenses_sar,
  coalesce(sum(i.amount),0) - coalesce(e.amount,0) as net_sar
from paid_income i
left join paid_expenses e on e.owner_id = i.owner_id and e.month = i.month
group by i.owner_id, i.month, e.amount;

-- Occupancy rate per property (contracts linked to units)
create or replace view public.v_property_occupancy_rate as
with active_unit_contracts as (
  select distinct owner_id, unit_id
  from public.contracts
  where status = 'active'
    and unit_id is not null
    and current_date between start_date and end_date
)
select
  p.id as property_id,
  p.owner_id,
  p.name,
  count(u.id) as total_units,
  count(u.id) filter (where auc.unit_id is not null) as occupied_units,
  case when count(u.id)=0 then 0
       else round((count(u.id) filter (where auc.unit_id is not null))::numeric / count(u.id) * 100, 2)
  end as occupancy_rate_percent
from public.properties p
left join public.units u on u.property_id = p.id
left join active_unit_contracts auc on auc.owner_id = p.owner_id and auc.unit_id = u.id
group by p.id, p.owner_id, p.name;

