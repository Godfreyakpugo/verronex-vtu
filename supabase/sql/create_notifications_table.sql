create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  metadata jsonb default '{}'::jsonb
);

-- Index for user-specific queries
create index idx_notifications_user_id on public.notifications(user_id);
create index idx_notifications_read on public.notifications(user_id, read_at);

-- Row-level security
alter table public.notifications enable row level security;

-- Users can read only their own notifications
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Users can mark their own notifications as read
create policy "Users can update own read state"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins can create notifications (via service_role or authenticated with is_admin check)
-- This policy allows authenticated users with admin to create notifications
-- but prevents regular users from creating notifications for others
create policy "Admins can create notifications"
  on public.notifications for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );