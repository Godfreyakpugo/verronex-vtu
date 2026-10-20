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

Steps 1-4 are complete in production and verified: `purchase-data` v52 and
`purchase-airtime` v44 call `refund_purchase_server` and
`complete_airtime_purchase_server` with the service-role client, all three old
settlement RPCs return `false` for `anon`, `authenticated` and `service_role`,
and both `_server` RPCs return `true` only for `service_role`.

## Privilege escalation via profiles.is_admin (applied and verified)

A read-only audit on 2026-10-20 found a second, independent way to alter a
purchase without the provider confirming it. `authenticated` holds UPDATE on
`public.profiles`, and the only UPDATE policy scopes rows with `auth.uid() = id`.
A signed-in customer can therefore set `is_admin = true` on their own row.
`public.is_admin()` reads that column, so self-promotion unlocks every admin
RPC, including `admin_credit_wallet` and `admin_set_transaction_status`.

This is applied in production and verified on 2026-10-20. To re-apply or audit:

1. Apply [`harden_profiles_privileged_columns.sql`](../supabase/sql/harden_profiles_privileged_columns.sql).
2. Run [`verify_profiles_privileged_columns_READONLY.sql`](../supabase/sql/verify_profiles_privileged_columns_READONLY.sql)
   and confirm `guard_trigger_present = 1`, `guard_is_security_invoker = 1` and
   `guard_search_path_pinned = 1`.

The trigger rejects direct client writes to `is_admin`, `user_tier`,
`verification_status`, `bvn_verified`, `nin_verified` and `deactivated_at`. It is
SECURITY INVOKER on purpose: inside a SECURITY DEFINER function `current_user`
is the owner, so an invoker is required to see the real role. SECURITY DEFINER
admin RPCs, `service_role`, and dashboard maintenance still work because they do
not execute as `anon` or `authenticated`.

Manual check, not an automated test: as a signed-in test customer, attempt
`update profiles set is_admin = true where id = auth.uid()` and confirm the
database raises `Not authorized to change protected profile fields.` Then confirm
a normal profile update still succeeds and an admin can still change a user tier
through `admin_update_user_tier`.

The Edge Functions still refund only after a provider rejection or missing
provider configuration. Pending purchases with an unknown provider outcome stay
pending and are not automatically refunded.

Do not rotate or delete the active PIN pepper: customers have already set PINs.
The current secret has no separate backup, so losing it would require users to
reset their PINs through account verification.

A browser retry after losing the response can still start a second purchase
with a new reference. The page prevents rapid repeat clicks, but server-side
request deduplication is a separate follow-up and is not included here.
