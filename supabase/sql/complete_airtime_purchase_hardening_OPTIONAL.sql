-- =============================================================================
-- CHANGE 6 (REPORT ONLY — NOT IN THE REQUIRED ROLLOUT) — complete_airtime_purchase
-- STATUS: NOT APPLIED. Reported for review. supabase/sql/airtime_purchase_rpcs.sql
--          has deliberately NOT been modified, per instruction.
-- =============================================================================
-- FINDINGS FROM THE LIVE DEFINITION (read-only, verified 2026-10-07)
--
--   complete_airtime_purchase(text, jsonb)
--     owner             postgres
--     security_definer  true
--     function_settings [search_path=public]      <-- weaker than the data RPC
--     acl               {postgres, authenticated, service_role}
--
--   1. SAME SELF-COMPLETION EXPOSURE, AND WORSE.
--      EXECUTE is granted to `authenticated`, so any signed-in customer can
--      call it directly on their OWN pending airtime reference and mark the
--      purchase successful with no provider confirmation.
--
--   2. NULL-UNSAFE OWNERSHIP CHECK — AND HERE IT IS REACHABLE.
--      The body uses:
--          if v_tx.user_id <> auth.uid() then raise exception 'Not authorized.'; end if;
--      transactions.user_id is NOT NULL, so a NULL auth.uid() makes the
--      comparison NULL, `IF NULL` is not taken, and the check is skipped.
--      Unlike refund_purchase, this one is NOT merely latent: service_role IS in
--      the live ACL, and a service_role JWT has no `sub`, so any caller holding
--      the service key can complete ANY pending transaction regardless of owner.
--      The data equivalent escaped this only because it put `user_id = auth.uid()`
--      in the WHERE clause, where a NULL auth.uid() simply matches nothing.
--
--   3. search_path = 'public' WITH UNQUALIFIED REFERENCES.
--      The body does `from transactions` and `update transactions` without the
--      public. prefix. pg_temp is still searched first, so the ledger table is
--      shadowable by a temporary table of the same name. Every other hardened
--      RPC in this repo uses `set search_path = ''` plus fully-qualified names.
--
--   WHAT IT GETES RIGHT (keep these)
--     * metadata is MERGED, not replaced:
--       metadata = coalesce(v_tx.metadata,'{}') || coalesce(p_metadata,'{}')
--       so accounting fields (face_value, selling_price, provider_cost,
--       phone_number, discounts) survive completion.
--     * Idempotent: returns true when status is already 'successful'.
--     * status must be 'pending' otherwise it raises, and it raises
--       'Transaction not found.' instead of returning a silent false.
--
-- EQUIVALENT STAGED FIX REQUIRED (same three-stage shape as the data RPC)
--   Stage 1 — apply the function below. It adds a service-role-only RPC and
--             also hardens search_path and the NULL check in the legacy body.
--             The legacy body keeps its signature, SECURITY DEFINER, owner and
--             its `authenticated` grant, so the deployed purchase-airtime edge
--             function is unaffected.
--   Stage 2 — deploy purchase-airtime calling complete_airtime_purchase_server
--             with a service-role client.
--   Stage 3 — run the revoke at the bottom of this file.
--
--   Applying this file requires deploying purchase-airtime afterwards; it is
--   deliberately excluded from the required rollout for that reason.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Stage 1a — service-role-only completion for airtime
-- -----------------------------------------------------------------------------
create or replace function public.complete_airtime_purchase_server(
  p_reference text,
  p_metadata  jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized.';
  end if;

  select t.*
    into v_tx
    from public.transactions as t
   where t.reference = p_reference
     for update;

  if not found then
    raise exception 'Transaction not found.';
  end if;

  if v_tx.status = 'successful' then
    return true;
  end if;

  if v_tx.status <> 'pending' then
    raise exception 'Transaction cannot be completed (status: %).', v_tx.status;
  end if;

  update public.transactions as t
     set status   = 'successful',
         metadata = coalesce(v_tx.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
   where t.id = v_tx.id;

  return true;
end;
$$;

revoke execute on function public.complete_airtime_purchase_server(text, jsonb) from public;
revoke execute on function public.complete_airtime_purchase_server(text, jsonb) from anon;
revoke execute on function public.complete_airtime_purchase_server(text, jsonb) from authenticated;
grant  execute on function public.complete_airtime_purchase_server(text, jsonb) to service_role;


-- -----------------------------------------------------------------------------
-- Stage 1b — harden the legacy function in place: empty search_path, fully
--             qualified names, NULL-safe ownership check. Signature, owner,
--             SECURITY DEFINER and the existing `authenticated` grant are kept
--             so nothing breaks before Stage 2.
-- -----------------------------------------------------------------------------
create or replace function public.complete_airtime_purchase(
  p_reference text,
  p_metadata  jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions%rowtype;
begin
  select t.*
    into v_tx
    from public.transactions as t
   where t.reference = p_reference
     for update;

  if not found then
    raise exception 'Transaction not found.';
  end if;

  -- Explicit NULL test first: without it a NULL auth.uid() skips the check.
  if auth.uid() is null or v_tx.user_id is distinct from auth.uid() then
    raise exception 'Not authorized.';
  end if;

  if v_tx.status = 'successful' then
    return true;
  end if;

  if v_tx.status <> 'pending' then
    raise exception 'Transaction cannot be completed (status: %).', v_tx.status;
  end if;

  update public.transactions as t
     set status   = 'successful',
         metadata = coalesce(v_tx.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
   where t.id = v_tx.id;

  return true;
end;
$$;


-- -----------------------------------------------------------------------------
-- Stage 3 — RUN LAST, only after purchase-airtime is deployed and verified
-- -----------------------------------------------------------------------------
-- revoke execute on function public.complete_airtime_purchase(text, jsonb) from public;
-- revoke execute on function public.complete_airtime_purchase(text, jsonb) from anon;
-- revoke execute on function public.complete_airtime_purchase(text, jsonb) from authenticated;
-- grant  execute on function public.complete_airtime_purchase(text, jsonb) to service_role;