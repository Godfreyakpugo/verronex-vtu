-- ============================================================================
-- admin_set_transaction_status
-- Admin manual status toggle between successful <-> failed with safe accounting
--
-- Business rules:
--  successful -> failed  = refund once (credit wallet, insert refund tx)
--  failed -> successful  = status only, no debit
--  same status           = no financial action (idempotent)
--  other statuses (pending) -> allowed, but financial action only when
--    transitioning TO failed from a debited state (pending/successful)
--
-- Safety:
--  - is_admin() gate
--  - FOR UPDATE locks on transactions + wallets
--  - Idempotent: second call with same target does nothing
--  - Double-refund prevention via metadata flag + existing refund tx check
--  - Atomic: wallet + original tx + refund tx in one transaction
--
-- Refund accounting:
--  - Wallet: balance + amount (credit)
--  - Original tx: status='failed', metadata.manual_status_change etc
--  - Refund tx: type='credit', category='wallet_refund', status='completed',
--    reference='admin-refund-<original_id>', metadata links original
--
-- Apply in Supabase SQL editor (one statement at a time).
-- ============================================================================

create or replace function public.admin_set_transaction_status(
  p_transaction_id uuid,
  p_new_status text,
  p_reason text default null
)
returns json
language plpgsql
security definer
set search_path to public
as $$
declare
  v_tx_id uuid;
  v_user_id uuid;
  v_amount numeric;
  v_status text;
  v_category text;
  v_type text;
  v_reference text;
  v_metadata jsonb;
  v_current_balance numeric;
  v_new_balance numeric;
  v_refund_reference text;
  v_existing_refund uuid;
