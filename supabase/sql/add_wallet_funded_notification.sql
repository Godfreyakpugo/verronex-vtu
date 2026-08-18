-- Wallet-funding notification.
-- Adds a "Wallet Funded" notification insert to admin_process_funding_request
-- so the notification is created in the SAME transaction as the wallet credit.
-- If anything fails, the whole funding operation rolls back (no orphan credit,
-- no false notification). Duplicate approvals are already blocked by the
-- request-status guard before any notification could be inserted.
--
-- SECURITY: this function is SECURITY DEFINER, so it bypasses RLS to insert the
-- notification. The notifications INSERT policy (is_admin() only) is unchanged,
-- so no public insert path is exposed.

create or replace function public.admin_process_funding_request(
  p_funding_request_id uuid,
  p_credited_amount numeric,
  p_reference text,
  p_description text default 'Wallet funding'
)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid;
  v_status text;
  v_current_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
begin
  -- 1. Admin only
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- 2. Validate amount
  if p_credited_amount is null or p_credited_amount <= 0 then
    raise exception 'Credit amount must be greater than zero';
  end if;

  -- 5. Require a non-empty reference
  if p_reference is null or trim(p_reference) = '' then
    raise exception 'Payment reference is required';
  end if;

  -- 5. Duplicate reference protection (robust: p_reference is non-null here)
  if exists (
    select 1 from public.transactions
    where reference = p_reference
  ) then
    raise exception 'Payment reference already exists';
  end if;

  -- 3. Lock the funding request row
  select user_id, status
    into v_user_id, v_status
    from public.funding_requests
   where id = p_funding_request_id
   for update;

  if not found then
    raise exception 'Funding request not found';
  end if;

  -- 4. Must be pending (request-level double-credit protection)
  if v_status <> 'pending' then
    raise exception 'Funding request cannot be processed: status is %', v_status;
  end if;

  -- 6. Lock wallet and read current balance
  select coalesce(balance, 0)
    into v_current_balance
    from public.wallets
   where user_id = v_user_id
   for update;

  if not found then
    raise exception 'Wallet not found for funding request';
  end if;

  v_new_balance := v_current_balance + p_credited_amount;

  -- 7. Create the completed credit transaction, carrying the origin request id
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
    'wallet_funding',
    p_credited_amount,
    v_current_balance,
    v_new_balance,
    'completed',
    p_reference,
    p_description,
    jsonb_build_object(
      'funding_request_id', p_funding_request_id,
      'source', 'funding_request'
    )
  )
  returning id into v_transaction_id;

  -- 8. Credit the wallet
  update public.wallets
     set balance = v_new_balance,
         updated_at = now()
   where user_id = v_user_id;

  -- 9. Mark the request processed
  update public.funding_requests
     set status = 'processed',
         amount = p_credited_amount,
         processed_by = auth.uid(),
         processed_at = now()
   where id = p_funding_request_id;

  -- 10. Notify the request owner (same transaction — atomic with the credit)
  insert into public.notifications (user_id, title, message)
  values (
    v_user_id,
    'Wallet Funded',
    '₦' || to_char(p_credited_amount, 'FM999,999,999,999.00')
       || ' has been added to your Verronex wallet.'
  );

  -- 11. Useful return
  return json_build_object(
    'success', true,
    'funding_request_id', p_funding_request_id,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance
  );
end;
$$;

revoke execute on function public.admin_process_funding_request(uuid, numeric, text, text) from public;
revoke execute on function public.admin_process_funding_request(uuid, numeric, text, text) from anon;
grant execute on function public.admin_process_funding_request(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_process_funding_request(uuid, numeric, text, text) to service_role;