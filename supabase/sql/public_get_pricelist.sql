-- ============================================================================
-- public_get_pricelist
--
-- Public marketing pricelist data. Returns ONLY visitor-safe fields:
--   plans[]   : network, plan_name, selling_price, validity, plan_type
--               (active data_plans only)
--   airtime[]: network, user_discount (active networks only)
--
-- Deliberately EXCLUDES provider cost_price, admin_discount, api_plan_id,
-- network_id and every other internal field. SECURITY DEFINER so visitors
-- (anon) can call it without any table-level access to data_plans.
-- ============================================================================
create or replace function public.public_get_pricelist()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'plans',
    coalesce(
      (
        -- Mirror the customer-facing Buy Data catalog exactly:
        -- active only, no TALKMORE bundles, exact duplicates collapsed.
        select jsonb_agg(
          jsonb_build_object(
            'network', network,
            'plan_name', plan_name,
            'selling_price', selling_price,
            'validity', validity,
            'plan_type', plan_type
          ) order by network asc, selling_price asc
        )
        from (
          select distinct on (dp.network, dp.plan_name, dp.selling_price)
            dp.network, dp.plan_name, dp.selling_price, dp.validity, dp.plan_type
          from public.data_plans dp
          where dp.is_active = true
            and lower(coalesce(dp.plan_type, '')) not in ('talkmore')
          order by dp.network asc, dp.selling_price asc, dp.plan_name asc
        ) active_plans
      ),
      '[]'::jsonb
    ),
    'airtime',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'network', a.network,
            'user_discount', a.user_discount
          ) order by a.network asc
        )
        from public.airtime_settings a
        where a.is_active = true
      ),
      '[]'::jsonb
    )
  );
$$;

revoke execute on function public.public_get_pricelist() from public;
grant execute on function public.public_get_pricelist() to anon;
grant execute on function public.public_get_pricelist() to authenticated;
grant execute on function public.public_get_pricelist() to service_role;