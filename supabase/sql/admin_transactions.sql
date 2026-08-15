-- ============================================================================
-- Admin transactions RPC (transaction history across users)
--
-- Apply in the Supabase SQL editor (or via the Management API). The repo has
-- no migration runner; schema is applied manually to the remote project.
--
-- SECURITY DEFINER + is_admin() gate: non-admins receive an empty result set.
-- Search matches the transaction reference, the user's name/email/username/
-- phone, and the recipient phone stored in transaction metadata.
--
-- Status mapping: requesting 'successful' matches both 'successful' and
-- 'completed' (wallet funding/debits are stored as 'completed').
-- ============================================================================

create or replace function public.admin_get_transactions(
  p_search text default null,
  p_category text default null,
  p_status text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  type text,
  category text,
  amount numeric,
  balance_before numeric,
  balance_after numeric,
  status text,
  reference text,
  description text,
  metadata jsonb,
  created_at timestamp with time zone,
  user_full_name text,
  user_email text,
  user_username text,
  user_phone text,
  user_tier text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.user_id,
    t.type,
    t.category,
    t.amount,
    t.balance_before,
    t.balance_after,
    t.status,
    t.reference,
    t.description,
    t.metadata,
    t.created_at,
    p.full_name,
    p.email,
    p.username,
    p.phone,
    p.user_tier
  from transactions t
  left join profiles p on p.id = t.user_id
  where public.is_admin()
    and (
      p_search is null
      or p_search = ''
      or t.reference ilike '%' || p_search || '%'
      or p.full_name ilike '%' || p_search || '%'
      or p.email ilike '%' || p_search || '%'
      or p.username ilike '%' || p_search || '%'
      or p.phone ilike '%' || p_search || '%'
      or coalesce(t.metadata ->> 'phone_number', '') ilike '%' || p_search || '%'
      or coalesce(t.metadata ->> 'mobile_number', '') ilike '%' || p_search || '%'
    )
    and (p_category is null or p_category = '' or t.category = p_category)
    and (
      p_status is null
      or p_status = ''
      or (p_status = 'successful' and t.status in ('successful', 'completed'))
      or t.status = p_status
    )
  order by t.created_at desc
  limit greatest(coalesce(p_limit, 20), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.admin_get_transactions(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_get_transactions(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_get_transactions(text, text, text, integer, integer) to service_role;
