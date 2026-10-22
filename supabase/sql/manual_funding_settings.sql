-- =============================================================================
-- Editable manual bank-transfer details for the Fund Wallet page.
-- Apply once in the hosted Supabase SQL Editor.
--
-- Customers can read the single public-facing settings row. Only the
-- admin-gated RPC can change it; authenticated clients receive no direct
-- INSERT, UPDATE, or DELETE permission on the table.
-- =============================================================================

begin;

create table if not exists public.manual_funding_settings (
  id smallint primary key default 1 check (id = 1),
  configured boolean not null default false,
  bank_name text not null default '',
  account_name text not null default '',
  account_number text not null default '',
  payment_instructions text not null default '',
  whatsapp_number text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.manual_funding_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.manual_funding_settings enable row level security;

drop policy if exists "verronex_manual_funding_settings_read"
  on public.manual_funding_settings;
create policy "verronex_manual_funding_settings_read"
  on public.manual_funding_settings
  for select
  to authenticated
  using (true);

revoke all on public.manual_funding_settings from public, anon, authenticated;
grant select on public.manual_funding_settings to authenticated;

create or replace function public.admin_update_manual_funding_settings(
  p_bank_name text,
  p_account_name text,
  p_account_number text,
  p_payment_instructions text,
  p_whatsapp_number text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bank_name text := trim(coalesce(p_bank_name, ''));
  v_account_name text := trim(coalesce(p_account_name, ''));
  v_account_number text := trim(coalesce(p_account_number, ''));
  v_payment_instructions text := trim(coalesce(p_payment_instructions, ''));
  v_whatsapp_number text := regexp_replace(trim(coalesce(p_whatsapp_number, '')), '[^0-9]', '', 'g');
  v_settings public.manual_funding_settings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if v_bank_name = '' then
    raise exception 'Bank name is required';
  end if;
  if char_length(v_bank_name) > 100 then
    raise exception 'Bank name must be 100 characters or fewer';
  end if;

  if v_account_name = '' then
    raise exception 'Account name is required';
  end if;
  if char_length(v_account_name) > 150 then
    raise exception 'Account name must be 150 characters or fewer';
  end if;

  if v_account_number !~ '^[0-9]{10}$' then
    raise exception 'Account number must contain exactly 10 digits';
  end if;

  if char_length(v_payment_instructions) > 1000 then
    raise exception 'Transfer instructions must be 1000 characters or fewer';
  end if;

  if v_whatsapp_number <> '' then
    if left(v_whatsapp_number, 1) = '0' then
      v_whatsapp_number := '234' || substring(v_whatsapp_number from 2);
    end if;
    if v_whatsapp_number !~ '^[0-9]{10,15}$' then
      raise exception 'WhatsApp number must contain 10 to 15 digits';
    end if;
  end if;

  insert into public.manual_funding_settings (
    id,
    configured,
    bank_name,
    account_name,
    account_number,
    payment_instructions,
    whatsapp_number,
    updated_at,
    updated_by
  )
  values (
    1,
    true,
    v_bank_name,
    v_account_name,
    v_account_number,
    v_payment_instructions,
    v_whatsapp_number,
    now(),
    auth.uid()
  )
  on conflict (id) do update
    set configured = excluded.configured,
        bank_name = excluded.bank_name,
        account_name = excluded.account_name,
        account_number = excluded.account_number,
        payment_instructions = excluded.payment_instructions,
        whatsapp_number = excluded.whatsapp_number,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
  returning * into v_settings;

  return jsonb_build_object(
    'success', true,
    'updated_at', v_settings.updated_at
  );
end;
$$;

revoke all on function public.admin_update_manual_funding_settings(text, text, text, text, text)
  from public, anon;
grant execute on function public.admin_update_manual_funding_settings(text, text, text, text, text)
  to authenticated;

commit;

-- Make the RPC available to PostgREST immediately after setup.
notify pgrst, 'reload schema';
