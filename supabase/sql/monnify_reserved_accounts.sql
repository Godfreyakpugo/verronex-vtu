-- Permanent Monnify customer reserved accounts and wallet credit processing.
-- Apply manually only after reviewing the linked project schema. This file is
-- intentionally not run by the application or deployment scripts.

begin;

create table if not exists public.monnify_reserved_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  account_reference text not null unique,
  reservation_reference text,
  account_name text,
  account_number text unique,
  bank_code text,
  bank_name text,
  status text not null default 'creating'
    check (status in ('creating', 'active', 'pending', 'failed')),
  kyc_type text not null check (kyc_type in ('BVN', 'NIN')),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.monnify_reserved_accounts enable row level security;
revoke all on table public.monnify_reserved_accounts from public, anon, authenticated;
grant select on table public.monnify_reserved_accounts to authenticated;
grant all on table public.monnify_reserved_accounts to service_role;

drop policy if exists "Users can read their own Monnify reserved account"
  on public.monnify_reserved_accounts;
create policy "Users can read their own Monnify reserved account"
  on public.monnify_reserved_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.monnify_reserved_account_mismatches (
  transaction_reference text primary key,
  account_reference text not null,
  payment_reference text not null,
  webhook_amount numeric not null,
  verified_amount numeric,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.monnify_reserved_account_mismatches enable row level security;
revoke all on table public.monnify_reserved_account_mismatches from public, anon, authenticated;
grant all on table public.monnify_reserved_account_mismatches to service_role;

create or replace function public.process_monnify_reserved_account_payment(
  p_account_reference text,
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
  v_user_id uuid;
  v_account_status text;
  v_current_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
begin
  if p_account_reference is null or trim(p_account_reference) = ''
     or p_payment_reference is null or trim(p_payment_reference) = ''
     or p_transaction_reference is null or trim(p_transaction_reference) = '' then
    return json_build_object('success', false, 'code', 'missing_reference');
  end if;
  if p_amount_paid is null or p_amount_paid <= 0 then
    return json_build_object('success', false, 'code', 'invalid_amount');
  end if;

  -- Resolve the owner exclusively through the stored Monnify account mapping.
  select user_id, status
    into v_user_id, v_account_status
    from public.monnify_reserved_accounts
   where account_reference = p_account_reference
   for update;

  -- The mapping row is created before the Monnify request. Accept its creating
  -- state too, so a very fast transfer cannot arrive before account details
  -- have been persisted. The provider verification in the webhook is required.
  if not found or v_account_status not in ('creating', 'pending', 'active') then
    return json_build_object('success', false, 'orphan', true, 'code', 'unknown_or_inactive_account');
  end if;

  -- The transaction reference is the idempotency key shared with the existing
  -- dynamic-account path, so one Monnify collection can never credit twice.
  insert into public.monnify_events (transaction_reference, payment_reference, event_type, payload)
  values (
    p_transaction_reference,
    p_payment_reference,
    coalesce(p_event_type, 'SUCCESSFUL_TRANSACTION'),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (transaction_reference) do nothing;

  if not found then
    return json_build_object('success', true, 'duplicate', true, 'code', 'duplicate_event');
  end if;

  select coalesce(balance, 0)
    into v_current_balance
    from public.wallets
   where user_id = v_user_id
   for update;
  if not found then
    raise exception 'Wallet not found for Monnify reserved account';
  end if;

  if exists (select 1 from public.transactions where reference = p_transaction_reference) then
    raise exception 'Payment reference already exists';
  end if;

  v_new_balance := v_current_balance + p_amount_paid;

  insert into public.transactions (
    user_id, type, category, amount, balance_before, balance_after,
    status, reference, description, metadata
  ) values (
    v_user_id, 'credit', 'wallet_funding', p_amount_paid,
    v_current_balance, v_new_balance, 'completed', p_transaction_reference,
    'Monnify permanent account wallet funding',
    jsonb_build_object(
      'source', 'monnify_reserved_account',
      'account_reference', p_account_reference,
      'payment_reference', p_payment_reference
    )
  ) returning id into v_transaction_id;

  update public.wallets
     set balance = v_new_balance,
         updated_at = now()
   where user_id = v_user_id;

  insert into public.notifications (user_id, title, message)
  values (
    v_user_id,
    'Wallet Funded',
    '₦' || to_char(p_amount_paid, 'FM999,999,999,999.00') ||
      ' has been added to your Verronex wallet.'
  );

  return json_build_object(
    'success', true,
    'credited', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance
  );

exception
  when unique_violation then
    declare
      v_constraint text;
    begin
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'monnify_events_pkey' then
        return json_build_object('success', true, 'duplicate', true, 'code', 'duplicate_event_race');
      end if;
      raise;
    end;
end;
$$;

revoke all on function public.process_monnify_reserved_account_payment(text, text, text, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_monnify_reserved_account_payment(text, text, text, numeric, text, jsonb)
  to service_role;

commit;

notify pgrst, 'reload schema';
