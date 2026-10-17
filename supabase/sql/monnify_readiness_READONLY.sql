-- Monnify launch readiness audit — READ ONLY
-- Run in the Supabase SQL Editor for the intended project.
-- This file contains SELECT statements only. It does not inspect payment rows,
-- change schema, alter policies, or enable/disable payment processing.

-- 1. Required tables and row-level security state.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in (
     'funding_requests', 'monnify_events', 'wallets', 'transactions', 'notifications'
   )
   and c.relkind = 'r'
 order by c.relname;

-- 2. Monnify columns expected by init-monnify-funding and monnify-webhook.
select expected.column_name,
       (actual.column_name is not null) as present
  from (values
    ('payment_reference'),
    ('transaction_reference'),
    ('monnify_status'),
    ('amount_paid'),
    ('webhook_payload'),
    ('verified_at')
  ) as expected(column_name)
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = 'funding_requests'
   and actual.column_name = expected.column_name
 order by expected.column_name;

-- 3. Existing policies on funding_requests. Review these before changing any
-- policy; the client needs own-row SELECT/INSERT and admins need list access.
select policyname,
       permissive,
       roles::text as roles,
       cmd,
       qual as using_expression,
       with_check
  from pg_policies
 where schemaname = 'public'
   and tablename = 'funding_requests'
 order by policyname;

-- 4. Direct table grants. monnify_events should not be directly available to
-- anon/authenticated; service_role needs access for webhook idempotency.
select table_name,
       grantee,
       privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name in ('funding_requests', 'monnify_events')
 order by table_name, grantee, privilege_type;

-- 5. RPC safety. Both functions should be SECURITY DEFINER with an empty
-- search_path; only service_role should be able to execute either one.
select p.oid::regprocedure::text as signature,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('process_monnify_funding', 'append_funding_verify_mismatch')
 order by p.proname;

-- 6. The Monnify idempotency key must be the transaction_reference primary key.
select i.relname as index_name,
       ix.indisprimary as is_primary,
       pg_get_indexdef(i.oid) as definition
  from pg_class t
  join pg_namespace n on n.oid = t.relnamespace
  join pg_index ix on ix.indrelid = t.oid
  join pg_class i on i.oid = ix.indexrelid
 where n.nspname = 'public'
   and t.relname = 'monnify_events'
 order by i.relname;
