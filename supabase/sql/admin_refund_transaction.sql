create or replace function public.admin_refund_transaction(
  p_transaction_id uuid,
  p_reason text
)
returns json
language plpgsql
security definer
set search_path to public
as $$
declare
  v_transaction uuid;
  v_user_id uuid;
  v_category text;
  v_amount numeric;
  v_current_balance numeric;
  v_new_balance numeric;
  v_status text;
  v_already_refunded boolean;
begin
  -- Admin only check via is_admin()
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- Lock the transaction row
  select id, user_id, amount, category, status
    into v_transaction, v_user_id, v_amount, v_category, v_status
    from public.transactions
   where id = p_transaction_id
   for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  -- Reject already-refunded transactions
  if v_status = 'refunded' then
    raise exception 'This transaction has already been refunded';
  end if;

  -- Reject inappropriate transaction categories for refund
  -- Only wallet debit/refundable categories can be refunded
  if v_category not in ('wallet_debit', 'wallet_funding') then
    raise exception 'Refund not applicable for % transactions', v_category;
  end if;

  -- For wallet funding credits, refund means reversing the credit
  if v_category = 'wallet_funding' then
    raise exception 'Wallet funding credits cannot be refunded through this RPC; use the funding request rejection workflow instead';
  end if;

  -- Lock the user's wallet row
  select balance
    into v_current_balance
    from public.wallets
   where user_id = v_user_id
   for update;

  if not found then
    raise exception 'Wallet not found for user %', v_user_id;
  end if;

  -- Calculate new balance (subtract the original amount)
  v_new_balance := greatest(v_current_balance - v_amount, 0);

  -- Credit the wallet back (refund)
  update public.wallets
     set balance = v_new_balance,
         updated_at = now()
   where user_id = v_user_id;

  -- Mark the original transaction as refunded
  update public.transactions
     set status = 'refunded',
         rejection_reason = p_reason,
         processed_by = auth.uid(),
         processed_at = now()
   where id = p_transaction_id;

  -- Record the refund transaction as a debit (reverse of the original credit)
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
    'debit',
    'wallet_refund',
    v_amount,
    v_current_balance,
    v_new_balance,
    'completed',
    'refund-' || v_transaction,
    'Refund for transaction ' || v_transaction,
    jsonb_build_object(
      'original_transaction_id', v_transaction,
      'refund_reason', p_reason,
      'refunded_at', now()
    )
  );

  return json_build_object(
    'success', true,
    'transaction_id', v_transaction,
    'refunded_amount', v_amount,
    'new_wallet_balance', v_new_balance,
    'refunded_at', now()
  );
end
$$;