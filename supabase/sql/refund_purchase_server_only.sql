-- Stage 1 of the refund hardening rollout.
-- Create the server-only refund endpoint before deploying Edge Functions that
-- call it. This leaves the old refund RPC untouched until Stage 2 revokes its
-- authenticated grant, avoiding a refund outage during the function rollout.
-- Apply manually in the Supabase SQL Editor.

begin;

create or replace function public.refund_purchase_server(
  p_reference text,
  p_reason text default 'Purchase failed'::text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_amount numeric;
  v_rows integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized.';
  end if;

  select t.user_id, t.amount
    into v_user_id, v_amount
    from public.transactions as t
   where t.reference = p_reference
     and t.status = 'pending'
     for update;

  -- Unknown or already-settled references stay harmless and replay-safe.
  if not found then
    return false;
  end if;

  if v_user_id is null or v_amount is null or v_amount <= 0 then
    raise exception 'Invalid pending purchase.';
  end if;

  update public.wallets as w
     set balance = coalesce(w.balance, 0) + v_amount,
         updated_at = clock_timestamp()
   where w.user_id = v_user_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Wallet not found for user %. Refund aborted.', v_user_id;
  end if;

  update public.transactions as t
     set status = 'failed',
         description = p_reason
   where t.reference = p_reference
     and t.status = 'pending';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Purchase refund could not be finalized.';
  end if;

  return true;
end;
$$;

revoke all on function public.refund_purchase_server(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.refund_purchase_server(text, text)
  to service_role;

commit;
