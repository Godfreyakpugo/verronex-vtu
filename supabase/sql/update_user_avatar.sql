-- =============================================================================
-- update_user_avatar — user-scoped profile avatar setter
--
-- STATUS: NOT APPLIED. No `avatars` storage bucket exists and no profile has
-- `avatar_url` set, so nothing in the app renders or writes an avatar. This
-- file is kept inert until avatars are actually built. Do NOT apply it as part
-- of unrelated work.
--
-- WHY THIS FILE WAS REWRITTEN
--   The previous version was a privilege-escalation bug waiting to be applied:
--
--     create or replace function public.update_user_avatar(p_user_id uuid,
--                                                           p_avatar_url text)
--     returns text
--     language plpgsql
--     security definer
--     set search_path to public
--     as $$ ... update public.profiles set avatar_url = ... where id = p_user_id; $$;
--
--   Three separate defects:
--     1. `p_user_id` is caller-supplied and never compared to the caller, so any
--        user could rewrite ANY profile's avatar_url.
--     2. No GRANT/REVOKE at all. PostgreSQL grants EXECUTE to PUBLIC by default,
--        so applying it as written exposed it to anon AND authenticated.
--     3. `set search_path to public` left a mutable search path in a
--        SECURITY DEFINER function.
--
--   Combined: an anonymous visitor could rewrite any profile row. Verified
--   2026-10-17 that the function is NOT present in the live project
--   (pg_proc returns no rows for update_user_avatar), so this was a landmine in
--   the repo rather than a live hole.
--
-- PREREQUISITES BEFORE ANY OF THIS IS USED
--   * a public `avatars` storage bucket
--   * storage RLS policies
--   * an upload UI
--   * the object URL must be built as
--       <SUPABASE_URL>/storage/v1/object/public/avatars/<userId>.<ext>
--     (the path used previously was missing /object/public and could only 404)
-- =============================================================================

create or replace function public.update_user_avatar(
  p_user_id      uuid,
  p_avatar_url   text
)
returns text
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Defence in depth. The grants below already exclude anon and every other
  -- user, but a SECURITY DEFINER function must not rely on grants alone for
  -- row-level authorisation.
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Not authorized.';
  end if;

  update public.profiles
     set avatar_url = p_avatar_url,
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'Profile not found.';
  end if;

  return 'Avatar updated successfully';
end;
$$;

-- Explicit ACL. Without this, PostgreSQL's default grants EXECUTE to PUBLIC,
-- which is what made the previous version dangerous.
revoke execute on function public.update_user_avatar(uuid, text) from public;
revoke execute on function public.update_user_avatar(uuid, text) from anon;
revoke execute on function public.update_user_avatar(uuid, text) from service_role;
grant  execute on function public.update_user_avatar(uuid, text) to authenticated;