-- Optional payment reference for manual wallet adjustments (credit + debit).
-- If the admin supplies a reference, it is used verbatim (trimmed).
-- If blank, a unique readable reference is generated server-side:
--   FUND-YYYYMMDD-XXXXXXXX  (8 unambiguous base32 chars, e.g. FUND-20260818-8F4K2M7Q)
-- Generated references are guaranteed unique against transactions.reference.
-- Both functions keep their existing behavior (amount validation, duplicate
-- protection, insufficient-balance check for debits) and now also return
-- the actual reference used via 'transaction_reference'.

create or replace function public.admin_credit_wallet(
  target_user_id uuid,
  credit_amount numeric,
  payment_reference text,
  payment_description text
)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  current_balance numeric;
  new_balance numeric;
  transaction_id uuid;
  v_reference text;
  v_suffix text;
  i integer;
begin
  -- Only admins can execute
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- Validate amount
  if credit_amount is null or credit_amount <= 0 then
    raise exception 'Credit amount must be greater than zero';
  end if;

  -- Resolve the payment reference (manual or auto-generated)
  if payment_reference is null or trim(payment_reference) = '' then
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
    v_reference := trim(payment_reference);
  end if;

  -- Prevent duplicate credits (always runs; auto refs are already unique)
  if exists (
    select 1 from public.transactions
    where reference = v_reference
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
    v_reference,
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
    'transaction_reference', v_reference,
    'new_balance', new_balance
  );
end;
$$;

create or replace function public.admin_debit_wallet(
  target_user_id uuid,
  debit_amount numeric,
  payment_reference text,
  payment_description text
)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  current_balance numeric;
  new_balance numeric;
  transaction_id uuid;
  v_reference text;
  v_suffix text;
  i integer;
begin
  -- Only admins can execute
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- Validate amount
  if debit_amount is null or debit_amount <= 0 then
    raise exception 'Debit amount must be greater than zero';
  end if;

  -- Resolve the payment reference (manual or auto-generated)
  if payment_reference is null or trim(payment_reference) = '' then
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
    v_reference := trim(payment_reference);
  end if;

  -- Prevent duplicate references (always runs; auto refs are already unique)
  if exists (
    select 1 from public.transactions
    where reference = v_reference
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
    v_reference,
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
    'transaction_reference', v_reference,
    'new_balance', new_balance
  );
end;
$$;

revoke execute on function public.admin_credit_wallet(uuid, numeric, text, text) from public;
revoke execute on function public.admin_credit_wallet(uuid, numeric, text, text) from anon;
grant execute on function public.admin_credit_wallet(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_credit_wallet(uuid, numeric, text, text) to service_role;

revoke execute on function public.admin_debit_wallet(uuid, numeric, text, text) from public;
revoke execute on function public.admin_debit_wallet(uuid, numeric, text, text) from anon;
grant execute on function public.admin_debit_wallet(uuid, numeric, text, text) to authenticated;
grant execute on function public.admin_debit_wallet(uuid, numeric, text, text) to service_role;