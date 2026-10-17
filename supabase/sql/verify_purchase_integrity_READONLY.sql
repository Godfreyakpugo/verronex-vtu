-- =============================================================================
-- READ-ONLY VERIFICATION — after manually applying the SQL changes
-- Contains SELECTs only. Run one statement at a time; the Supabase CLI prints
-- only the LAST result set, so do not paste them as a single batch.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- V1. Function definitions, settings, owner and EXECUTE grants
-- Expected after the full rollout:
--   complete_data_purchase_server   owner postgres, security_definer t,
--                                   search_path="", acl = {postgres, service_role}
--   complete_data_purchase          owner postgres, security_definer t,
--                                   search_path="", acl = {postgres, service_role}
--                                   (authenticated must be GONE)
--   refund_purchase                 owner postgres, security_definer t,
--                                   search_path="", acl = {postgres, authenticated}
--                                   (must NOT contain service_role)
--   admin_get_daily_accounting      owner postgres, security_definer t,
--                                   7 OUT columns incl. cost_known_transactions
--                                   and cost_unknown_transactions
-- -----------------------------------------------------------------------------
select p.proname,
       p.oid::regprocedure      as signature,
       p.prosecdef              as security_definer,
       pg_get_userbyid(p.proowner) as owner,
       p.proconfig              as function_settings,
       p.proacl                 as acl,
       p.pronargs,
       p.prorettype::regtype    as returns_scalar
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
        'complete_data_purchase',
        'complete_data_purchase_server',
        'refund_purchase',
        'admin_get_daily_accounting',
        'data_provider_allowlist'
      )
order by p.proname, p.oid::regprocedure::text;

-- OUT-parameter list for admin_get_daily_accounting (proves the new columns):
-- select p.proname, p.proargnames, p.proargtypes
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname='public' and p.proname='admin_get_daily_accounting';


-- -----------------------------------------------------------------------------
-- V2. Allowlist excludes personal / unnecessary fields
-- Run a sample live payload shape through the helper and confirm client_ip,
-- mobile_number, Ported_number and customer_reference are absent.
-- Expected: none of those four keys present; status/api_response/ident present.
-- -----------------------------------------------------------------------------
select public.data_provider_allowlist(
  '{"Status":"successful",
    "api_response":"ok",
    "ident":"DATA-1-abc",
    "id":987,
    "plan":"2GB",
    "plan_name":"2GB monthly",
    "plan_amount":"800.00",
    "network":"MTN",
    "payment_medium":"bank",
    "duration":"30",
    "create_date":"2026-10-01 10:00:00",
    "client_ip":"203.0.113.9",
    "mobile_number":"08037408580",
    "Ported_number":true,
    "customer_reference":"CUST-42",
    "unmapped_secret":"zzz"}'::jsonb
) as allowlisted;


-- -----------------------------------------------------------------------------
-- V3. Non-object / NULL input safety (must not raise)
-- Expected: '{}' for each of these.
-- -----------------------------------------------------------------------------
select public.data_provider_allowlist(null)                as from_null,
       public.data_provider_allowlist('[]'::jsonb)         as from_array,
       public.data_provider_allowlist('"a string"'::jsonb) as from_scalar,
       public.data_provider_allowlist('{}'::jsonb)         as from_empty_object;


-- -----------------------------------------------------------------------------
-- V4. cost_price preservation on NEW data purchases
-- Run AFTER at least one real successful data purchase post-deploy.
-- Expected for recent rows:
--   has_cost_price        = all
--   has_plan_amount       = all
--   has_provider_response = all
--   has_client_ip         = 0   <-- regression signal for the old overwrite
--   has_mobile_number     = 0
--   has_ported_number     = 0
--   has_status_at_top     = 0   <-- provider status must be nested only
-- -----------------------------------------------------------------------------
select
  status,
  count(*)                                                as rows,
  count(*) filter (where metadata ? 'cost_price')        as has_cost_price,
  count(*) filter (where metadata ? 'plan_amount')       as has_plan_amount,
  count(*) filter (where metadata ? 'network_id')        as has_network_id,
  count(*) filter (where metadata ? 'api_plan_id')       as has_api_plan_id,
  count(*) filter (where metadata ? 'provider_response') as has_provider_response,
  count(*) filter (where metadata ? 'client_ip')         as has_client_ip,
  count(*) filter (where metadata ? 'mobile_number')     as has_mobile_number,
  count(*) filter (where metadata ? 'Ported_number')     as has_ported_number,
  count(*) filter (where metadata ? 'Status')            as status_splatted_at_top
from public.transactions
where category = 'data'
group by status
order by status;


-- -----------------------------------------------------------------------------
-- V5. Separate NEW rows from HISTORICAL rows that lost cost_price
-- `is_historical_unrecoverable` is the pre-fix population. New rows must be 0.
-- -----------------------------------------------------------------------------
select
  case
    when created_at < timestamptz '2026-10-07 00:00:00+00' then 'historical_pre_fix'
    else 'new_post_fix'
  end                                          as cohort,
  count(*)                                     as rows,
  count(*) filter (where nullif(metadata ->> 'cost_price','') is null) as missing_cost,
  count(*) filter (where nullif(metadata ->> 'cost_price','') is not null) as has_cost
from public.transactions
where category = 'data' and status = 'successful'
group by 1
order by 1;


-- -----------------------------------------------------------------------------
-- V6. Accounting totals now come from cost_price, and coverage is explicit
-- Cross-check against admin_get_daily_accounting's own output for the same range.
-- -----------------------------------------------------------------------------
with d as (
  select t.amount as amount,
         nullif(t.metadata ->> 'cost_price', '')::numeric as cost
    from public.transactions t
   where t.category = 'data' and t.status = 'successful'
)
select
  count(*)                                              as rows,
  count(*) filter (where cost is null)                  as cost_unknown,
  round(sum(amount), 2)                                 as sales_all_rows,
  round(sum(amount) filter (where cost is not null), 2) as sales_costed_rows,
  round(sum(cost), 2)                                   as cost_known_only,
  round(sum(amount) filter (where cost is not null) - sum(cost), 2) as profit_costed_only
from d;


-- -----------------------------------------------------------------------------
-- V7. Refund ledger gap (relevant only if the OPTIONAL ledger patch is applied)
-- Before: unexplained_difference grows with every refund.
-- After:  a matching credit / wallet_refund row exists per refund.
-- -----------------------------------------------------------------------------
select
  (select round(coalesce(sum(balance), 0), 2) from public.wallets) as total_wallet_balances,
  (select count(*) from public.transactions where category = 'wallet_refund') as refund_ledger_rows,
  (select count(*) from public.transactions
    where category in ('data','airtime_purchase') and status = 'failed') as failed_purchases;