# Transaction PIN deployment

The optional four-digit transaction PIN is enforced by Supabase Edge Functions and private Postgres RPCs. No production SQL or function deployment has been performed from this change.

## Deployment order

Use a short maintenance window. The Edge Functions call the new RPCs, while the SQL file revokes the old authenticated debit RPCs. Purchases fail closed between deploying the new functions and applying the SQL.

### Ordering hazard — do not apply the SQL early

Production currently runs **pre-PIN** Edge Functions: `purchase-data` v49 and
`purchase-airtime` v41 both call the legacy debit RPCs
`start_data_purchase(uuid, uuid, text)` and
`start_airtime_purchase(uuid, text, numeric, text, text)`.

`transaction_pin_security.sql` revokes EXECUTE on **both of those from
`service_role`** as well as from `public`, `anon` and `authenticated`.

Applying the SQL **before** deploying the updated purchase functions therefore
revokes the only RPC the live functions call, and **every data and airtime
purchase fails closed until the new functions are deployed**. Steps 2 and 3
must therefore complete before step 4.

The reverse order is not acceptable either: deploying functions first means they
call RPCs that do not exist yet, so purchases and PIN status both fail closed for
the length of the window between step 3 and step 4. That outage is bounded and
recoverable; the SQL-first outage is fixed only by deploying the functions. Take
the window for both.

1. Review the code and SQL, including the current workspace edits to `purchase-data/index.ts` and `complete_data_purchase_metadata_allowlist.sql`. Keep those changes intact when preparing a release.
2. Generate a random secret with at least 32 bytes of entropy. Store it in your deployment secret manager and set it as the Supabase Edge Function secret:

   ```text
   supabase secrets set TRANSACTION_PIN_PEPPER=<64-or-more-hex-characters>
   ```

   Do not put the value in the repository, frontend environment, SQL, or logs. Back it up securely: replacing it makes existing PIN verifiers unusable, so users would need account-verified PIN recovery.

3. Deploy the changed server functions first:

   ```text
   supabase functions deploy transaction-pin
   supabase functions deploy purchase-data
   supabase functions deploy purchase-airtime
   ```

   Until the SQL is applied, PIN status/setup calls and purchases fail closed because their table/RPCs are not present. Deploying functions first avoids a period where the new UI can set a PIN while the old debit RPCs still permit bypasses.

4. In the production Supabase SQL Editor, review and run all of [`transaction_pin_security.sql`](../supabase/sql/transaction_pin_security.sql) as one transaction. It expects the existing `start_data_purchase(uuid, uuid, text)` and `start_airtime_purchase(uuid, text, numeric, text, text)` functions. It creates the protected replacements and revokes direct execution of those legacy debit functions from `public`, `anon`, `authenticated`, and `service_role`.
5. Run [`verify_transaction_pin_security_READONLY.sql`](../supabase/sql/verify_transaction_pin_security_READONLY.sql). Confirm the two legacy start functions are not executable by `authenticated`, the new debit RPCs are executable only by `service_role`, and the PIN table has RLS enabled with no client policies.
6. Deploy the frontend. New PIN setup and purchases then use the protected functions. Users without a PIN can continue to purchase without one; once set, the server requires it for every data or airtime wallet debit.

The legacy purchase RPC definitions in `airtime_purchase_rpcs.sql`, `start_airtime_purchase_accounting.sql`, and `start_data_purchase_accounting.sql` now check whether `transaction_pin_security` exists. Reapplying them after this rollout will not restore client grants to the old debit RPCs.

The database SQL and three Edge Function deployments are still manual production operations. The SQL file is not a Supabase migration and must not be run with a production link or deploy command until approved.

## Behavior and operations

- The verifier is HMAC-SHA-256 over the user ID, a random per-user salt, and PIN, keyed with `TRANSACTION_PIN_PEPPER`. The pepper exists only in the Edge Function environment. The database stores neither the PIN nor a verifier that can be checked offline from a database-only copy.
- The PIN table has no `anon` or `authenticated` table privileges or RLS policies. Status calls return only whether a PIN exists and reminder settings.
- Purchase-start RPCs lock the user's PIN row, enforce the cooldown, and debit the wallet/create the pending transaction in the same database transaction. Wrong attempts persist in that transaction. Cooldowns rise from 5 seconds through 30 seconds, 5 minutes, 1 hour, 6 hours, and a 24-hour cap. A correct PIN or verified recovery clears the counters; there is no permanent lockout.
- A forgotten PIN reset sends the account password to the Edge Function, which verifies it directly with Supabase Auth in that request and checks the returned Auth user matches the signed-in account. The function does not persist or log the password, and the active session by itself cannot reset the PIN.
- Reminder choices live in the same private table: "Set up later" stores a 48-hour delay, and "Don't remind me again" suppresses later reminders across devices. Closing the reminder only dismisses it for the current visit; the next dashboard visit can remind again.
- Do not log request bodies or PIN candidates in any Edge Function. Keep the pepper stable and out of client-visible secrets.
