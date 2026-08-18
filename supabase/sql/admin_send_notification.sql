-- Admin-only notification sender.
-- Handles BOTH modes:
--   * specific user (p_send_to_all = false, p_user_id required, must be active)
--   * all active users (p_send_to_all = true, one row per active user)
-- Validation lives server-side: is_admin(), non-empty trimmed title/message,
-- and a valid active target user for specific mode.
-- Returns the number of notifications created.

create or replace function public.admin_send_notification(
  p_user_id uuid,
  p_send_to_all boolean,
  p_title text,
  p_message text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := trim(coalesce(p_title, ''));
  v_message text := trim(coalesce(p_message, ''));
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if v_title = '' then
    raise exception 'Title is required';
  end if;

  if v_message = '' then
    raise exception 'Message is required';
  end if;

  if coalesce(p_send_to_all, false) then
    insert into public.notifications (user_id, title, message)
    select id, v_title, v_message
    from public.profiles
    where deactivated_at is null;

    get diagnostics v_count = row_count;
  else
    if p_user_id is null then
      raise exception 'Target user is required';
    end if;

    perform 1 from public.profiles
      where id = p_user_id
        and deactivated_at is null;

    if not found then
      raise exception 'Target user not found or deactivated';
    end if;

    insert into public.notifications (user_id, title, message)
    values (p_user_id, v_title, v_message);

    v_count := 1;
  end if;

  return v_count;
end;
$$;

revoke execute on function public.admin_send_notification(uuid, boolean, text, text) from public;
revoke execute on function public.admin_send_notification(uuid, boolean, text, text) from anon;
grant execute on function public.admin_send_notification(uuid, boolean, text, text) to authenticated, service_role;