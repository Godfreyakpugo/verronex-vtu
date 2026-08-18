-- Notifications table (applied to remote DB 2026-08-18)
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'important_announcement',
  read_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  metadata jsonb default '{}'::jsonb,
  audience text default 'all' check (audience in ('all', 'specific')),
  target_user_id uuid references public.profiles(id),
  is_active boolean default true
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(user_id, read_at);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own read state" on public.notifications;
create policy "Users can update own read state"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins can create notifications" on public.notifications;
create policy "Admins can create notifications"
  on public.notifications for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

drop policy if exists "Admins can read all notifications" on public.notifications;
create policy "Admins can read all notifications"
  on public.notifications for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Enable realtime for the NotificationCenter postgres_changes subscription
alter publication supabase_realtime add table public.notifications;