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
        select jsonb_agg(
          jsonb_build_object(
            'network', dp.network,
            'plan_name', dp.plan_name,
            'selling_price', dp.selling_price,
            'validity', dp.validity,
            'plan_type', dp.plan_type
          ) order by dp.network asc, dp.selling_price asc
        )
        from public.data_plans dp
        where dp.is_active = true
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