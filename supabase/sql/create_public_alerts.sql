-- Public Alert system (separate from per-user notifications).
-- At most one ACTIVE public alert at a time. Publishing deactivates the
-- previous active alert; old alerts are retained as inactive history.
-- Writes happen ONLY through SECURITY DEFINER RPCs (no direct table
-- insert/update/delete policies).

create table if not exists public.public_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_public_alerts_active
  on public.public_alerts(is_active);

alter table public.public_alerts enable row level security;

-- Users may read the current active alert. Admins may read all alerts
-- (needed for the admin history section). No other access.
drop policy if exists "Users can read active public alerts" on public.public_alerts;
create policy "Users can read active public alerts"
  on public.public_alerts for select
  using (is_active = true or public.is_admin());

-- Deliberately NO insert / update / delete policies: the only write path
-- is admin_publish_public_alert / admin_deactivate_public_alert (both
-- SECURITY DEFINER and admin-gated).

revoke all on public.public_alerts from public;
revoke all on public.public_alerts from anon;
grant select on public.public_alerts to authenticated;
grant select on public.public_alerts to service_role;

-- ---------------------------------------------------------------------------
-- Admin RPC: publish a public alert.
-- Deactivates any current active alert, then inserts the new one as active.
-- ---------------------------------------------------------------------------
create or replace function public.admin_publish_public_alert(
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
  v_alert_id uuid;
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

  update public.public_alerts
     set is_active = false
   where is_active = true;

  insert into public.public_alerts (title, message, is_active, created_by)
  values (v_title, v_message, true, auth.uid())
  returning id into v_alert_id;

  return json_build_object(
    'success', true,
    'id', v_alert_id,
    'title', v_title,
    'message', v_message
  );
end;
$$;

revoke execute on function public.admin_publish_public_alert(text, text) from public;
revoke execute on function public.admin_publish_public_alert(text, text) from anon;
grant execute on function public.admin_publish_public_alert(text, text) to authenticated;
grant execute on function public.admin_publish_public_alert(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Admin RPC: deactivate the current active public alert.
-- ---------------------------------------------------------------------------
create or replace function public.admin_deactivate_public_alert()
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_alert_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select id into v_alert_id
    from public.public_alerts
   where is_active = true
   limit 1
   for update;

  if found then
    update public.public_alerts
       set is_active = false
     where id = v_alert_id;
  end if;

  return json_build_object(
    'success', true,
    'id', v_alert_id
  );
end;
$$;

revoke execute on function public.admin_deactivate_public_alert() from public;
revoke execute on function public.admin_deactivate_public_alert() from anon;
grant execute on function public.admin_deactivate_public_alert() to authenticated;
grant execute on function public.admin_deactivate_public_alert() to service_role;