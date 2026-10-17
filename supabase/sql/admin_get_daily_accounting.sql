-- ============================================================================
-- admin_get_daily_accounting
-- Daily sales / cost / profit for successful VTU transactions (admin-only).
--
-- PRICE MEANING (do not invert this)
--   data_plans.cost_price    = what Gladtidings charges Verronex -> COST
--   data_plans.selling_price = what Verronex charges the customer -> SALES
--   transactions.amount      = customer charge -> SALES
--
-- Sales = transactions.amount for every successful row.
-- Cost  = the provider cost captured on the transaction at purchase time:
--   data     -> metadata.cost_price   (written by start_data_purchase)
--   airtime -> metadata.provider_cost (written by start_airtime_purchase)
--            | face_value * (1 - admin_discount/100)
--
-- metadata.plan_amount IS NOT USED AS A COST SOURCE. It is the customer charge.
-- The previous version preferred it, which reported the selling price as cost
-- and produced a profit figure of ~0 for data sales.
--
-- UNKNOWN COST IS REPORTED, NOT ZEROED
--   complete_data_purchase used to replace transaction metadata with the raw
--   provider body, destroying cost_price. Verified live: 158 of 159 successful
--   data transactions have no cost_price. For those rows the provider cost is
--   unknown and cannot be reconstructed (see
--   supabase/sql/report_data_cost_recoverability_READONLY.sql — 0 of 158 are
--   recoverable by plan matching).
--
--   Therefore cost and profit are computed ONLY over rows whose cost is known,
--   and the number of uncosted rows is returned alongside. A day's "cost" is
--   NOT a silent zero; cost_known_transactions / cost_unknown_transactions make
--   the coverage explicit, and profit must be read as
--   "profit on costed transactions only".
--
-- CHANGE OF RETURN TYPE
--   Two columns were added, so CREATE OR REPLACE is not possible (Postgres
--   cannot change OUT parameters). This file therefore DROPs and re-creates the
--   function. Apply the DROP and the CREATE back to back in one session.
--   Existing callers keep working: day, successful_transactions, sales, cost
--   and profit are all still present with the same names and meaning.
-- ============================================================================
drop function if exists public.admin_get_daily_accounting(date, date);

create function public.admin_get_daily_accounting(
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  day date,
  successful_transactions bigint,
  sales numeric,
  cost_known_transactions bigint,
  cost_unknown_transactions bigint,
  cost numeric,
  profit numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_end date;
begin
  -- Admin only
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- Default to last 30 days if no range provided
  v_start := coalesce(p_from_date, (now() - interval '30 days')::date);
  v_end := coalesce(p_to_date, now()::date);

  return query
  with costed as (
    select
      (t.created_at at time zone 'Africa/Lagos')::date as day,
      t.amount as amount,
      -- NULL means "provider cost unknown", never 0.
      case t.category
        when 'data' then
          nullif(t.metadata ->> 'cost_price', '')::numeric
        when 'airtime_purchase' then
          coalesce(
            nullif(t.metadata ->> 'provider_cost', '')::numeric,
            round(
              nullif(t.metadata ->> 'face_value', '')::numeric
                * (1 - coalesce(nullif(t.metadata ->> 'admin_discount', '')::numeric, 0) / 100.0),
              2
            )
          )
      end as cost
    from public.transactions t
    where t.status = 'successful'
      and t.category in ('data', 'airtime_purchase')
      and (t.created_at at time zone 'Africa/Lagos')::date between v_start and v_end
  )
  select
    c.day,
    count(*) as successful_transactions,
    sum(c.amount) as sales,
    count(*) filter (where c.cost is not null) as cost_known_transactions,
    count(*) filter (where c.cost is null) as cost_unknown_transactions,
    coalesce(sum(c.cost), 0) as cost,
    -- Profit only over rows we can actually cost. Including uncosted sales
    -- here would overstate profit by the full value of every unknown-cost row.
    coalesce(sum(c.amount) filter (where c.cost is not null), 0)
      - coalesce(sum(c.cost), 0) as profit
  from costed c
  group by c.day
  order by c.day desc;
end;
$$;

revoke execute on function public.admin_get_daily_accounting(date, date) from public;
revoke execute on function public.admin_get_daily_accounting(date, date) from anon;
grant execute on function public.admin_get_daily_accounting(date, date) to authenticated;
grant execute on function public.admin_get_daily_accounting(date, date) to service_role;