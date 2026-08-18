-- Removes the broken notification system from the live Supabase project.
-- Only the notification-specific table, its policies (dropped with the table),
-- and its realtime publication membership are removed. Nothing else is touched.

alter publication supabase_realtime drop table public.notifications;

drop table if exists public.notifications;
