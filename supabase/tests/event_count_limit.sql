-- Run against a disposable migrated database (needs 20261107000000). All records are rolled back.
-- Covers: a plan's event limit for website/app sessions, sub-galleries and saves not counted, admins and the backend
-- not limited, and the friendly error.
begin;
insert into public.profiles (id, email, role) values
  ('11111111-1111-1111-1111-111111111111', 'free@example.com', 'user'),
  ('22222222-2222-2222-2222-222222222222', 'starter@example.com', 'starter'),
  ('33333333-3333-3333-3333-333333333333', 'admin@example.com', 'admin');
-- The free user already has one event, made under their email
insert into public.events (id, created_by, type) values ('lim-free-1', 'free@example.com', 'main');

create or replace function pg_temp.act_as(p_user text, p_role text default 'authenticated') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', p_role)::text, true);
$$;

do $$
begin
  perform pg_temp.act_as('11111111-1111-1111-1111-111111111111');

  -- A second top-level event is refused, with the plan's numbers
  begin
    insert into public.events (id, created_by, type) values ('lim-free-2', '11111111-1111-1111-1111-111111111111', 'main');
    raise exception 'A free account made a second event';
  exception when sqlstate 'EBA02' then
    if sqlerrm <> 'Your plan allows 1 event, and you have 1. Upgrade your plan to create more.' then raise; end if;
  end;

  -- Sub-galleries aren't limited, and saving the existing event isn't a new one
  insert into public.events (id, parent_id, created_by, type) values ('lim-free-sub', 'lim-free-1', '11111111-1111-1111-1111-111111111111', 'sub');
  insert into public.events (id, created_by, type, title) values ('lim-free-1', 'free@example.com', 'main', 'Renamed')
    on conflict (id) do update set title = excluded.title;
  if (select title from public.events where id = 'lim-free-1') <> 'Renamed' then raise exception 'Save was blocked'; end if;

  -- Someone else's events don't count against you
  perform pg_temp.act_as('22222222-2222-2222-2222-222222222222');
  insert into public.events (id, created_by, type) values ('lim-starter-1', '22222222-2222-2222-2222-222222222222', 'main');

  -- Platform admins aren't limited
  perform pg_temp.act_as('33333333-3333-3333-3333-333333333333');
  insert into public.events (id, created_by, type) values ('lim-admin-1', '33333333-3333-3333-3333-333333333333', 'main');
  insert into public.events (id, created_by, type) values ('lim-admin-2', '33333333-3333-3333-3333-333333333333', 'main');

  -- Not logged in
  perform pg_temp.act_as('', 'anon');
  begin
    insert into public.events (id, created_by, type) values ('lim-anon', null, 'main');
    raise exception 'A logged-out visitor made an event';
  exception when sqlstate 'EBA02' then null;
  end;

  -- The backend (service role) isn't limited, e.g. support creating an event for the free user
  perform pg_temp.act_as('', 'service_role');
  insert into public.events (id, created_by, type) values ('lim-free-support', '11111111-1111-1111-1111-111111111111', 'main');
end $$;
rollback;
