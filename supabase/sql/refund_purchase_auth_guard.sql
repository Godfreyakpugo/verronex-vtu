-- =============================================================================
-- CHANGE 2 — refund_purchase: fail closed when auth.uid() IS NULL
-- STATUS: NOT APPLIED. Prepare and apply manually, one statement at a time.
-- =============================================================================
-- THE BUG
--   The live function guards ownership with:
--       if v_user_id <> auth.uid() then return false; end if;
--   transactions.user_id is NOT NULL, so v_user_id can never be NULL. The only
--   way auth.uid() can be NULL is a caller with no `sub` claim — service_role,
--   anon, or a direct psql session. In that case `v_user_id <> NULL`
--   evaluates to NULL, and `IF NULL` is NOT taken, so the ownership check is
--   skipped entirely and the refund proceeds for ANY pending reference.
--
--   This is currently unreachable only because the live ACL is
--   {postgres, authenticated}: anon, public and service_role are all absent.
--   The exposure is one careless `grant execute ... to service_role` away, and
--   complete_data_purchase already carries that grant — so "make it
--   consistent" is a very plausible next change.
--
-- WHAT THIS CHANGES
--   * Explicit `auth.uid() is null` guard, evaluated FIRST, before any row is
--     read and before any wallet is touched.
--   * `is distinct from` instead of `<>`, so the comparison is NULL-safe
--     regardless of what a future edit changes upstream.
--   * Ownership failure RAISES rather than returning false. This is a
--     deliberate behaviour change — see "BEHAVIOUR CHANGE" below.
--
-- BEHAVIOUR CHANGE (needs your decision)
--   All three call sites (purchase-data/index.ts, and twice in
--   purchase-airtime/index.ts) inspect only `refundError` and ignore the
--   returned boolean. Previously an unauthorised refund returned false with no
--   error, so the caller continued as though the refund had happened.
--   purchase-airtime even replied "Your wallet has been refunded." while the
--   wallet was still debited.
--   Raising sets `refundError`, which routes those callers to their existing
--   honest "we could not automatically restore your wallet balance, please
--   contact support" branch. The callers in this change set also now check the
--   returned boolean, so either mechanism produces a correct message.
--   Returning false for "reference unknown / already settled" is UNCHANGED, so
--   replay idempotency is preserved.
--
-- NOT CHANGED
--   * Still user-scoped. No service_role grant. auth.uid() must stay
--     meaningful here, which is exactly why this function must NOT be granted
--     to service_role.
--   * SECURITY DEFINER, owner postgres, SET search_path = ''.
--   * The atomic single-statement wallet update
--     (balance = coalesce(balance,0) + v_amount) — no lost-update race, and no
--     new lock is taken on the wallet, so lock ordering is unchanged.
--   * status = 'pending' on both the SELECT and the UPDATE, plus the row lock:
--     a replay or concurrent duplicate refunds nothing.
--
-- KNOWN GAP, DELIBERATELY NOT ADDRESSED HERE
--   If the wallet row is missing, `update public.wallets ... where user_id` is
--   affects 0 rows, yet the function still returns true. That is a separate
--   change; see refund_purchase_ledger_entry_OPTIONAL.sql.
-- =============================================================================

create or replace function public.refund_purchase(
  p_reference text,
  p_reason   text default 'Purchase failed'::text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_amount  numeric;
begin
  -- BEFORE any lookup or any wallet write. See the header for why the old
  -- `v_user_id <> auth.uid()` test was not sufficient on its own.
  if auth.uid() is null then
    raise exception 'Not authorized.';
  end if;

  select t.user_id, t.amount
    into v_user_id, v_amount
    from public.transactions as t
   where t.reference = p_reference
     and t.status   = 'pending'
     for update;

  -- Benign, and preserves replay idempotency: unknown reference, or the
  -- transaction has already been settled by an earlier call.
  if not found then
    return false;
  end if;

  if v_user_id is distinct from auth.uid() then
    raise exception 'Not authorized.';
  end if;

  update public.wallets
     set balance    = coalesce(balance, 0) + v_amount,
         updated_at = now()
   where user_id = v_user_id;

  update public.transactions
     set status      = 'failed',
         description = p_reason
   where reference = p_reference
     and status    = 'pending';

  return true;
end;
$$;

-- No revoke/grant on purpose: CREATE OR REPLACE keeps the existing ACL
-- {postgres, authenticated}. This function must NOT gain service_role.