-- =============================================================================
-- Monnify Phase 2 — Atomic webhook processing
-- Single SECURITY DEFINER RPC that atomically:
--   - locks funding_request (payment_reference)
--   - validates amount / transaction_reference / status
--   - inserts monnify_events (PK = transaction_reference) for idempotency
--   - credits wallet (locks wallet, inserts wallet_funding transaction, updates balance)
--   - marks funding_request processed + monnify_status/amount_paid/verified_at
-- All in ONE database transaction. If any step fails, the entire transaction
-- rolls back, including the monnify_events insert, so a later retry can still
-- succeed. Duplicate transaction_reference is handled via PK duplicate check
-- before any credit.
-- Only service_role may call this (webhook). Frontend (authenticated) is denied.
-- =============================================================================

create or replace function public.process_monnify_funding(
  p_payment_reference text,
  p_transaction_reference text,
  p_amount_paid numeric,
  p_event_type text,
  p_payload jsonb
)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_funding_id uuid;
  v_user_id uuid;
  v_status text;
  v_amount numeric;
  v_existing_trx text;
  v_current_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_mon_status text;
begin
  -- 0. Validate inputs
  if p_payment_reference is null or trim(p_payment_reference) = '' then
    return json_build_object('success', false, 'error', 'payment_reference required', 'code', 'missing_payment_ref');
  end if;
  if p_transaction_reference is null or trim(p_transaction_reference) = '' then
    return json_build_object('success', false, 'error', 'transaction_reference required', 'code', 'missing_trx_ref');
  end if;
  if p_amount_paid is null or p_amount_paid <= 0 then
    return json_build_object('success', false, 'error', 'amount_paid invalid', 'code', 'invalid_amount');
  end if;

  -- 1. Lock funding_request by payment_reference (authoritative binding)
  select id, user_id, amount, status, transaction_reference
    into v_funding_id, v_user_id, v_amount, v_status, v_existing_trx
    from public.funding_requests
   where payment_reference = p_payment_reference
   for update;

  if not found then
    -- Orphan: no funding request for this paymentReference
    return json_build_object('success', false, 'orphan', true, 'code', 'orphan');
  end if;

  -- 2. Idempotency: check monnify_events PK already exists (duplicate webhook)
  if exists (select 1 from public.monnify_events where transaction_reference = p_transaction_reference) then
    return json_build_object('success', true, 'duplicate', true, 'code', 'duplicate_event');
  end if;

  -- 3. Check funding_request already processed (second idempotency layer)
  if v_status <> 'pending' then
    return json_build_object('success', true, 'already_processed', true, 'code', 'already_processed', 'status', v_status);
  end if;

  -- 4. Transaction reference validation
  if v_existing_trx is not null and v_existing_trx <> p_transaction_reference then
    return json_build_object('success', false, 'error', 'Transaction reference mismatch', 'code', 'trx_mismatch', 'expected', v_existing_trx, 'received', p_transaction_reference);
  end if;

  -- 5. Amount validation (exact match, Verronex conservative policy)
  if v_amount <> p_amount_paid then
    -- Record mismatch for admin audit, but do NOT credit
    -- Insert monnify_events for audit (still within same transaction, but we want it to persist even though we don't credit)
    -- For amount mismatch we still insert the event so admin can see it, but we do it before returning
    insert into public.monnify_events (transaction_reference, payment_reference, event_type, payload)
    values (p_transaction_reference, p_payment_reference, coalesce(p_event_type, 'SUCCESSFUL_TRANSACTION'), coalesce(p_payload, '{}'::jsonb))
    on conflict (transaction_reference) do nothing;

    update public.funding_requests
       set monnify_status = 'MISMATCH_PAID',
           amount_paid = p_amount_paid,
           verified_at = now(),
           webhook_payload = coalesce(p_payload, webhook_payload)
     where id = v_funding_id;

    return json_build_object('success', false, 'mismatch', true, 'code', 'amount_mismatch', 'expected', v_amount, 'received', p_amount_paid);
  end if;

  -- 6. Insert monnify_events first (within same transaction, PK ensures race idempotency)
  -- If two webhooks race, one will succeed, the other will hit unique violation and rollback before any credit
  insert into public.monnify_events (transaction_reference, payment_reference, event_type, payload)
  values (p_transaction_reference, p_payment_reference, coalesce(p_event_type, 'SUCCESSFUL_TRANSACTION'), coalesce(p_payload, '{}'::jsonb));

  -- 7. Lock wallet
  select coalesce(balance, 0)
    into v_current_balance
    from public.wallets
   where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet not found for funding request';
  end if;

  v_new_balance := v_current_balance + p_amount_paid;

  -- 8. Ensure transaction reference not already used in transactions (defense in depth)
  if exists (select 1 from public.transactions where reference = p_transaction_reference) then
    raise exception 'Payment reference already exists';
  end if;

  -- 9. Create wallet_funding transaction
  insert into public.transactions (
    user_id, type, category, amount, balance_before, balance_after, status, reference, description, metadata
  )
  values (
    v_user_id, 'credit', 'wallet_funding', p_amount_paid, v_current_balance, v_new_balance, 'completed',
    p_transaction_reference, 'Monnify wallet funding',
    jsonb_build_object('funding_request_id', v_funding_id, 'source', 'monnify', 'payment_reference', p_payment_reference)
  )
  returning id into v_transaction_id;

  -- 10. Credit wallet
  update public.wallets
     set balance = v_new_balance,
         updated_at = now()
   where user_id = v_user_id;

  -- 11. Mark funding request processed + audit fields
  -- If transaction_reference was null before (should not happen for Monnify, but handle), set it
  update public.funding_requests
     set status = 'processed',
         amount = p_amount_paid,
         transaction_reference = coalesce(transaction_reference, p_transaction_reference),
         monnify_status = 'PAID',
         amount_paid = p_amount_paid,
         verified_at = now(),
         processed_by = null, -- webhook has no user, keep null
         processed_at = now()
   where id = v_funding_id;

  -- 12. Notify user (same transaction — atomic)
  insert into public.notifications (user_id, title, message)
  values (
    v_user_id,
    'Wallet Funded',
    '₦' || to_char(p_amount_paid, 'FM999,999,999,999.00') || ' has been added to your Verronex wallet.'
  );

  return json_build_object(
    'success', true,
    'credited', true,
    'funding_request_id', v_funding_id,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance
  );

exception
  when unique_violation then
    declare
      v_constraint text;
    begin
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      if v_constraint = 'monnify_events_pkey' then
        -- Duplicate Monnify event race: first webhook already committed, second hits PK
        -- Rollback is automatic for second transaction, return duplicate
        return json_build_object('success', true, 'duplicate', true, 'code', 'duplicate_event_race');
      else
        -- Unrelated unique violation (transactions.reference, etc.) must propagate as real error
        raise;
      end if;
    end;
end;
$$;

-- Security: only service_role (webhook) may call, not frontend authenticated
revoke all on function public.process_monnify_funding(text, text, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.process_monnify_funding(text, text, numeric, text, jsonb) to service_role;
