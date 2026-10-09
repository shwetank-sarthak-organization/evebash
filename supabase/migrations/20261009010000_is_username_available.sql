-- Username availability check that keeps working once RLS is on (decided 2026-10-09, lockdown item B).
-- Profile edit and web sign-up asked "does any other profile use this username?" by reading profiles directly; after
-- the lockdown other people's profiles aren't readable, so every name would look free. This answers yes/no only.
-- Copied from docs/security/rls-lockdown-draft.sql; keep in sync. Rollback: drop function public.is_username_available(text);

begin;

-- Username "already taken" check for profile edit and sign-up, without exposing anyone's profile (other people's
-- profiles aren't readable once RLS is on). Usernames are stored lower-case; profiles_username_key enforces it on save.
create or replace function public.is_username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.profiles p
     where p.username = lower(trim(p_username))
       and p.id is distinct from auth.uid()::text
  )
$$;

revoke execute on function public.is_username_available(text) from public, anon, authenticated;
grant execute on function public.is_username_available(text) to authenticated;

commit;
