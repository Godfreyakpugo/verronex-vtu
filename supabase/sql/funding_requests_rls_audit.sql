-- =============================================================================
-- AUDIT + PATCH (REQUIRES MANUAL REVIEW) — funding_requests RLS
-- =============================================================================
-- STATUS: NOT APPLIED. This file is documentation plus an optional patch.
-- Nothing in it has been run against the hosted Supabase project. Apply it by
-- hand in the Supabase SQL editor (one statement at a time) after running the
-- audit queries in STEP 1 and reading the result.
--
-- WHY THIS FILE EXISTS
--   `public.funding_requests` holds customer funding records: amount, the
--   customer-supplied bank reference, the auto-generated Monnify
--   payment_reference / transaction_reference, and the review decision.
--   No CREATE POLICY statement for this table exists anywhere in this repo,
--   and the only RLS in the repo is on `notifications`, `public_alerts` and
--   `monnify_events`. So whether the table is protected at all depends on
--   state that lives only in the hosted database and is NOT verifiable from
--   here.
--
--   The Buy Data / Buy Airtime / Fund Wallet UI now filters this table by
--   `user_id` in the query. That is defence in depth and good hygiene, but a
--   frontend filter is NOT a security control: PostgREST applies RLS, not the
--   query the browser happens to send. If RLS is off or permissive on this
--   table, any authenticated user can read (and, absent an INSERT policy,
--   possibly write) every other customer's funding rows by calling the REST
--   API directly from the console. You cannot rely on the UI filter for this.
--
-- SCOPE / SAFETY
--   This patch is ADDITIVE only:
--     * It enables RLS on the table (strictly a tightening).
--     * It creates three policies under fresh, namespaced names.
--     * It drops ONLY the three policies it creates by name, so the file is
--       re-runnable. It does not drop, alter or weaken any other policy.
--   Before running, check STEP 1 output: if policies already exist under
--   different names that are MORE permissive than the ones below, keep those
--   deliberately and do not run this patch blindly — enabling RLS alongside a
--   broader policy would not help, and you should decide the intended policy
--   set by hand.
--
--   The functions that move money do not go through these policies and are
--   unaffected: `process_monnify_funding` and `admin_process_funding_request` /
--   `admin_reject_funding_request` / `admin_credit_wallet` / `admin_debit_wallet`
--   are SECURITY DEFINER, and `service_role` bypasses RLS entirely. Client
--   INSERTs still work because the INSERT policy allows own-row inserts, which
--   is what `FundWallet.jsx` and the funding-init edge function rely on.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- STEP 1 — AUDIT ONLY (read-only, safe to run as-is)
-- Run these first and read the output before touching anything.
-- -----------------------------------------------------------------------------

-- 1a. Is RLS even enabled on the table?
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname = 'funding_requests';

-- 1b. What policies already exist? If this returns rows, compare them against
--     the ones in STEP 2 before applying anything.
select policyname,
       permissive,
       roles::text,
       cmd,
       qual,
       with_check
  from pg_policies
 where schemaname = 'public'
   and tablename = 'funding_requests'
 order by policyname;

-- 1c. Which roles can even reach the table directly?
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name = 'funding_requests'
 order by grantee, privilege_type;

-- 1d. Confirm `public.is_admin()` exists and is what the admin UI expects.
--     It is referenced by every admin_* RPC but is NOT defined in this repo,
--     so its definition must be verified here before relying on it below.
select p.oid::regprocedure as signature,
       pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'is_admin';

-- 1e. Realistic exposure check. Run as `authenticated` (not service_role) and
--     confirm you get zero rows belonging to someone else.
--     Expected before patching: possibly many rows (the bug).
--     Expected after patching:  only your own rows.
-- select id, user_id, amount, reference from public.funding_requests;


-- -----------------------------------------------------------------------------
-- STEP 2 — PATCH (only after reviewing STEP 1)
-- -----------------------------------------------------------------------------

alter table public.funding_requests enable row level security;

-- Own rows for customers, all rows for admins. Mirrors the pattern already
-- used in create_notifications.sql ("user_id = auth.uid() or public.is_admin()").
drop policy if exists "verronex_funding_requests_select_own_or_admin"
  on public.funding_requests;
create policy "verronex_funding_requests_select_own_or_admin"
  on public.funding_requests
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Customers may file their own request. `with check` is what stops a client
-- from inserting a row attributed to somebody else.
drop policy if exists "verronex_funding_requests_insert_own"
  on public.funding_requests;
create policy "verronex_funding_requests_insert_own"
  on public.funding_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Deliberately NO update or delete policy for `authenticated`.
-- Every state change (processed / rejected / credited) goes through a
-- SECURITY DEFINER RPC or service_role, so clients have no reason to write
-- these rows. With RLS enabled and no policy, those verbs are denied.
-- If you find a client that genuinely needs to update its own row, add a
-- narrowly scoped policy here rather than granting the table broadly.


-- -----------------------------------------------------------------------------
-- STEP 3 — VERIFY AFTER APPLYING
-- Re-run 1a and 1b (expect rls_enabled = true and the three statements above,
-- minus the dropped create-only ones), then re-run 1e as `authenticated`.
-- Also confirm the admin Funding Requests page still lists every customer's
-- requests, and that a customer still sees only their own.
-- -----------------------------------------------------------------------------