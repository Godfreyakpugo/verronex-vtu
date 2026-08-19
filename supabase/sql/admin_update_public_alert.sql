-- Edit the CURRENTLY ACTIVE public alert in place.
-- Updates ONLY title and message on the SAME row:
--   id, is_active, created_at, created_by all stay unchanged.
-- This is intentionally different from publish: no deactivation, no new row.

create or replace function public.admin_update_public_alert(
  p_alert_id uuid,
  p_title text,
  p_message text
)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_title text := trim(coalesce(p_title, ''));
  v_message text := trim(coalesce(p_message, ''));
  v_updated public.public_alerts%rowtype;
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

  if not exists (select 1 from public.public_alerts where id = p_alert_id) then
    raise exception 'Public alert not found';
  end if;

  if not exists (select 1 from public.public_alerts where id = p_alert_id and is_active = true) then
    raise exception 'Only active public alerts can be edited';
  end if;

  update public.public_alerts
     set title = v_title,
         message = v_message
   where id = p_alert_id
     and is_active = true
  returning * into v_updated;

  return json_build_object(
    'success', true,
    'id', v_updated.id,
    'title', v_updated.title,
    'message', v_updated.message,
    'is_active', v_updated.is_active,
    'created_at', v_updated.created_at,
    'created_by', v_updated.created_by
  );
end;
$$;

revoke execute on function public.admin_update_public_alert(uuid, text, text) from public;
revoke execute on function public.admin_update_public_alert(uuid, text, text) from anon;
grant execute on function public.admin_update_public_alert(uuid, text, text) to authenticated;
grant execute on function public.admin_update_public_alert(uuid, text, text) to service_role;