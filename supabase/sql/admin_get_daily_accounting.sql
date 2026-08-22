-- ============================================================================
-- admin_get_daily_accounting
-- Daily sales / cost / profit for successful VTU transactions (admin-only).
--
-- Sales = amount actually charged to the customer.
-- Cost  = actual provider (Gladtidings) cost recorded on the transaction:
--   data     -> metadata.plan_amount      (exact Gladtidings charge, merged
--                                            from the provider response on
--                                            completion; verified against the
--                                            provider wallet balance delta)
--            | metadata.cost_price        (stored at purchase time by
--                                            start_data_purchase)
--   airtime -> metadata.provider_cost    (stored at purchase time)
--            | face_value * (1 - admin_discount/100)
--                                           (both values captured at
--                                            purchase time in metadata)
-- Profit = Sales - Cost.
--
-- Only status='successful' rows in categories ('data','airtime_purchase') are
-- counted; wallet funding/debits and failed/pending/refunded rows are excluded.
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
    sum(
      case t.category
        when 'data' then
          coalesce(
            nullif(t.metadata ->> 'plan_amount', '')::numeric,
            nullif(t.metadata ->> 'cost_price', '')::numeric,
            0
          )
        when 'airtime_purchase' then
          coalesce(
            nullif(t.metadata ->> 'provider_cost', '')::numeric,
            round(
              nullif(t.metadata ->> 'face_value', '')::numeric
                * (1 - coalesce(nullif(t.metadata ->> 'admin_discount', '')::numeric, 0) / 100.0),
              2
            ),
            0
          )
        else 0
      end
    ) as cost,
    sum(t.amount) - sum(
      case t.category
        when 'data' then
          coalesce(
            nullif(t.metadata ->> 'plan_amount', '')::numeric,
            nullif(t.metadata ->> 'cost_price', '')::numeric,
            0
          )
        when 'airtime_purchase' then
          coalesce(
            nullif(t.metadata ->> 'provider_cost', '')::numeric,
            round(
              nullif(t.metadata ->> 'face_value', '')::numeric
                * (1 - coalesce(nullif(t.metadata ->> 'admin_discount', '')::numeric, 0) / 100.0),
              2
            ),
            0
          )
        else 0
      end
    ) as profit
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