-- =============================================================================
-- CHANGE 3a — new service-role-only completion RPC (backward-compatible stage)
-- STATUS: NOT APPLIED. Prepare and apply manually, one statement at a time.
-- =============================================================================
-- WHY A NEW FUNCTION INSTEAD OF CHANGING THE EXISTING ONE
--   public.complete_data_purchase is currently granted to `authenticated`, so
--   any signed-in customer can call it directly on their OWN pending reference
--   and mark that purchase `successful` with no provider confirmation at all.
--   Flipping the existing function to service-role-only in the same change
--   would immediately break the deployed purchase-data edge function (which
--   calls it with the customer's JWT, i.e. as `authenticated`) and leave
--   purchases debited-but-stuck-pending.
--
--   So the transition is staged across three files:
--     1. complete_data_purchase_metadata_allowlist.sql  (metadata fix, grants
--        untouched — safe to ship first)
--     2. THIS FILE                                      (new server-only RPC;
--        nothing calls it yet, so it is inert)
--     3. revoke_authenticated_complete_data_purchase.sql (run LAST, after the
--        edge function is deployed and verified)
--
-- SECURITY MODEL
--   Defences, in order:
--     * EXECUTE granted only to service_role. End users cannot reach it.
--     * An in-body assertion that the caller really is service_role, so the
--       function fails closed even if the grants are later widened by mistake.
--       auth.role() was verified live: it reads request.jwt.claim.role /
--       request.jwt.claims->>'role' and returns NULL outside a JWT request.
--     * status = 'pending' required, so an already-settled transaction cannot
--       be re-completed or flipped from failed/refunded to successful.
--     * transactions.reference is UNIQUE (verified live), and purchase-data
--       mints it server-side as "DATA-<epoch_ms>-<8 hex>", so the row this
--       addresses is unambiguous.
--
--   DELIBERATELY NOT DONE HERE
--     * No p_user_id parameter. Adding one would make
--       CREATE OR REPLACE ...(text, jsonb, uuid) create an extra OVERLOAD and
--       leave the exploitable two-argument version alive with its
--       `authenticated` grant. Keeping the existing signature avoids that.
--     * No service_role grant on refund_purchase. refund_purchase must stay
--       user-scoped so auth.uid() is meaningful there.
-- =============================================================================

create or replace function public.complete_data_purchase_server(
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
  -- Defence in depth. Unreachable for `authenticated`/`anon` because the grants
  -- below already exclude them, but it keeps the function fail-closed if those
  -- grants are ever widened.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized.';
  end if;

  update public.transactions as t
     set status   = 'successful',
         metadata = coalesce(t.metadata, '{}'::jsonb)
                  || jsonb_build_object(
                       'provider_response',
                       public.data_provider_allowlist(p_metadata)
                     )
   where t.reference = p_reference
     and t.status    = 'pending'
  returning true into v_completed;

  -- false means: unknown reference, or already settled (not pending). The
  -- caller treats that as "could not confirm finalisation" rather than success.
  return coalesce(v_completed, false);
end;
$$;

-- Sole caller is the purchase-data Edge Function, whose service_role key is a
-- server-side function secret and is never returned to the browser.
revoke execute on function public.complete_data_purchase_server(text, jsonb) from public;
revoke execute on function public.complete_data_purchase_server(text, jsonb) from anon;
revoke execute on function public.complete_data_purchase_server(text, jsonb) from authenticated;
grant  execute on function public.complete_data_purchase_server(text, jsonb) to service_role;