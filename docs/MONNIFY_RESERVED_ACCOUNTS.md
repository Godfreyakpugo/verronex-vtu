# Monnify Permanent Reserved Accounts

This feature lets a signed-in customer create one permanent Monnify account from
the Fund Wallet page. The customer supplies a BVN or NIN only for the creation
request and explicitly consents to sending it to Monnify. Verronex stores the
selected ID type and consent time, but not the ID number.

## Hosted setup

Apply these steps in order:

1. Review and apply `supabase/sql/monnify_reserved_accounts.sql` to the intended
   Supabase project. It creates the account mapping table, customer read-only
   access policy, and service-role-only wallet-credit RPC. The file is not run
   by the frontend or deployment commands.
2. Deploy both functions to the same project:

   ```sh
   supabase functions deploy create-monnify-reserved-account --project-ref YOUR_PROJECT_REF
   supabase functions deploy monnify-webhook --project-ref YOUR_PROJECT_REF
   ```

   The account-creation function uses the existing `MONNIFY_ENABLED`,
   `MONNIFY_ENV`, `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`, and
   `MONNIFY_CONTRACT_CODE` Edge Function secrets. It also needs the standard
   Supabase URL, anon key, and service-role key.
3. Set the frontend build variable `VITE_MONNIFY_ENABLED=true` and redeploy the
   frontend. This reveals both permanent-account creation and the existing
   one-time Monnify funding option.
4. Confirm the Monnify dashboard webhook points to
   `https://<project-ref>.supabase.co/functions/v1/monnify-webhook` and that
   successful reserved-account collection events are enabled. The webhook
   resolves `eventData.product.reference` through the stored account mapping;
   it never selects the wallet owner by payer email.

Monnify permits only one active customer reserved account per customer email.
If that email already has an account created outside Verronex, the feature asks
the customer to contact support so the account can be linked safely. Sandbox
reserved accounts require Monnify's payment simulator; normal bank transfers
do not settle against sandbox accounts.

## Processing and safeguards

- The authenticated Edge Function validates BVN/NIN length and consent, fetches
  customer name and email from the signed-in profile, then creates the account
  server-to-server. It does not log the ID number.
- A stable per-user account reference and a provider lookup let a retry recover
  an account if Monnify created it but the response was not saved locally.
- The webhook checks Monnify's HMAC signature in live mode and verifies the
  transaction server-to-server before calling the wallet-credit RPC.
- The RPC locks the account and wallet, deduplicates on Monnify transaction
  reference, inserts the wallet transaction, updates the balance, and adds a
  notification in one database transaction.
- Reserved-account verification mismatches are recorded separately so an
  uncredited mismatch cannot occupy the transaction idempotency key and block a
  later valid webhook.
- Permanent-account webhook logs keep reconciliation references and amount but
  omit the payer name and source bank-account details.

The feature is implemented as on-request provisioning. It does not create an
account during signup, so signup does not depend on Monnify availability or ask
for identity information before the customer chooses to create the account.
