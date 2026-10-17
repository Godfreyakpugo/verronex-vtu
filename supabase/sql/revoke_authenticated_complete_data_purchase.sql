-- =============================================================================
-- CHANGE 3b — revoke `authenticated` from the legacy completion RPC
-- STATUS: NOT APPLIED. RUN THIS LAST.
-- =============================================================================
-- PRECONDITIONS — all must be true before running:
--   1. complete_data_purchase_metadata_allowlist.sql  applied.
--   2. complete_data_purchase_server_only.sql         applied.
--   3. The updated purchase-data Edge Function is DEPLOYED and verified: it
--      calls complete_data_purchase_server with a service_role client.
--   4. At least one real successful data purchase has been confirmed to
--      finalise correctly after that deploy, and one refund path confirmed.
--   5. Nothing else in the codebase or in Supabase calls
--      complete_data_purchase. Verified in this repo: the only call site is
--      supabase/functions/purchase-data/index.ts. Re-check after any new code.
--
-- WHY THE ORDER MATTERS
--   Running this before the edge function deploy revokes the grant the OLD
--   function needs. Every successful data purchase would then fail to
--   finalise: money already debited, transaction stuck pending, and the
--   customer told "Transaction could not be completed". There is no safe
--   partial rollout here, hence the hard precondition list.
--
-- service_role IS RETAINED deliberately, so the previously deployed function
-- keeps working if you need to roll the edge function back.
-- =============================================================================

revoke execute on function public.complete_data_purchase(text, jsonb) from public;
revoke execute on function public.complete_data_purchase(text, jsonb) from anon;
revoke execute on function public.complete_data_purchase(text, jsonb) from authenticated;

-- Re-asserted for clarity; idempotent and already present in the live ACL.
grant execute on function public.complete_data_purchase(text, jsonb) to service_role;


-- -----------------------------------------------------------------------------
-- Post-condition check (read-only)
-- -----------------------------------------------------------------------------
-- Expected: acl no longer contains "authenticated=".
--
-- select p.proname, p.proacl
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname='public'
--   and p.proname in ('complete_data_purchase','complete_data_purchase_server')
-- order by p.proname;