begin
  -- 1. Admin only
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- 2. Validate target status
  if p_new_status not in ('successful','failed') then
    raise exception 'Invalid target status: %. Allowed: successful, failed', p_new_status;
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Reason is required for status change';
  end if;

  -- 3. Lock transaction row
  select id, user_id, amount, status, category, type, reference, metadata
    into v_tx_id, v_user_id, v_amount, v_status, v_category, v_type, v_reference, v_metadata
    from public.transactions
   where id = p_transaction_id
   for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  -- Normalize: treat 'completed' as 'successful' for wallet_funding alias
  -- But only debit transactions are eligible for refund; credit handling below

  -- 4. Idempotent: already in target
  if v_status = p_new_status then
    return json_build_object(
      'success', true,
      'transaction_id', v_tx_id,
      'old_status', v_status,
      'new_status', p_new_status,
      'message', 'Already in target status',
      'refunded', false
    );
  end if;

  -- Handle completed alias: completed == successful
  if v_status = 'completed' and p_new_status = 'successful' then
    return json_build_object(
      'success', true,
      'transaction_id', v_tx_id,
      'old_status', v_status,
      'new_status', p_new_status,
      'message', 'Already successful (completed)',
      'refunded', false
    );
  end if;
  if v_status = 'completed' and p_new_status = 'failed' then
    -- treat as successful -> failed
    v_status := 'successful';
  end if;

  -- 5. Lock wallet
  select balance
    into v_current_balance
    from public.wallets
   where user_id = v_user_id
   for update;

  if not found then
    raise exception 'Wallet not found for user %', v_user_id;
  end if;

  v_current_balance := coalesce(v_current_balance, 0);
  v_metadata := coalesce(v_metadata, '{}'::jsonb);

  -- 6. Determine transition
  -- Case: -> failed : refund once if debit and not already refunded
  if p_new_status = 'failed' then
    -- Only debit transactions are eligible for automatic refund
    -- Credit (wallet_funding) going to failed would be a debit reversal - not handled here
    if v_type != 'debit' then
      -- For credit, just mark failed without wallet change
      update public.transactions
         set status = 'failed',
             metadata = v_metadata || jsonb_build_object(
               'manual_status_change', true,
               'previous_status', v_status,
               'new_status', 'failed',
               'reason', p_reason,
               'changed_by', auth.uid(),
               'changed_at', now()
             )
       where id = v_tx_id;

      return json_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'old_status', v_status,
        'new_status', 'failed',
        'refunded', false,
        'message', 'Status changed to failed (no wallet action for credit)'
      );
    end if;

    -- Check if already refunded via metadata flag
    if (v_metadata ? 'admin_refunded') and (v_metadata ->> 'admin_refunded')::boolean = true then
      -- Already refunded once, just ensure status is failed
      update public.transactions
         set status = 'failed',
             metadata = v_metadata || jsonb_build_object(
               'manual_status_change', true,
               'previous_status', v_status,
               'new_status', 'failed',
               'reason', p_reason,
               'changed_by', auth.uid(),
               'changed_at', now()
             )
       where id = v_tx_id;

      return json_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'old_status', v_status,
        'new_status', 'failed',
        'refunded', false,
        'message', 'Already refunded once, status set to failed'
      );
    end if;

    -- Check existing refund transaction (idempotency across cycles)
    v_refund_reference := 'admin-refund-' || v_tx_id::text;
    select id into v_existing_refund
      from public.transactions
     where reference = v_refund_reference
     limit 1;

    if found then
      update public.transactions
         set status = 'failed',
             metadata = v_metadata || jsonb_build_object(
               'manual_status_change', true,
               'previous_status', v_status,
               'new_status', 'failed',
               'reason', p_reason,
               'changed_by', auth.uid(),
               'changed_at', now(),
               'admin_refunded', true,
               'refund_reference', v_refund_reference
             )
       where id = v_tx_id;

      return json_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'old_status', v_status,
        'new_status', 'failed',
        'refunded', false,
        'message', 'Refund already exists, status set to failed'
      );
    end if;

    -- Also check metadata link for prior refund (defense in depth)
    if exists (
      select 1 from public.transactions
       where metadata ->> 'original_transaction_id' = v_tx_id::text
         and category = 'wallet_refund'
    ) then
      update public.transactions
         set status = 'failed',
             metadata = v_metadata || jsonb_build_object(
               'manual_status_change', true,
               'previous_status', v_status,
               'new_status', 'failed',
               'reason', p_reason,
               'changed_by', auth.uid(),
               'changed_at', now(),
               'admin_refunded', true
             )
       where id = v_tx_id;

      return json_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'old_status', v_status,
        'new_status', 'failed',
        'refunded', false,
        'message', 'Refund already recorded, status set to failed'
      );
    end if;

    -- Perform refund: credit wallet
    v_new_balance := v_current_balance + v_amount;

    update public.wallets
       set balance = v_new_balance,
           updated_at = now()
     where user_id = v_user_id;

    -- Update original transaction to failed with metadata
    update public.transactions
       set status = 'failed',
           metadata = v_metadata || jsonb_build_object(
             'manual_status_change', true,
             'previous_status', v_status,
             'new_status', 'failed',
             'refund_amount', v_amount,
             'refunded_by', auth.uid(),
             'refunded_at', now(),
             'refund_reason', p_reason,
             'admin_refunded', true,
             'refund_reference', v_refund_reference
           )
     where id = v_tx_id;

    -- Insert refund credit transaction
    -- Use unique reference, handle duplicate gracefully
    begin
      insert into public.transactions (
        user_id,
        type,
        category,
        amount,
        balance_before,
        balance_after,
        status,
        reference,
        description,
        metadata
      )
      values (
        v_user_id,
        'credit',
        'wallet_refund',
        v_amount,
        v_current_balance,
        v_new_balance,
        'completed',
        v_refund_reference,
        'Refund for transaction ' || v_tx_id::text || ' (' || coalesce(v_reference,'') || ')',
        jsonb_build_object(
          'original_transaction_id', v_tx_id,
          'original_reference', v_reference,
          'original_category', v_category,
          'refund_reason', p_reason,
          'refunded_by', auth.uid(),
          'refunded_at', now(),
          'manual_status_change', true
        )
      );
    exception when unique_violation then
      -- Race: another admin inserted refund concurrently, treat as idempotent
      null;
    end;

    return json_build_object(
      'success', true,
      'transaction_id', v_tx_id,
      'old_status', v_status,
      'new_status', 'failed',
      'refunded', true,
      'refunded_amount', v_amount,
      'new_balance', v_new_balance,
      'reference', v_refund_reference
    );

  elsif p_new_status = 'successful' then
    -- failed -> successful : status only, no debit
    -- Also pending -> successful : status only
    update public.transactions
       set status = 'successful',
           metadata = v_metadata || jsonb_build_object(
             'manual_status_change', true,
             'previous_status', v_status,
             'new_status', 'successful',
             'reason', p_reason,
             'changed_by', auth.uid(),
             'changed_at', now()
           )
     where id = v_tx_id;

    return json_build_object(
      'success', true,
      'transaction_id', v_tx_id,
      'old_status', v_status,
      'new_status', 'successful',
      'refunded', false,
      'message', 'Status changed to successful, no wallet debit'
    );
  else
    raise exception 'Unhandled transition % -> %', v_status, p_new_status;
  end if;
end
$$;

revoke execute on function public.admin_set_transaction_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_transaction_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_transaction_status(uuid, text, text) to service_role;
