alter table public.notifications add column if not exists audience text default 'all' check (audience in ('all', 'specific'));
alter table public.notifications add column if not exists target_user_id uuid references public.profiles(id);
alter table public.notifications add column if not exists is_active boolean default true;
alter table public.notifications add column if not exists dismissed_at timestamp with time zone;