-- ============================================================================
-- admin_get_daily_accounting
-- Returns daily aggregated sales, cost, profit for successful transactions
-- Filtered by date range, admin-only
-- ============================================================================
create or replace function public.admin_get_daily_accounting(
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  day date,
  successful_transactions bigint,
  sales numeric,
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
  select
    (t.created_at at time zone 'Africa/Lagos')::date as day,
    count(*) as successful_transactions,
    sum(t.amount) as sales,
    sum(coalesce((t.metadata ->> 'cost_price')::numeric,
                 (t.metadata ->> 'provider_cost')::numeric,
                 0)) as cost,
    sum(t.amount) - sum(coalesce((t.metadata ->> 'cost_price')::numeric,
                                 (t.metadata ->> 'provider_cost')::numeric,
                                 0)) as profit
  from public.transactions t
  where t.status = 'successful'
    and t.category in ('data', 'airtime_purchase')
    and (t.created_at at time zone 'Africa/Lagos')::date between v_start and v_end
  group by (t.created_at at time zone 'Africa/Lagos')::date
  order by day desc;
end;
$$;

revoke execute on function public.admin_get_daily_accounting(date, date) from public;
revoke execute on function public.admin_get_daily_accounting(date, date) from anon;
grant execute on function public.admin_get_daily_accounting(date, date) to authenticated;
grant execute on function public.admin_get_daily_accounting(date, date) to service_role;