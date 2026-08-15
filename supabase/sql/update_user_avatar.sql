create or replace function public.update_user_avatar(p_user_id uuid, p_avatar_url text)
returns text
language plpgsql
security definer
set search_path to public
as $$
begin
  update public.profiles
     set avatar_url = p_avatar_url,
         updated_at = now()
   where id = p_user_id;

  return 'Avatar updated successfully';
end
$$;