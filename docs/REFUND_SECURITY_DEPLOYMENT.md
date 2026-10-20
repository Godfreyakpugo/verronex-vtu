# Purchase settlement security follow-up

The first PIN rollout left old refund and completion functions executable by
signed-in customers. A customer could directly refund their own pending
purchase, or mark it complete without confirmation from the provider.

The fix uses service-role-only refund and airtime completion RPCs, then removes
customer access to the old functions. This follow-up is now applied in
production: both `_server` RPCs exist, `purchase-data` and `purchase-airtime`
call them with the service-role client, and the old settlement RPCs are revoked
from every client role (including `service_role`).

## Rollout order

1. Apply [`refund_purchase_server_only.sql`](../supabase/sql/refund_purchase_server_only.sql)
   and [`complete_airtime_purchase_server_only.sql`](../supabase/sql/complete_airtime_purchase_server_only.sql)
   in the Supabase SQL Editor. These add server-only paths without changing the
   old ones yet.
2. Deploy the updated `purchase-data` and `purchase-airtime` Edge Functions.
   They now use the server-only refund/completion paths.
3. Apply [`lockdown_customer_purchase_settlement_rpcs.sql`](../supabase/sql/lockdown_customer_purchase_settlement_rpcs.sql)
   in the SQL Editor. This removes customer access to the old refund and
   completion RPCs.
4. Run [`verify_purchase_settlement_security_READONLY.sql`](../supabase/sql/verify_purchase_settlement_security_READONLY.sql).
   Confirm the `_server` functions are executable by `service_role` only and the
   old functions are not executable by `anon`, `authenticated`, or
   `service_role`.

Do not reapply `refund_purchase_auth_guard.sql`,
`refund_purchase_ledger_entry_OPTIONAL.sql`, or
`complete_airtime_purchase_hardening_OPTIONAL.sql` as written after this
rollout. They contain older user-session settlement paths.

The Edge Functions still refund only after a provider rejection or missing
provider configuration. Pending purchases with an unknown provider outcome stay
pending and are not automatically refunded.

Do not rotate or delete the active PIN pepper: customers have already set PINs.
The current secret has no separate backup, so losing it would require users to
reset their PINs through account verification.

A browser retry after losing the response can still start a second purchase
with a new reference. The page prevents rapid repeat clicks, but server-side
request deduplication is a separate follow-up and is not included here.
