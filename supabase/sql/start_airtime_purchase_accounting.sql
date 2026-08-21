-- ============================================================================
-- start_airtime_purchase (updated to store provider cost in metadata for accounting)
-- ============================================================================
create or replace function public.start_airtime_purchase(
  p_user_id uuid,
  p_network text,
  p_amount numeric,
  p_phone text,
  p_reference text
)
returns table (
  transaction_id uuid,
  network_id integer,
  amount numeric,
  selling_price numeric,
  balance_after numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet wallets%rowtype;
  v_setting airtime_settings%rowtype;
  v_tx_id uuid;
  v_network_id integer;
  v_selling numeric;
  v_balance_after numeric;
  v_provider_cost numeric;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Not authorized.';
  end if;

  v_network_id := case p_network
    when 'MTN' then 1
    when 'GLO' then 2
    when 'AIRTEL' then 3
    when '9MOBILE' then 6
    else null
  end;

  if v_network_id is null then
    raise exception 'Invalid network. Use MTN, GLO, AIRTEL or 9MOBILE.';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount) then
    raise exception 'Invalid amount. Amount must be a positive whole Naira value.';
  end if;

  if p_phone is null or p_phone !~ '^0[7-9][0-9]{9}$' then
    raise exception 'Invalid phone number.';
  end if;

  select *
    into v_setting
    from airtime_settings
   where network = p_network
     and is_active = true
  limit 1;

  if not found then
    raise exception 'Airtime service is not available for %', p_network;
  end if;

  v_selling := round(p_amount * (1 - v_setting.user_discount / 100), 2);
  v_provider_cost := round(p_amount * (1 - v_setting.admin_discount / 100), 2);

  if v_selling <= 0 then
    raise exception 'Invalid selling price.';
  end if;

  if exists (select 1 from transactions where reference = p_reference) then
    return query
      select t.id, v_network_id, p_amount, t.amount, t.balance_after
        from transactions t
       where t.reference = p_reference
         and t.status = 'pending';

    if not found then
      raise exception 'Reference % has already been used.', p_reference;
    end if;

    return;
  end if;

  select *
    into v_wallet
    from wallets
   where user_id = p_user_id
   for update;

  if not found then
    raise exception 'Wallet not found for user.';
  end if;

  if v_wallet.balance < v_selling then
    raise exception 'Insufficient wallet balance.';
  end if;

  update wallets
     set balance = balance - v_selling,
         updated_at = now()
   where user_id = p_user_id
  returning balance into v_balance_after;

  insert into transactions (
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
  ) values (
    p_user_id,
    'debit',
    'airtime_purchase',
    v_selling,
    v_balance_after + v_selling,
    v_balance_after,
    'pending',
    p_reference,
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
  )
  returning id into v_tx_id;

  return query
    select v_tx_id, v_network_id, p_amount, v_selling, v_balance_after;
end;
$$;

revoke execute on function public.start_airtime_purchase(uuid, text, numeric, text, text) from public;
revoke execute on function public.start_airtime_purchase(uuid, text, numeric, text, text) from anon;
grant execute on function public.start_airtime_purchase(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.start_airtime_purchase(uuid, text, numeric, text, text) to service_role;