create or replace function public.admin_mark_transaction_delivered(
  p_transaction_id uuid,
  p_investigation_reason text
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
  v_status text;
begin
  -- Admin only check via is_admin()
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  -- Lock the transaction row
  select id, user_id, category, status
    into v_transaction, v_user_id, v_category, v_status
    from public.transactions
   where id = p_transaction_id
   for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  -- Reject already-delivered transactions
  if v_status = 'delivered' then
    raise exception 'This transaction has already been marked as delivered';
  end if;

  -- Reject inappropriate categories: only airtime/data debit transactions
  -- Funding credits and refunds should not be marked delivered
  if v_category not in ('airtime_purchase', 'data') then
    raise exception 'Mark-as-delivered not applicable for % transactions', v_category;
  end if;

  -- Validate investigation reason is provided
  if p_investigation_reason is null or trim(p_investigation_reason) = '' then
    raise exception 'Investigation reason is required to mark transaction as delivered';
  end if;

  -- Mark the transaction as delivered (terminal state)
  -- No wallet changes - just record the verified outcome
  update public.transactions
     set status = 'delivered',
         rejection_reason = p_investigation_reason,
         processed_by = auth.uid(),
         processed_at = now()
   where id = p_transaction_id;

  return json_build_object(
    'success', true,
    'transaction_id', v_transaction,
    'status', 'delivered',
    'investigation_reason', p_investigation_reason,
    'delivered_at', now()
  );
end
$$;