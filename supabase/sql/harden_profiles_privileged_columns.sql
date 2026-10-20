-- =============================================================================
-- Close self-service escalation of privileged profile columns.
--
-- FINDING (read-only audit, 2026-10-20)
--   `authenticated` holds UPDATE on public.profiles, and the only UPDATE policy
--   scopes rows with auth.uid() = id. A signed-in customer can therefore run:
--
--     update public.profiles set is_admin = true where id = auth.uid();
--
--   public.is_admin() reads that column, so self-promotion unlocks the entire
--   admin RPC surface, including admin_credit_wallet, admin_debit_wallet and
--   admin_set_transaction_status. That last one can settle or reverse a
--   purchase without provider confirmation, so this gap defeats both the PIN
--   check and the service-role-only settlement fix.
--
-- FIX
--   A BEFORE UPDATE trigger rejects changes to privileged columns when the
--   statement runs as a client role. The trigger function is deliberately
--   SECURITY INVOKER: inside a SECURITY DEFINER function `current_user` would
--   be the owner (postgres), so an invoker is required to observe the real
--   role. SECURITY DEFINER admin RPCs and dashboard/service_role maintenance
--   therefore keep working, because they execute as postgres or service_role.
--
-- Apply manually in one SQL Editor run. Not a Supabase migration.
-- =============================================================================

begin;

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- SECURITY INVOKER on purpose: current_user is the role executing the
  -- UPDATE. Direct PostgREST writes run as anon/authenticated. Writes from
  -- SECURITY DEFINER RPCs run as the function owner, and dashboard or
  -- service_role maintenance runs as postgres/service_role.
  if current_user in ('anon', 'authenticated') then
    if new.is_admin is distinct from old.is_admin
       or new.user_tier is distinct from old.user_tier
       or new.verification_status is distinct from old.verification_status
       or new.bvn_verified is distinct from old.bvn_verified
       or new.nin_verified is distinct from old.nin_verified
       or new.deactivated_at is distinct from old.deactivated_at
    then
      raise exception 'Not authorized to change protected profile fields.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_privileged_columns()
  from public, anon, authenticated, service_role;

drop trigger if exists guard_profile_privileged_columns on public.profiles;

create trigger guard_profile_privileged_columns
  before update on public.profiles
  for each row
  execute function public.guard_profile_privileged_columns();

commit;
