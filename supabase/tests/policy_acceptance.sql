-- Run against a disposable migrated database. All test records are rolled back.
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
-- Supabase auth.uid also supports the claims JSON representation.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);
do $$ begin
  if (public.get_policy_acceptance()->>'accepted')::boolean then raise exception 'New user already accepted'; end if;
  begin
    perform public.accept_current_policies('old-version', 'web', true);
    raise exception 'Expected stale version rejection';
  exception when raise_exception then
    if sqlerrm = 'Expected stale version rejection' then raise; end if;
  end;
  begin
    perform public.accept_current_policies('2026-10-04.1', 'web', false);
    raise exception 'Expected unchecked rejection';
  exception when raise_exception then
    if sqlerrm = 'Expected unchecked rejection' then raise; end if;
  end;
  perform public.accept_current_policies('2026-10-04.1', 'web', true);
  perform public.accept_current_policies('2026-10-04.1', 'ios', true);
  if not (public.get_policy_acceptance()->>'accepted')::boolean then raise exception 'Acceptance not saved'; end if;
  begin
    delete from public.policy_acceptances;
    raise exception 'Client must not delete records';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002"}', true);
do $$ begin
  if (public.get_policy_acceptance()->>'accepted')::boolean then raise exception 'Another user inherited acceptance'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.policy_acceptances where user_id = '00000000-0000-0000-0000-000000000001') <> 1 then raise exception 'Repeated acceptance must be idempotent'; end if;
  if not exists (select 1 from public.policy_acceptances where user_id = '00000000-0000-0000-0000-000000000001' and platform = 'web' and accepted_at is not null) then raise exception 'Original acceptance was overwritten'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.get_policy_acceptance();
    raise exception 'Anonymous read should fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_current_policies('2026-10-04.1', 'web', true);
    raise exception 'Anonymous acceptance should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
