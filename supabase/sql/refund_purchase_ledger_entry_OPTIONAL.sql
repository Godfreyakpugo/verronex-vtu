-- =============================================================================
-- CHANGE 4b (OPTIONAL — SEPARATE DECISION) — refund_purchase ledger entry
-- STATUS: NOT APPLIED. Not part of the required rollout. Apply only after the
--          optional changes below have been reviewed and accepted.
-- =============================================================================
-- SUPERSEDES: refund_purchase_auth_guard.sql (it contains that same function
--   with the auth.uid() IS NULL guard plus the additions in this file).
--   Apply this file INSTEAD OF that one if you accept this change. Do not
--   apply both.
--
-- THE GAP
--   refund_purchase credits public.wallets.balance and flips the original
--   transaction to 'failed', but never writes a compensating ledger row. Every
--   other money movement in this codebase writes one:
--     admin_credit_wallet            -> credit / wallet_funding
--     admin_process_funding_request  -> credit / wallet_funding
--     process_monnify_funding        -> credit / wallet_funding
--     admin_set_transaction_status   -> credit / wallet_refund
--   Consequences today:
--     * public.transactions no longer reconciles to public.wallets.balance.
--     * The refunded debit row keeps amount = charge and its original
--       balance_after, so balance_before - amount <> balance_after for it.
--     * There is no record of who refunded, when, or for how much; the only
--       hint is the flip to 'failed'.
--
-- SCHEMA SEMANTICS USED (all verified against the live database, not guessed)
--   transactions.type      CHECK (type IN ('credit','debit'))
--   transactions.status    CHECK (status IN ('pending','successful','failed','completed'))
--   transactions.reference UNIQUE, NOT NULL
--   transactions.amount    NOT NULL, CHECK (amount > 0)
--   transactions.balance_before / balance_after  NOT NULL
--   transactions.category  no CHECK constraint; 'wallet_refund' is already the
--                           established value used by admin_set_transaction_status
--                           and admin_refund_transaction
--   A credit row uses status = 'completed' (CHECK allows it) and type = 'credit'.
--
-- ATOMICITY AND IDEMPOTENCY
--   * Whole function runs in one transaction, so the wallet credit, the ledger
--     insert and the status flip commit or roll back together.
--   * Idempotent: guarded by status = 'pending' plus FOR UPDATE, so a replay or
--     a concurrent duplicate inserts nothing and returns false.
--   * The derived reference 'refund-' || p_reference is unique by construction
--     (original reference is UNIQUE), and is a second independent guard.
--
-- ALSO FIXES A LATENT BUG INCLUDED HERE (do not apply this file for the ledger
-- alone without reading this)
--   The current function issues
--       update public.wallets ... where user_id = v_user_id;
--   without checking that a wallet row was actually updated. If the wallet row
--   is missing, zero rows change, no error is raised, and the function still
--   returns TRUE — so a caller checking the boolean would believe the customer
--   was refunded when nothing was credited. Locking the wallet and raising on
--   'not found' closes that.
--
-- LOCK ORDERING (changed by this file — low risk, stated for the record)
--   This function locks the transaction row, then the wallet row. Existing
--   paths lock in the other order (admin_credit_wallet / admin_debit_wallet lock
--   only the wallet; admin_process_funding_request and process_monnify_funding
--   lock a funding_request then the wallet). No cycle exists because no current
--   function locks a wallet and then a transaction row, so this introduces no
--   lock-order inversion.
--
-- FRONTEND FOLLOW-UP REQUIRED IF YOU APPLY THIS
--   src/lib/transactionView.js has no CATEGORY_META entry for 'wallet_refund',
--   so each new credit row renders with the generic "Transaction" label. Add:
--     wallet_refund: { label: "Refund", icon: ArrowDownLeft,
--                      theme: "bg-emerald-100 text-emerald-600" }
--   and add "wallet_refund" to CATEGORY_ORDER if it should be filterable.
--   This is intentionally NOT included here, so the SQL and the UI can be
--   reviewed independently.
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
  v_user_id        uuid;
  v_amount         numeric;
  v_balance_before numeric;
  v_balance_after  numeric;
begin
  -- From refund_purchase_auth_guard.sql — see that file for the full rationale.
  if auth.uid() is null then
    raise exception 'Not authorized.';
  end if;

  select t.user_id, t.amount
    into v_user_id, v_amount
    from public.transactions as t
   where t.reference = p_reference
     and t.status   = 'pending'
     for update;

  if not found then
    return false;
  end if;

  if v_user_id is distinct from auth.uid() then
    raise exception 'Not authorized.';
  end if;

  -- Lock and read the wallet so the ledger row can record an accurate
  -- before/after pair, and so a missing wallet is an error rather than a
  -- silent no-op.
  select coalesce(w.balance, 0)
    into v_balance_before
    from public.wallets as w
   where w.user_id = v_user_id
     for update;

  if not found then
    raise exception 'Wallet not found for user %. Refund aborted.', v_user_id;
  end if;

  v_balance_after := v_balance_before + v_amount;

  update public.wallets
     set balance    = v_balance_after,
         updated_at = now()
   where user_id = v_user_id;

  -- Compensating ledger entry, mirroring admin_set_transaction_status's refund
  -- shape: type 'credit', category 'wallet_refund', status 'completed'.
  -- on conflict do nothing keeps a duplicate safe even if two callers somehow
  -- reach this point concurrently (the pending guard should prevent that).
  insert into public.transactions (
    user_id, type, category, amount,
    balance_before, balance_after, status,
    reference, description, metadata
  )
  values (
    v_user_id, 'credit', 'wallet_refund', v_amount,
    v_balance_before, v_balance_after, 'completed',
    'refund-' || p_reference,
    'Refund for purchase ' || p_reference,
    jsonb_build_object(
      'original_reference', p_reference,
      'refund_reason', p_reason,
      'refunded_at', now(),
      'source', 'refund_purchase'
    )
  )
  on conflict (reference) do nothing;

  update public.transactions
     set status      = 'failed',
         description = p_reason
   where reference = p_reference
     and status    = 'pending';

  return true;
end;
$$;

-- Grants unchanged on purpose: CREATE OR REPLACE keeps {postgres, authenticated}.
-- This function must NOT gain service_role.