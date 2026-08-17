-- ============================================================================
-- ADMIN USER REMOVE (deactivate)
--
-- Safe removal model: deactivate instead of hard-delete.
--
-- Why:
--   wallets.user_id, transactions.user_id, funding_requests.user_id all
--   reference profiles.id with ON DELETE CASCADE, and profiles.id references
--   auth.users.id with ON DELETE CASCADE (profiles_id_fkey).
--
--   Deleting the auth identity would therefore cascade: auth.users -> profiles
--   -> wallets/transactions/funding_requests — destroying the entire financial
--   ledger. That is why user removal DEACTIVATES the account instead:
--
--     1. add profiles.deactivated_at (nullable) — marks the account removed
--     2. exclude deactivated profiles from admin_get_users
--     3. the delete-user edge function sets profiles.deactivated_at and KEEPS
--        the auth identity + all profile/wallet/transaction/funding rows so
--        the financial ledger and audit history are preserved.
--     4. login is rejected for deactivated profiles (AuthContext reads the
--        profile with the caller's JWT and revokes the session).
--
-- Apply each statement individually to the live Supabase project.
--
-- Statements:
--   1. ALTER TABLE profiles ADD COLUMN deactivated_at
--   2. CREATE OR REPLACE admin_get_users (excludes deactivated)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add deactivated_at marker
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists deactivated_at timestamp with time zone;

-- -----------------------------------------------------------------------------
-- 2. admin_get_users excludes deactivated accounts
-- -----------------------------------------------------------------------------
create or replace function public.admin_get_users()
returns table (
  id uuid,
  full_name text,
  username text,
  email text,
  phone text,
  user_tier text,
  is_admin boolean,
  balance numeric,
  created_at timestamp with time zone
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    p.id,
    p.full_name,
    p.username,
    p.email,
    p.phone,
    p.user_tier,
    p.is_admin,
    coalesce(w.balance, 0),
    p.created_at
  from public.profiles p
  left join public.wallets w on p.id = w.user_id
  where p.deactivated_at is null
  order by p.created_at desc;
$$;

revoke execute on function public.admin_get_users() from public, anon;
grant execute on function public.admin_get_users() to authenticated;
grant execute on function public.admin_get_users() to service_role;
