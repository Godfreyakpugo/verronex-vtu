-- ============================================================================
-- ADMIN USER SUMMARY
--
-- Returns active-user counts grouped by tier for the User Management dashboard.
-- Only counts profiles that have NOT been deactivated.
-- Does not fetch every user; runs the aggregation in SQL.
--
-- Statement to apply to the live project:
--   1. CREATE OR REPLACE FUNCTION public.admin_get_user_summary()
-- ============================================================================
create or replace function public.admin_get_user_summary()
returns table (
  user_tier text,
  active_count bigint
)
language sql
stable
security definer
set search_path to ''
as $func$
  select
    p.user_tier,
    count(*)::bigint as active_count
  from public.profiles p
  where p.deactivated_at is null
  group by p.user_tier
  order by p.user_tier;
$func$;

revoke execute on function public.admin_get_user_summary() from public, anon;
grant execute on function public.admin_get_user_summary() to authenticated;
grant execute on function public.admin_get_user_summary() to service_role;
