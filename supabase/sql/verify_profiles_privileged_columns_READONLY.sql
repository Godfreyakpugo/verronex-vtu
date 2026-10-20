-- Read-only verification for harden_profiles_privileged_columns.sql.
-- Run after applying the fix. Every row should report the expected value.

select 'guard_trigger_present' as check_name,
       (select count(*)::int
          from pg_trigger
         where tgrelid = 'public.profiles'::regclass
           and tgname = 'guard_profile_privileged_columns'
           and not tgisinternal) as value,
       '1' as expected
union all
select 'guard_is_security_invoker',
       (select case when p.prosecdef then 0 else 1 end
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = 'guard_profile_privileged_columns'),
       '1'
union all
select 'guard_search_path_pinned',
       (select case when exists (
                 select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c
                  where c like 'search_path=%'
               ) then 1 else 0 end
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = 'guard_profile_privileged_columns'),
       '1'
union all
select 'protected_columns_updatable_by_authenticated',
       (select count(*)::int
          from information_schema.column_privileges
         where table_schema = 'public'
           and table_name = 'profiles'
           and grantee = 'authenticated'
           and privilege_type = 'UPDATE'
           and column_name in (
             'is_admin', 'user_tier', 'verification_status',
             'bvn_verified', 'nin_verified', 'deactivated_at'
           )),
       '0 (informational; the trigger is the enforcement point)'
union all
select 'is_admin_still_executable',
       (select case when has_function_privilege(
                 'authenticated', 'public.is_admin()', 'execute'
               ) then 1 else 0 end),
       '1 (needed by RLS policies)';
