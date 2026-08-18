-- =============================================================================
-- WALLET FUNDING WORKFLOW
-- Atomic funding-request processing that links funding_requests -> wallet -> tx.
-- Apply each statement individually to the live Supabase project (Management API
-- accepts one statement per call).
--
-- Statements:
--   1. CREATE admin_process_funding_request
--   2. CREATE admin_reject_funding_request
--   3. GRANT/REVOKE for both new functions
--   4. Harden admin_credit_wallet (NULL/blank reference rejection + search_path)
--   5. Harden admin_debit_wallet  (same)
--   6. GRANT/REVOKE for admin_credit_wallet / admin_debit_wallet
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. admin_process_funding_request
-- -----------------------------------------------------------------------------
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
  v_reference text;
  v_suffix text;
  i integer;
begin
  -- 1. Admin only
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- 2. Validate amount
  if p_credited_amount is null or p_credited_amount <= 0 then
    raise exception 'Credit amount must be greater than zero';
  end if;

  -- 3. Resolve the payment reference (manual or auto-generated)
  if p_reference is null or trim(p_reference) = '' then
    loop
      v_suffix := '';
      for i in 1..8 loop
        v_suffix := v_suffix ||
          substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::int + 1, 1);
      end loop;
      v_reference := 'FUND-' || to_char(now(), 'YYYYMMDD') || '-' || v_suffix;
      exit when not exists (
        select 1 from public.transactions where reference = v_reference
      );
    end loop;
  else
    v_reference := trim(p_reference);
  end if;

  -- 4. Duplicate reference protection (always runs; auto refs are already unique)
  if exists (
    select 1 from public.transactions
    where reference = v_reference
  ) then
    raise exception 'Payment reference already exists';
  end if;

  -- 5. Lock the funding request row
  select user_id, status
    into v_user_id, v_status
    from public.funding_requests
   where id = p_funding_request_id
   for update;

  if not found then
    raise exception 'Funding request not found';
  end if;

  -- 6. Must be pending (request-level double-credit protection)
  if v_status <> 'pending' then
    raise exception 'Funding request cannot be processed: status is %', v_status;
  end if;

  -- 7. Lock wallet and read current balance
  select coalesce(balance, 0)
    into v_current_balance
    from public.wallets
   where user_id = v_user_id
   for update;

  if not found then
    raise exception 'Wallet not found for funding request';
  end if;

  v_new_balance := v_current_balance + p_credited_amount;

  -- 8. Create the completed credit transaction, carrying the origin request id
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
    v_reference,
    p_description,
    jsonb_build_object(
      'funding_request_id', p_funding_request_id,
      'source', 'funding_request'
    )
  )
  returning id into v_transaction_id;

  -- 9. Credit the wallet
  update public.wallets
     set balance = v_new_balance,
         updated_at = now()
   where user_id = v_user_id;

  -- 10. Mark the request processed
  update public.funding_requests
     set status = 'processed',
         amount = p_credited_amount,
         processed_by = auth.uid(),
         processed_at = now()
   where id = p_funding_request_id;

  -- 11. Notify the request owner (same transaction — atomic with the credit)
  insert into public.notifications (user_id, title, message)
  values (
    v_user_id,
    'Wallet Funded',
    '₦' || to_char(p_credited_amount, 'FM999,999,999,999.00')
       || ' has been added to your Verronex wallet.'
  );

  -- 12. Useful return
  return json_build_object(
    'success', true,
    'funding_request_id', p_funding_request_id,
    'transaction_id', v_transaction_id,
    'transaction_reference', v_reference,
    'new_balance', v_new_balance
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. admin_reject_funding_request
-- -----------------------------------------------------------------------------
create or replace function public.admin_reject_funding_request(
  p_funding_request_id uuid,
  p_reason text
)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_status text;
begin
  -- Admin only
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- Rejection reason is required
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Rejection reason is required';
  end if;

  -- Lock the funding request row
  select status
    into v_status
    from public.funding_requests
   where id = p_funding_request_id
   for update;

  if not found then
    raise exception 'Funding request not found';
  end if;

  -- Only pending requests can be rejected (idempotency-safe)
  if v_status <> 'pending' then
    raise exception 'Funding request cannot be rejected: status is %', v_status;
  end if;

  update public.funding_requests
     set status = 'rejected',
         rejection_reason = p_reason,
         processed_by = auth.uid(),
         processed_at = now()
   where id = p_funding_request_id;

  return json_build_object(
    'success', true,
    'funding_request_id', p_funding_request_id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Grants for the new functions
-- -----------------------------------------------------------------------------
revoke execute on function public.admin_process_funding_request(uuid, numeric, text, text) from public;
revoke execute on function public.admin_process_funding_request(uuid, numeric, text, text) from anon;
grant execute on function public.admin_process_funding_request(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_process_funding_request(uuid, numeric, text, text) to service_role;

revoke execute on function public.admin_reject_funding_request(uuid, text) from public;
revoke execute on function public.admin_reject_funding_request(uuid, text) from anon;
grant execute on function public.admin_reject_funding_request(uuid, text) to authenticated;
grant execute on function public.admin_reject_funding_request(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- 4. Harden admin_credit_wallet
--    - reject NULL/blank payment_reference (closes the duplicate-check bypass)
--    - SET search_path TO '' with fully-qualified references
-- -----------------------------------------------------------------------------
create or replace function public.admin_credit_wallet(target_user_id uuid, credit_amount numeric, payment_reference text, payment_description text)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  current_balance numeric;
  new_balance numeric;
  transaction_id uuid;
begin
  -- Only admins can execute
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- Validate amount
  if credit_amount is null or credit_amount <= 0 then
    raise exception 'Credit amount must be greater than zero';
  end if;

  -- Reference is required so the duplicate check below cannot be bypassed
  if payment_reference is null or trim(payment_reference) = '' then
    raise exception 'Payment reference is required';
  end if;

  -- Prevent duplicate credits
  if exists (
    select 1 from public.transactions
    where reference = payment_reference
  ) then
    raise exception 'Payment reference already exists';
  end if;

  -- Lock wallet row
  select balance
    into current_balance
    from public.wallets
   where user_id = target_user_id
   for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  current_balance := coalesce(current_balance, 0);
  new_balance := current_balance + credit_amount;

  -- Record transaction
  insert into public.transactions (
    user_id,
    type,
    category,
    amount,
    balance_before,
    balance_after,
    status,
    reference,
    description
  )
  values (
    target_user_id,
    'credit',
    'wallet_funding',
    credit_amount,
    current_balance,
    new_balance,
    'completed',
    payment_reference,
    payment_description
  )
  returning id into transaction_id;

  -- Update wallet
  update public.wallets
     set balance = new_balance,
         updated_at = now()
   where user_id = target_user_id;

  return json_build_object(
    'success', true,
    'transaction_id', transaction_id,
    'new_balance', new_balance
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Harden admin_debit_wallet
-- -----------------------------------------------------------------------------
create or replace function public.admin_debit_wallet(target_user_id uuid, debit_amount numeric, payment_reference text, payment_description text)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  current_balance numeric;
  new_balance numeric;
  transaction_id uuid;
begin
  -- Only admins can execute
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- Validate amount
  if debit_amount is null or debit_amount <= 0 then
    raise exception 'Debit amount must be greater than zero';
  end if;

  -- Reference is required so the duplicate check below cannot be bypassed
  if payment_reference is null or trim(payment_reference) = '' then
    raise exception 'Payment reference is required';
  end if;

  -- Prevent duplicate references
  if exists (
    select 1 from public.transactions
    where reference = payment_reference
  ) then
    raise exception 'Payment reference already exists';
  end if;

  -- Lock wallet row
  select balance
    into current_balance
    from public.wallets
   where user_id = target_user_id
   for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  current_balance := coalesce(current_balance, 0);

  -- Prevent overdrawing
  if current_balance < debit_amount then
    raise exception 'Insufficient wallet balance';
  end if;

  new_balance := current_balance - debit_amount;

  -- Record transaction
  insert into public.transactions (
    user_id,
    type,
    category,
    amount,
    balance_before,
    balance_after,
    status,
    reference,
    description
  )
  values (
    target_user_id,
    'debit',
    'wallet_debit',
    debit_amount,
    current_balance,
    new_balance,
    'completed',
    payment_reference,
    payment_description
  )
  returning id into transaction_id;

  -- Update wallet
  update public.wallets
     set balance = new_balance,
         updated_at = now()
   where user_id = target_user_id;

  return json_build_object(
    'success', true,
    'transaction_id', transaction_id,
    'new_balance', new_balance
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Grants for admin_credit_wallet / admin_debit_wallet
--    Tighten so unnecessary PUBLIC/anon execute privileges are revoked.
--    In-function is_admin() protection remains.
-- -----------------------------------------------------------------------------
revoke execute on function public.admin_credit_wallet(uuid, numeric, text, text) from public;
revoke execute on function public.admin_credit_wallet(uuid, numeric, text, text) from anon;
grant execute on function public.admin_credit_wallet(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_credit_wallet(uuid, numeric, text, text) to service_role;

revoke execute on function public.admin_debit_wallet(uuid, numeric, text, text) from public;
revoke execute on function public.admin_debit_wallet(uuid, numeric, text, text) from anon;
grant execute on function public.admin_debit_wallet(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_debit_wallet(uuid, numeric, text, text) to service_role;