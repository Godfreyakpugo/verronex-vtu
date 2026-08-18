-- Phase 1 of the rebuilt notification system.
-- Minimal flow only: admin creates a notification for ONE user; that user
-- sees it in the bell and marks it read. No realtime, no announcements,
-- no audience targeting, no automatic notifications.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_notifications_user_id
  on public.notifications(user_id);

alter table public.notifications enable row level security;

-- Users can read only their own notifications. Admins may read all
-- (needed for the admin interface).
drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

-- Only admins can create notifications.
drop policy if exists "Admins can create notifications" on public.notifications;
create policy "Admins can create notifications"
  on public.notifications for insert
  with check (public.is_admin());

-- Users can update only their own notifications, and only their read_at
-- (the trigger below blocks any other column change).
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No delete policy: nobody can delete notifications in this phase.

-- Guard: a notification's title, message, and user_id can never be changed.
-- Only read_at may be updated (the mark-as-read flow).
create or replace function public.guard_notification_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.title is distinct from old.title
     or new.message is distinct from old.message
  then
    raise exception 'Only read_at can be updated on a notification';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_update_guard on public.notifications;
create trigger notifications_update_guard
  before update on public.notifications
  for each row execute function public.guard_notification_fields();
