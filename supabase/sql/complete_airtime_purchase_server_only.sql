-- Create the trusted airtime completion RPC before deploying the updated Edge
-- Function. It is safe to apply while the existing customer RPC remains live.

begin;

create or replace function public.complete_airtime_purchase_server(
  p_reference text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized.';
  end if;

  select t.*
    into v_tx
    from public.transactions as t
   where t.reference = p_reference
     for update;

  if not found then
    raise exception 'Transaction not found.';
  end if;

  if v_tx.status = 'successful' then
    return true;
  end if;

  if v_tx.status <> 'pending' then
    raise exception 'Transaction cannot be completed (status: %).', v_tx.status;
  end if;

  update public.transactions as t
     set status = 'successful',
         metadata = coalesce(v_tx.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
   where t.id = v_tx.id;

  return true;
end;
$$;

revoke all on function public.complete_airtime_purchase_server(text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_airtime_purchase_server(text, jsonb)
  to service_role;

commit;
