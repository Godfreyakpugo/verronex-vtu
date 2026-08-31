-- =============================================================================
-- Monnify Phase 0 — Database preparation
-- Extends funding_requests for Monnify mapping + creates monnify_events log.
-- Safe to re-run: all ALTER/CREATE use IF NOT EXISTS.
-- Apply each statement individually in Supabase SQL editor or via
-- `npx supabase db query --linked -f supabase/sql/monnify_phase0.sql`
-- =============================================================================

-- 1. Extend funding_requests with Monnify fields
alter table public.funding_requests
  add column if not exists payment_reference text;

alter table public.funding_requests
  add column if not exists transaction_reference text;

alter table public.funding_requests
  add column if not exists monnify_status text;

alter table public.funding_requests
  add column if not exists amount_paid numeric;

alter table public.funding_requests
  add column if not exists webhook_payload jsonb;

alter table public.funding_requests
  add column if not exists verified_at timestamptz;

-- 2. Unique partial indexes for Monnify references
create unique index if not exists funding_requests_payment_reference_uniq
  on public.funding_requests (payment_reference)
  where payment_reference is not null;

create unique index if not exists funding_requests_transaction_reference_uniq
  on public.funding_requests (transaction_reference)
  where transaction_reference is not null;

-- 3. Monnify webhook event log (idempotency + audit)
create table if not exists public.monnify_events (
  transaction_reference text primary key,
  payment_reference text not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Index on payment_reference for lookups
create index if not exists idx_monnify_events_payment_reference
  on public.monnify_events (payment_reference);

-- 4. Security: webhook data must not be exposed to frontend
alter table public.monnify_events enable row level security;

-- No policies are created — with RLS enabled and no policy, all roles except
-- service_role/bypass are denied. This matches the project's convention of
-- denying direct table access and using security-definer RPCs / service_role.
-- Explicitly revoke from public/anon/authenticated and grant to service_role
-- to make the intent clear regardless of default privileges.
revoke all on table public.monnify_events from public, anon, authenticated;
grant all on table public.monnify_events to service_role;
