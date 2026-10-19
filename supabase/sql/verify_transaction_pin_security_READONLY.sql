-- READ-ONLY deployment verification for transaction_pin_security.sql.

-- 1. PIN table RLS and client access. Expected: RLS true; all client privilege
--    flags false. service_role table access is intentionally server-only.
select
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
  has_table_privilege('anon', c.oid, 'INSERT') as anon_can_insert,
  has_table_privilege('anon', c.oid, 'UPDATE') as anon_can_update,
  has_table_privilege('anon', c.oid, 'DELETE') as anon_can_delete,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_can_update,
  has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_can_delete
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'transaction_pin_security';

-- 2. PIN table RLS policies. Expected: zero rows.
select policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'transaction_pin_security';

-- 3. Debit RPC grants. Expected: authenticated=false for every row;
--    service_role=true for the two *_with_pin RPCs and PIN setup/reminder RPCs;
--    transaction_pin_check is internal and should be false for both roles.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'start_data_purchase',
    'start_airtime_purchase',
    'transaction_pin_check',
    'start_data_purchase_with_pin',
    'start_airtime_purchase_with_pin',
    'transaction_pin_set',
    'transaction_pin_set_reminder'
  )
order by p.proname;
