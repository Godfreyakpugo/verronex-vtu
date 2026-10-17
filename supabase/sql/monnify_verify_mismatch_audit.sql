-- =============================================================================
-- Monnify verify-mismatch audit (Phase 3B)
-- Service-role-only RPC that durably records a server-verification disagreement
-- on the matching PENDING funding request WITHOUT crediting, WITHOUT changing
-- status, and WITHOUT inserting a monnify_events row (a later valid webhook
-- delivery for the same request must still process normally, never looking
-- like a credited duplicate).
--
-- Atomicity: the request row is locked (FOR UPDATE), the
-- webhook_payload.verify_mismatches array is appended, and monnify_status /
-- verified_at are set — all in ONE database transaction. Concurrent mismatched
-- deliveries serialize on the row lock, so entries cannot overwrite each other.
--
-- Writes apply ONLY while status = 'pending' (checked under the lock). Missing
-- or already-settled requests return audited=false (nothing to reconcile).
-- Any failure raises/returns non-success so the webhook answers retryable 500
-- instead of acknowledging without durable evidence.
--
-- STATUS: uncommitted script, NOT applied to Supabase in this pass.
-- Apply manually (one statement at a time) BEFORE deploying the webhook code
-- that calls it — otherwise mismatch audits fail and mismatches 500-loop.
-- =============================================================================

create or replace function public.append_funding_verify_mismatch(
  p_payment_reference text,
  p_transaction_reference text,
  p_webhook_amount numeric,
  p_verified_amount numeric,
  p_reason text
)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_status text;
  v_payload jsonb;
  v_history jsonb;
  v_now timestamptz := now();
begin
  -- 0. Validate inputs
  if p_payment_reference is null or trim(p_payment_reference) = '' then
    return json_build_object('success', false, 'error', 'payment_reference required', 'code', 'missing_payment_ref');
  end if;
  if p_transaction_reference is null or trim(p_transaction_reference) = '' then
    return json_build_object('success', false, 'error', 'transaction_reference required', 'code', 'missing_trx_ref');
  end if;
  if p_webhook_amount is null or p_webhook_amount <= 0 then
    return json_build_object('success', false, 'error', 'webhook amount invalid', 'code', 'invalid_amount');
  end if;

  -- 1. Lock the funding request row by payment_reference (authoritative binding)
  select id, status, coalesce(webhook_payload, '{}'::jsonb)
    into v_id, v_status, v_payload
    from public.funding_requests
   where payment_reference = p_payment_reference
   for update;

  if not found then
    -- Orphan: no request to annotate, nothing to reconcile.
    return json_build_object('success', true, 'audited', false, 'code', 'no_request');
  end if;

  -- 2. Only annotate while still pending (checked under the lock, so a
  -- concurrent settlement win cannot be clobbered by a late mismatch).
  if v_status <> 'pending' then
    return json_build_object('success', true, 'audited', false, 'code', 'not_pending', 'status', v_status);
  end if;

  -- 3. Append the audit entry atomically (status stays pending, no events row,
  -- so a later valid delivery processes normally through process_monnify_funding).
  v_history := coalesce(v_payload -> 'verify_mismatches', '[]'::jsonb);
  if jsonb_typeof(v_history) <> 'array' then
    v_history := '[]'::jsonb;
  end if;

  v_payload := jsonb_set(
    v_payload,
    '{verify_mismatches}',
    v_history || jsonb_build_object(
      'reason', p_reason,
      'payment_reference', p_payment_reference,
      'transaction_reference', p_transaction_reference,
      'webhook_amount_paid', p_webhook_amount,
      'verified_amount_paid', p_verified_amount,
      'verified_at', v_now
    )
  );

  update public.funding_requests
     set monnify_status = 'VERIFY_MISMATCH',
         verified_at = v_now,
         webhook_payload = v_payload
   where id = v_id;

  return json_build_object(
    'success', true,
    'audited', true,
    'funding_request_id', v_id
  );
end;
$$;

-- Security: webhook-only. Frontend roles cannot execute; service_role (edge
-- function) is the sole caller. search_path is locked to '' with fully
-- qualified table references, matching the existing funding RPCs.
revoke all on function public.append_funding_verify_mismatch(text, text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.append_funding_verify_mismatch(text, text, numeric, numeric, text) to service_role;
