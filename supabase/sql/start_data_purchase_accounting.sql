-- ============================================================================
-- start_data_purchase (updated to store provider cost in metadata for accounting)
-- ============================================================================
create or replace function public.start_data_purchase(
  p_user_id uuid,
  p_plan_id uuid,
  p_reference text
)
returns table (
  transaction_id uuid,
  api_plan_id text,
  network text,
  network_id integer,
  phone_price numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_balance numeric;
  v_price numeric;
  v_api_plan_id text;
  v_network text;
  v_network_id integer;
  v_tx uuid;
  v_cost_price numeric;
begin
  -- Lock wallet row
  SELECT w.balance
  INTO v_wallet_balance
  FROM wallets AS w
  WHERE w.user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
      RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Fetch plan (include cost_price for accounting)
  SELECT
      dp.selling_price,
      dp.cost_price,
      dp.api_plan_id,
      dp.network,
      dp.network_id
  INTO
      v_price,
      v_cost_price,
      v_api_plan_id,
      v_network,
      v_network_id
  FROM data_plans AS dp
  WHERE dp.id = p_plan_id
    AND dp.is_active = true;

  IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or inactive data plan';
  END IF;

  IF v_wallet_balance < v_price THEN
      RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Debit wallet
  UPDATE wallets
  SET
      balance = balance - v_price,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Create pending transaction (store cost_price in metadata for accounting)
  INSERT INTO transactions (
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
  ) VALUES (
      p_user_id,
      'debit',
      'data',
      v_price,
      v_wallet_balance,
      v_wallet_balance - v_price,
      'pending',
      p_reference,
      'Data purchase',
      jsonb_build_object(
        'service', 'data',
        'provider', 'gladtidings',
        'plan_name', (SELECT plan_name FROM data_plans WHERE id = p_plan_id),
        'plan_network', v_network,
        'plan_amount', v_price,
        'cost_price', v_cost_price,
        'network_id', v_network_id,
        'api_plan_id', v_api_plan_id
      )
  )
  RETURNING id INTO v_tx;

  RETURN QUERY
  SELECT
      v_tx,
      v_api_plan_id,
      v_network,
      v_network_id,
      v_price;
end;
$$;

revoke execute on function public.start_data_purchase(uuid, uuid, text) from public;
revoke execute on function public.start_data_purchase(uuid, uuid, text) from anon;
grant execute on function public.start_data_purchase(uuid, uuid, text) to authenticated;
grant execute on function public.start_data_purchase(uuid, uuid, text) to service_role;