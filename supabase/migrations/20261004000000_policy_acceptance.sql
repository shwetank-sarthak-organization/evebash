-- Immutable, authenticated acceptance records. User metadata is not used as evidence.
begin;

create table if not exists public.policy_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null,
  platform text not null check (platform in ('web', 'android', 'ios')),
  accepted_at timestamptz not null default now(),
  acceptance_text text not null,
  primary key (user_id, policy_version)
);
alter table public.policy_acceptances enable row level security;
revoke all on public.policy_acceptances from anon, authenticated;
grant all on public.policy_acceptances to service_role;

create or replace function public.get_policy_acceptance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_version constant text := '2026-10-04.1';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object('version', current_version, 'accepted', exists (
    select 1 from public.policy_acceptances where user_id = auth.uid() and policy_version = current_version
  ));
end;
$$;

create or replace function public.accept_current_policies(p_version text, p_platform text, p_accepted boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_accepted is distinct from true then raise exception 'Explicit acceptance required'; end if;
  if p_version is distinct from '2026-10-04.1' then raise exception 'Policy version changed. Refresh and try again.'; end if;
  if p_platform is null or p_platform not in ('web', 'android', 'ios') then raise exception 'Invalid platform'; end if;
  insert into public.policy_acceptances (user_id, policy_version, platform, acceptance_text)
  values (auth.uid(), p_version, p_platform, 'I agree to the Terms & Conditions and acknowledge the Privacy Policy.')
  on conflict (user_id, policy_version) do nothing;
end;
$$;
revoke all on function public.get_policy_acceptance() from public, anon;
revoke all on function public.accept_current_policies(text, text, boolean) from public, anon;
grant execute on function public.get_policy_acceptance() to authenticated;
grant execute on function public.accept_current_policies(text, text, boolean) to authenticated;

-- Refresh the API schema after creating/replacing the RPCs.
notify pgrst, 'reload schema';
commit;
