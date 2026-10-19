-- =============================================================================
-- Optional customer transaction PIN
--
-- Apply manually in one SQL Editor run, during the coordinated deployment
-- described in docs/TRANSACTION_PIN_DEPLOYMENT.md. This file creates the
-- private PIN state, serializes PIN checks and debits, and revokes the legacy
-- authenticated purchase-start RPCs. It does not touch wallet credits,
-- refunds, or admin wallet adjustments.
-- =============================================================================

begin;

create table if not exists public.transaction_pin_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_salt text,
  pin_verifier text,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  cooldown_level integer not null default 0 check (cooldown_level between 0 and 6),
  locked_until timestamptz,
  reminder_after timestamptz,
  reminders_disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_pin_salt_verifier_pair
    check ((pin_salt is null) = (pin_verifier is null))
);

alter table public.transaction_pin_security enable row level security;
revoke all on table public.transaction_pin_security from public, anon, authenticated;
grant select, insert, update, delete on table public.transaction_pin_security to service_role;

-- Called only from the SECURITY DEFINER purchase-start and PIN-update
-- functions. The row lock makes failed attempts and their cooldowns
-- authoritative across devices and concurrent requests.
create or replace function public.transaction_pin_check(
  p_user_id uuid,
  p_candidate_verifier text
)
returns table (
  ok boolean,
  error_code text,
  cooldown_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin public.transaction_pin_security%rowtype;
  v_level integer;
  v_delay interval;
  v_until timestamptz;
begin
  -- Lock the stable Auth row as well as the optional PIN row. This closes the
  -- setup-vs-purchase race when no PIN row exists yet: a debit and first-time
  -- PIN setup are serialized even before the PIN row has been created.
  perform 1
    from auth.users as u
   where u.id = p_user_id
     for update;
  if not found then raise exception 'Not authorized.'; end if;

  select s.*
    into v_pin
    from public.transaction_pin_security as s
   where s.user_id = p_user_id
     for update;

  -- No PIN is an allowed optional state. Once a verifier exists, every debit
  -- must present a candidate that matches it.
  if not found or v_pin.pin_verifier is null then
    return query select true, null::text, null::timestamptz;
    return;
  end if;

  if v_pin.locked_until is not null and v_pin.locked_until > clock_timestamp() then
    return query select false, 'pin_locked'::text, v_pin.locked_until;
    return;
  end if;

  if p_candidate_verifier is null then
    return query select false, 'pin_required'::text, null::timestamptz;
    return;
  end if;

  if p_candidate_verifier !~ '^[0-9a-f]{64}$'
     or p_candidate_verifier <> v_pin.pin_verifier then
    v_level := least(v_pin.cooldown_level + 1, 6);
    v_delay := case v_level
      when 1 then interval '5 seconds'
      when 2 then interval '30 seconds'
      when 3 then interval '5 minutes'
      when 4 then interval '1 hour'
      when 5 then interval '6 hours'
      else interval '24 hours'
    end;
    v_until := clock_timestamp() + v_delay;

    update public.transaction_pin_security as s
       set failed_attempts = s.failed_attempts + 1,
           cooldown_level = v_level,
           locked_until = v_until,
           updated_at = clock_timestamp()
     where s.user_id = p_user_id;

    return query select false, 'pin_invalid'::text, v_until;
    return;
  end if;

  update public.transaction_pin_security as s
     set failed_attempts = 0,
         cooldown_level = 0,
         locked_until = null,
         updated_at = clock_timestamp()
   where s.user_id = p_user_id;

  return query select true, null::text, null::timestamptz;
end;
$$;

-- PIN setup/change. Recovery may bypass the old PIN only when the Edge
-- Function has independently verified the account password with Supabase Auth
-- in the current request. The boolean is safe here because only service_role
-- can execute this function and that key remains server-side.
create or replace function public.transaction_pin_set(
  p_user_id uuid,
  p_pin_salt text,
  p_pin_verifier text,
  p_current_verifier text,
  p_recovery_verified boolean
)
returns table (
  ok boolean,
  error_code text,
  cooldown_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin public.transaction_pin_security%rowtype;
  v_check record;
begin
  if p_user_id is null
     or p_pin_salt is null or p_pin_salt !~ '^[0-9a-f]{32}$'
     or p_pin_verifier is null or p_pin_verifier !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid transaction PIN verifier data.';
  end if;

  perform 1
    from auth.users as u
   where u.id = p_user_id
     for update;
  if not found then raise exception 'Not authorized.'; end if;

  insert into public.transaction_pin_security (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select s.*
    into v_pin
    from public.transaction_pin_security as s
   where s.user_id = p_user_id
     for update;

  if v_pin.pin_verifier is not null and not coalesce(p_recovery_verified, false) then
    if p_current_verifier is null then
      return query select false, 'pin_already_set'::text, null::timestamptz;
      return;
    end if;

    select * into v_check
      from public.transaction_pin_check(p_user_id, p_current_verifier);
    if not v_check.ok then
      return query select false, v_check.error_code, v_check.cooldown_until;
      return;
    end if;
  end if;

  update public.transaction_pin_security as s
     set pin_salt = p_pin_salt,
         pin_verifier = p_pin_verifier,
         failed_attempts = 0,
         cooldown_level = 0,
         locked_until = null,
         updated_at = clock_timestamp()
   where s.user_id = p_user_id;

  return query select true, null::text, null::timestamptz;
end;
$$;

create or replace function public.transaction_pin_set_reminder(
  p_user_id uuid,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_action not in ('later', 'suppress') then
    raise exception 'Invalid reminder action.';
  end if;

  if p_action = 'later' then
    insert into public.transaction_pin_security (user_id, reminder_after)
    values (p_user_id, clock_timestamp() + interval '48 hours')
    on conflict (user_id) do update
      set reminder_after = clock_timestamp() + interval '48 hours',
          updated_at = clock_timestamp()
      where public.transaction_pin_security.reminders_disabled = false;
  else
    insert into public.transaction_pin_security (
      user_id, reminder_after, reminders_disabled
    ) values (p_user_id, null, true)
    on conflict (user_id) do update
      set reminder_after = null,
          reminders_disabled = true,
          updated_at = clock_timestamp();
  end if;

  return true;
end;
$$;

-- The authenticated versions could debit a wallet without any server-side PIN
-- check. New customer purchases must use the service_role-only RPCs below.
revoke all on function public.start_data_purchase(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.start_airtime_purchase(uuid, text, numeric, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.start_data_purchase_with_pin(
  p_user_id uuid,
  p_plan_id uuid,
  p_reference text,
  p_candidate_verifier text
)
returns table (
  ok boolean,
  error_code text,
  cooldown_until timestamptz,
  transaction_id uuid,
  api_plan_id text,
  network text,
  network_id integer,
  phone_price numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet_balance numeric;
  v_price numeric;
  v_api_plan_id text;
  v_network text;
  v_network_id integer;
  v_tx uuid;
  v_cost_price numeric;
  v_pin record;
begin
  if p_user_id is null then raise exception 'Not authorized.'; end if;

  select * into v_pin
    from public.transaction_pin_check(p_user_id, p_candidate_verifier);
  if not v_pin.ok then
    return query select false, v_pin.error_code, v_pin.cooldown_until,
      null::uuid, null::text, null::text, null::integer, null::numeric;
    return;
  end if;

  select dp.selling_price, dp.cost_price, dp.api_plan_id, dp.network, dp.network_id
    into v_price, v_cost_price, v_api_plan_id, v_network, v_network_id
    from public.data_plans as dp
   where dp.id = p_plan_id and dp.is_active = true;
  if not found then raise exception 'Invalid or inactive data plan'; end if;

  select w.balance into v_wallet_balance
    from public.wallets as w
   where w.user_id = p_user_id
     for update;
  if not found then raise exception 'Wallet not found'; end if;
  if v_wallet_balance < v_price then raise exception 'Insufficient balance'; end if;

  update public.wallets as w
     set balance = w.balance - v_price,
         updated_at = clock_timestamp()
   where w.user_id = p_user_id;

  insert into public.transactions (
    user_id, type, category, amount, balance_before, balance_after,
    status, reference, description, metadata
  ) values (
    p_user_id, 'debit', 'data', v_price, v_wallet_balance,
    v_wallet_balance - v_price, 'pending', p_reference, 'Data purchase',
    jsonb_build_object(
      'service', 'data',
      'provider', 'gladtidings',
      'plan_name', (select dp.plan_name from public.data_plans as dp where dp.id = p_plan_id),
      'plan_network', v_network,
      'plan_amount', v_price,
      'cost_price', v_cost_price,
      'network_id', v_network_id,
      'api_plan_id', v_api_plan_id
    )
  ) returning id into v_tx;

  return query select true, null::text, null::timestamptz,
    v_tx, v_api_plan_id, v_network, v_network_id, v_price;
end;
$$;

create or replace function public.start_airtime_purchase_with_pin(
  p_user_id uuid,
  p_network text,
  p_amount numeric,
  p_phone text,
  p_reference text,
  p_candidate_verifier text
)
returns table (
  ok boolean,
  error_code text,
  cooldown_until timestamptz,
  transaction_id uuid,
  network_id integer,
  amount numeric,
  selling_price numeric,
  balance_after numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet public.wallets%rowtype;
  v_setting public.airtime_settings%rowtype;
  v_tx_id uuid;
  v_network_id integer;
  v_selling numeric;
  v_balance_after numeric;
  v_provider_cost numeric;
  v_pin record;
begin
  if p_user_id is null then raise exception 'Not authorized.'; end if;

  select * into v_pin
    from public.transaction_pin_check(p_user_id, p_candidate_verifier);
  if not v_pin.ok then
    return query select false, v_pin.error_code, v_pin.cooldown_until,
      null::uuid, null::integer, null::numeric, null::numeric, null::numeric;
    return;
  end if;

  v_network_id := case p_network
    when 'MTN' then 1 when 'GLO' then 2 when 'AIRTEL' then 3 when '9MOBILE' then 6
    else null end;
  if v_network_id is null then
    raise exception 'Invalid network. Use MTN, GLO, AIRTEL or 9MOBILE.';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount) then
    raise exception 'Invalid amount. Amount must be a positive whole Naira value.';
  end if;
  if p_phone is null or p_phone !~ '^0[7-9][0-9]{9}$' then
    raise exception 'Invalid phone number.';
  end if;

  if exists (select 1 from public.transactions as t where t.reference = p_reference) then
    return query
       select true, null::text, null::timestamptz, t.id, v_network_id,
        p_amount, t.amount, t.balance_after
        from public.transactions as t
       where t.reference = p_reference
         and t.user_id = p_user_id
         and t.status = 'pending';
    if not found then raise exception 'Reference % has already been used.', p_reference; end if;
    return;
  end if;

  select * into v_setting
    from public.airtime_settings as a
   where a.network = p_network and a.is_active = true
   limit 1;
  if not found then raise exception 'Airtime service is not available for %', p_network; end if;

  v_selling := round(p_amount * (1 - v_setting.user_discount / 100), 2);
  v_provider_cost := round(p_amount * (1 - v_setting.admin_discount / 100), 2);
  if v_selling <= 0 then raise exception 'Invalid selling price.'; end if;

  select * into v_wallet
    from public.wallets as w
   where w.user_id = p_user_id
     for update;
  if not found then raise exception 'Wallet not found for user.'; end if;
  if v_wallet.balance < v_selling then raise exception 'Insufficient wallet balance.'; end if;

  update public.wallets as w
     set balance = w.balance - v_selling,
         updated_at = clock_timestamp()
   where w.user_id = p_user_id
  returning w.balance into v_balance_after;

  insert into public.transactions (
    user_id, type, category, amount, balance_before, balance_after,
    status, reference, description, metadata
  ) values (
    p_user_id, 'debit', 'airtime_purchase', v_selling,
    v_balance_after + v_selling, v_balance_after, 'pending', p_reference,
    format('Airtime purchase of ₦%s (%s) to %s', p_amount, p_network, p_phone),
    jsonb_build_object(
      'service', 'airtime',
      'provider', 'gladtidings',
      'network', p_network,
      'network_id', v_network_id,
      'phone_number', p_phone,
      'face_value', p_amount,
      'selling_price', v_selling,
      'provider_cost', v_provider_cost,
      'user_discount', v_setting.user_discount,
      'admin_discount', v_setting.admin_discount
    )
  ) returning id into v_tx_id;

  return query select true, null::text, null::timestamptz,
    v_tx_id, v_network_id, p_amount, v_selling, v_balance_after;
end;
$$;

-- Expose only server-owned entry points. The Edge Functions authenticate the
-- customer, derive the candidate verifier with TRANSACTION_PIN_PEPPER, and
-- pass it to these atomic check-and-debit RPCs.
revoke all on function public.transaction_pin_check(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.transaction_pin_set(uuid, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.transaction_pin_set_reminder(uuid, text)
  from public, anon, authenticated;
revoke all on function public.start_data_purchase_with_pin(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.start_airtime_purchase_with_pin(uuid, text, numeric, text, text, text)
  from public, anon, authenticated;

grant execute on function public.transaction_pin_set(uuid, text, text, text, boolean)
  to service_role;
grant execute on function public.transaction_pin_set_reminder(uuid, text)
  to service_role;
grant execute on function public.start_data_purchase_with_pin(uuid, uuid, text, text)
  to service_role;
grant execute on function public.start_airtime_purchase_with_pin(uuid, text, numeric, text, text, text)
  to service_role;

comment on table public.transaction_pin_security is
  'Private verifier, server-side PIN attempt cooldown, and cross-device reminder state.';

commit;
