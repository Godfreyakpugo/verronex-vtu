-- Expected after the follow-up rollout:
--   *_server: service_role=true; anon/authenticated=false
--   legacy RPCs: anon/authenticated/service_role=false

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
    'refund_purchase',
    'refund_purchase_server',
    'complete_data_purchase',
    'complete_data_purchase_server',
    'complete_airtime_purchase',
    'complete_airtime_purchase_server'
  )
order by p.proname;
