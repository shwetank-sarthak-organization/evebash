-- Issue #25: everyone confirms once that they are 18 or older, with the new policy version 2026-11-27.1
-- (privacy policy section 30 "EB Vault" added the same day). The website and new app builds call the two new
-- functions below. App builds already on phones keep calling get_policy_acceptance / accept_current_policies with
-- the old version 2026-10-04.1 and keep working; they count either version as accepted, so nobody is stuck, and
-- those users get the 18+ box once their app is updated.
begin;

create or replace function public.get_current_policy_acceptance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_version constant text := '2026-11-27.1';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object('version', current_version, 'accepted', exists (
    select 1 from public.policy_acceptances where user_id = auth.uid() and policy_version = current_version
  ));
end;
$$;

create or replace function public.accept_policies(p_version text, p_platform text, p_accepted boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_accepted is distinct from true then raise exception 'Explicit acceptance required'; end if;
  if p_version is distinct from '2026-11-27.1' then raise exception 'Policy version changed. Refresh and try again.'; end if;
  if p_platform is null or p_platform not in ('web', 'android', 'ios') then raise exception 'Invalid platform'; end if;
  insert into public.policy_acceptances (user_id, policy_version, platform, acceptance_text)
  values (auth.uid(), p_version, p_platform, 'I confirm I am 18 or older, agree to the Terms & Conditions and acknowledge the Privacy Policy.')
  on conflict (user_id, policy_version) do nothing;
end;
$$;

-- Old app builds: still answer with the old version, but someone who already accepted the new one isn't asked again
create or replace function public.get_policy_acceptance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_version constant text := '2026-10-04.1';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object('version', current_version, 'accepted', exists (
    select 1 from public.policy_acceptances
    where user_id = auth.uid() and policy_version in ('2026-10-04.1', '2026-11-27.1')
  ));
end;
$$;

revoke all on function public.get_current_policy_acceptance() from public, anon;
revoke all on function public.accept_policies(text, text, boolean) from public, anon;
grant execute on function public.get_current_policy_acceptance() to authenticated;
grant execute on function public.accept_policies(text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
