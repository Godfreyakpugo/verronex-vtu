-- Run only after purchase-data and purchase-airtime use their service-role-only
-- completion/refund RPCs. Prevents customers from changing pending purchases
-- directly through the old settlement RPCs.

begin;

revoke all on function public.refund_purchase(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_data_purchase(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_airtime_purchase(text, jsonb)
  from public, anon, authenticated, service_role;

commit;
