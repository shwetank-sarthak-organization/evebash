-- Find You consent records (shared/legal/findYouConsent.ts). Rows are never deleted by users:
-- withdrawing stamps withdrawn_at, and giving consent again adds a new row.
begin;

create table if not exists public.find_you_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_version text not null,
  platform text not null check (platform in ('web', 'android', 'ios')),
  consent_text text not null,
  adult_confirmed boolean not null check (adult_confirmed),
  consented_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create unique index if not exists find_you_consents_active
  on public.find_you_consents (user_id, consent_version) where withdrawn_at is null;
alter table public.find_you_consents enable row level security;
revoke all on public.find_you_consents from anon, authenticated;
grant all on public.find_you_consents to service_role;

create or replace function public.get_find_you_consent()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_version constant text := '2026-10-11.1';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object('version', current_version, 'consented', exists (
    select 1 from public.find_you_consents
    where user_id = auth.uid() and consent_version = current_version and withdrawn_at is null
  ));
end;
$$;

create or replace function public.give_find_you_consent(p_version text, p_platform text, p_adult boolean, p_text text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_adult is distinct from true then raise exception 'Find You is only for people aged 18 or older'; end if;
  if p_version is distinct from '2026-10-11.1' then raise exception 'Consent wording changed. Refresh and try again.'; end if;
  if p_platform is null or p_platform not in ('web', 'android', 'ios') then raise exception 'Invalid platform'; end if;
  if coalesce(length(trim(p_text)), 0) = 0 or length(p_text) > 2000 then raise exception 'Invalid consent text'; end if;
  insert into public.find_you_consents (user_id, consent_version, platform, consent_text, adult_confirmed)
  values (auth.uid(), p_version, p_platform, p_text, true)
  on conflict (user_id, consent_version) where withdrawn_at is null do nothing;
end;
$$;

create or replace function public.withdraw_find_you_consent()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.find_you_consents set withdrawn_at = now()
  where user_id = auth.uid() and withdrawn_at is null;
end;
$$;

revoke all on function public.get_find_you_consent() from public, anon;
revoke all on function public.give_find_you_consent(text, text, boolean, text) from public, anon;
revoke all on function public.withdraw_find_you_consent() from public, anon;
grant execute on function public.get_find_you_consent() to authenticated;
grant execute on function public.give_find_you_consent(text, text, boolean, text) to authenticated;
grant execute on function public.withdraw_find_you_consent() to authenticated;

-- Refresh the API schema after creating/replacing the RPCs.
notify pgrst, 'reload schema';
commit;
