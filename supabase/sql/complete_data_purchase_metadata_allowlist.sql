-- =============================================================================
-- CHANGE 1 — complete_data_purchase: preserve accounting metadata
-- STATUS: NOT APPLIED. Prepare and apply manually, one statement at a time.
-- =============================================================================
-- WHY
--   The live public.complete_data_purchase(text, jsonb) ends with:
--       metadata = coalesce(p_metadata, metadata)
--   and purchase-data/index.ts passes the raw Gladtidings body as p_metadata.
--   The result is a full REPLACE of the transaction metadata, so the fields
--   start_data_purchase wrote at purchase time are destroyed:
--       service, provider, plan_amount, cost_price, plan_name, plan_network,
--       network_id, api_plan_id
--   Confirmed live: of 159 successful `data` transactions, 158 have no
--   cost_price at all, and 158 carry raw provider keys (Status, client_ip,
--   mobile_number, Ported_number, ...) spliced in at the top level.
--
-- PRICE MEANING (do not invert this)
--   data_plans.cost_price    = what Gladtidings charges Verronex  -> COST
--   data_plans.selling_price = what Verronex charges the customer -> SALES
--   transactions.amount      = customer charge (== selling_price) -> SALES
--   metadata.plan_amount     = customer charge. NEVER a cost.
--   metadata.cost_price      = provider cost captured at purchase time -> COST
--
-- WHAT THIS DOES
--   1. Adds data_provider_allowlist(jsonb): reduces a raw provider body to a
--      fixed allowlist of troubleshooting fields. Deliberately EXCLUDES
--      personal / unnecessary data observed in the live rows:
--      client_ip, mobile_number, Ported_number, customer_reference.
--   2. Replaces complete_data_purchase's body so it merges instead of
--      replacing, and stores the allowlisted payload under provider_response.
--
-- COMPATIBILITY
--   Same signature (text, jsonb) -> boolean, same SECURITY DEFINER, same owner
--   (postgres), same SET search_path = ''. CREATE OR REPLACE preserves the
--   existing EXECUTE grants, so the currently deployed purchase-data keeps
--   working unchanged. Staged removal of the authenticated grant is a SEPARATE
--   file (revoke_authenticated_complete_data_purchase.sql) and must run last.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1a. Allowlist helper. Pure JSON, touches no table, so SECURITY INVOKER is
--     safe. search_path = '' with pg_catalog always implicitly searched.
-- -----------------------------------------------------------------------------
create or replace function public.data_provider_allowlist(p_raw jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'status',         nullif(left(coalesce(v.status, ''), 40), ''),
      'api_response',   nullif(left(coalesce(v.api_response, ''), 500), ''),
      -- Our reference, echoed back by the provider. Useful for reconciliation.
      'ident',          nullif(left(coalesce(v.ident, ''), 80), ''),
      'provider_id',    nullif(left(coalesce(v.id, v.topup_id, ''), 80), ''),
      'plan',           nullif(left(coalesce(v.plan, ''), 80), ''),
      'plan_name',      nullif(left(coalesce(v.plan_name, ''), 120), ''),
      'plan_network',   nullif(left(coalesce(v.plan_network, ''), 40), ''),
      'plan_type',      nullif(left(coalesce(v.plan_type, ''), 60), ''),
      'network',        nullif(left(coalesce(v.network, ''), 60), ''),
      'payment_medium', nullif(left(coalesce(v.payment_medium, ''), 40), ''),
      'duration',       nullif(left(coalesce(v.duration, ''), 40), ''),
      'provider_create_date',
                        nullif(left(coalesce(v.create_date, v.created_at, ''), 60), ''),
      -- Provider-echoed amount, retained as EVIDENCE ONLY.
      -- Semantics are the provider's, not Verronex's: this is NOT our cost and
      -- must never be read as one. Accounting reads metadata.cost_price only.
      'provider_plan_amount', v.plan_amount
    )
  )
from (
    -- Lowercase the keys so the allowlist matches regardless of the casing the
    -- provider happens to use. jsonb_each() RAISES on an array or a scalar, and
    -- p_metadata is caller-supplied, so the object test must come first.
    -- jsonb_each's output columns are (key, value); alias them explicitly.
    select coalesce(jsonb_object_agg(lower(e.k), e.v), '{}'::jsonb) as v
    from jsonb_each(
      case when jsonb_typeof(p_raw) = 'object' then p_raw else '{}'::jsonb end
    ) as e(k, v)
  ) s;
$$;

revoke execute on function public.data_provider_allowlist(jsonb) from public, anon, authenticated;
grant  execute on function public.data_provider_allowlist(jsonb) to service_role;


-- -----------------------------------------------------------------------------
-- 1b. Patch the completion RPC. Signature, owner, SECURITY DEFINER and
--     search_path are deliberately unchanged.
-- -----------------------------------------------------------------------------
create or replace function public.complete_data_purchase(
  p_reference text,
  p_metadata  jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed boolean;
begin
  update public.transactions as t
     set status = 'successful',
         -- Shallow merge: every existing top-level key (plan_amount,
         -- cost_price, plan_name, plan_network, network_id, api_plan_id,
         -- service, provider) is preserved. Only `provider_response` is
         -- written, and it holds the allowlisted subset — never the raw body.
         --
         -- NULL behaviour:
         --   t.metadata NULL -> '{}', so the result is the provider block only
         --   p_metadata NULL -> allowlist returns '{}', so metadata keeps its
         --                      existing keys and provider_response is reset to
         --                      '{}' (status stays 'successful')
         --   neither NULL    -> normal merge
         metadata = coalesce(t.metadata, '{}'::jsonb)
                  || jsonb_build_object(
                       'provider_response',
                       public.data_provider_allowlist(p_metadata)
                     )
   where t.reference = p_reference
     and t.user_id   = auth.uid()
     and t.status    = 'pending'
  returning true into v_completed;

  return coalesce(v_completed, false);
end;
$$;

-- No revoke/grant here on purpose: CREATE OR REPLACE keeps the existing ACL
-- ({postgres, authenticated, service_role}). Narrowing it is a separate,
-- later step so this change can ship without touching the deployed caller.