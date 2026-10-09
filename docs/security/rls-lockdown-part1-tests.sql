-- Tests for part 1 (supabase/migrations/20261007000000_rls_part1_gallery_link_functions.sql), with RLS still off.
-- Run: BEGIN + part 1 + 20261009000000_gallery_requests_after_rejection.sql (both without begin/commit) + this file,
-- in ONE request.
-- The final statement raises PART1_RESULTS[...] which also rolls everything back. Never add a COMMIT.
-- Checks that part 2 hasn't run (no eb_ triggers, no lockdown policies) rather than total counts, which other work changes.

-- Made-up test data (created as postgres, a trusted session)
insert into public.profiles (id, name, email, phone, role) values
  ('11111111-1111-4111-8111-111111111111', 'Part1 Owner',       'owner@part1.test',    '+910000000001', 'standard'),
  ('22222222-2222-4222-8222-222222222222', 'Part1 Guest Admin', 'gadmin@part1.test',   '+910000000002', 'user'),
  ('33333333-3333-4333-8333-333333333333', 'Part1 Member',      'member@part1.test',   '+910000000003', 'user'),
  ('44444444-4444-4444-8444-444444444444', 'Part1 Random',      'random@part1.test',   '+910000000004', 'user'),
  ('55555555-5555-4555-8555-555555555555', 'Part1 Admin',       'admin@part1.test',    '+910000000005', 'admin'),
  ('66666666-6666-4666-8666-666666666666', 'Part1 Other Host',  'other@part1.test',    '+910000000006', 'standard'),
  ('77777777-7777-4777-8777-777777777777', 'Part1 Rejected',    'rejected@part1.test', '+910000000007', 'user'),
  ('88888888-8888-4888-8888-888888888888', 'Part1 Pending',     'pending@part1.test',  '+910000000008', 'user');

-- The live owner-only trigger (guard_event_public_setting, kept by part 1) needs the owner's id to create public galleries
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
insert into public.events (id, title, created_by, is_public, parent_id, join_id, "order") values
  ('part1-private',    'Part1 Private',    '11111111-1111-4111-8111-111111111111', false, null, 'part1-join-private', null),
  ('part1-public',     'Part1 Public',     '11111111-1111-4111-8111-111111111111', true,  null, 'part1-join-public', null),
  ('part1-public-sub', 'Part1 Public Sub', '11111111-1111-4111-8111-111111111111', false, 'part1-public', null, 1),
  ('part1-fav',        'Part1 Favourites', '11111111-1111-4111-8111-111111111111', true,  null, null, null),
  ('part1-fav-sub',    'Part1 Fav Sub',    '11111111-1111-4111-8111-111111111111', false, 'part1-fav', null, 1),
  ('part1-other',      'Part1 Other',      '66666666-6666-4666-8666-666666666666', false, null, null, null);
select set_config('request.jwt.claims', '', true);

insert into public.photos (id, event_id, storage_key, url, preview_url, thumbnail_url, media_type, status, tags, user_id) values
  ('part1-p1',  'part1-private',    'part1/p1.jpg',  'https://m.test/part1/p1.jpg',  'https://m.test/part1/p1-preview.webp',  'https://m.test/part1/p1-thumb.webp',  'photo', 'processed', null, '11111111-1111-4111-8111-111111111111'),
  ('part1-p2',  'part1-public',     'part1/p2.jpg',  'https://m.test/part1/p2.jpg',  'https://m.test/part1/p2-preview.webp',  'https://m.test/part1/p2-thumb.webp',  'photo', 'processed', null, '11111111-1111-4111-8111-111111111111'),
  ('part1-v2',  'part1-public',     'part1/v2.mp4',  'https://m.test/hls/part1/v2/master.m3u8', null, 'https://m.test/hls/part1/v2/poster.jpg', 'video', 'processed', null, '11111111-1111-4111-8111-111111111111'),
  ('part1-v2x', 'part1-public',     'part1/v2x.mp4', 'https://m.test/part1/v2x.mp4', null, null, 'video', 'processing', null, '11111111-1111-4111-8111-111111111111'),
  ('part1-c2',  'part1-public',     'part1/c2.jpg',  'https://m.test/part1/c2.jpg',  'https://m.test/part1/c2-preview.webp',  'https://m.test/part1/c2-thumb.webp',  'photo', 'processed', '{__cover_usage__}', '11111111-1111-4111-8111-111111111111'),
  ('part1-u2',  'part1-public',     'part1/u2.jpg',  'https://m.test/part1/u2.jpg',  'https://m.test/part1/u2-preview.webp',  'https://m.test/part1/u2-thumb.webp',  'photo', 'uploading', null, '11111111-1111-4111-8111-111111111111'),
  ('part1-t2',  'part1-public',     'part1/t2.jpg',  'https://m.test/part1/t2.jpg',  null, 'https://m.test/part1/t2-thumb.webp', 'photo', 'processed', null, '11111111-1111-4111-8111-111111111111'),
  ('part1-p2s', 'part1-public-sub', 'part1/p2s.jpg', 'https://m.test/part1/p2s.jpg', 'https://m.test/part1/p2s-preview.webp', 'https://m.test/part1/p2s-thumb.webp', 'photo', 'processed', null, '11111111-1111-4111-8111-111111111111'),
  ('part1-f1',  'part1-fav-sub',    'part1/f1.jpg',  'https://m.test/part1/f1.jpg',  'https://m.test/part1/f1-preview.webp',  'https://m.test/part1/f1-thumb.webp',  'photo', 'processed', null, '11111111-1111-4111-8111-111111111111'),
  ('part1-f2',  'part1-fav-sub',    'part1/f2.jpg',  'https://m.test/part1/f2.jpg',  'https://m.test/part1/f2-preview.webp',  'https://m.test/part1/f2-thumb.webp',  'photo', 'processed', null, '11111111-1111-4111-8111-111111111111'),
  ('part1-f3',  'part1-fav',        'part1/f3.jpg',  'https://m.test/part1/f3.jpg',  'https://m.test/part1/f3-preview.webp',  'https://m.test/part1/f3-thumb.webp',  'photo', 'processed', null, '11111111-1111-4111-8111-111111111111');

-- Host favourites for part1-fav: f1 from its sub-gallery, plus a stray row pointing at a private photo (must not leak)
insert into public.event_favourite_photos (event_id, photo_id, marked_by) values
  ('part1-fav-sub', 'part1-f1', '11111111-1111-4111-8111-111111111111'),
  ('part1-fav-sub', 'part1-p1', '11111111-1111-4111-8111-111111111111');

insert into public.guests (id, name, phone, event_id, status, can_admin, can_upload, can_comment, user_id) values
  ('u_22222222-2222-4222-8222-222222222222_part1-private', 'Part1 Guest Admin', '+910000000002', 'part1-private', 'approved', true,  true,  true,  '22222222-2222-4222-8222-222222222222'),
  ('u_33333333-3333-4333-8333-333333333333_part1-private', 'Part1 Member',      '+910000000003', 'part1-private', 'approved', false, false, true,  '33333333-3333-4333-8333-333333333333'),
  ('u_77777777-7777-4777-8777-777777777777_part1-private', 'Part1 Rejected',    '+910000000007', 'part1-private', 'rejected', false, false, false, '77777777-7777-4777-8777-777777777777'),
  -- Asked while part1-public was still private (2026-10-09 rules: opening it now that it's public joins)
  ('u_77777777-7777-4777-8777-777777777777_part1-public',  'Part1 Rejected',    '+910000000007', 'part1-public',  'rejected', false, false, true,  '77777777-7777-4777-8777-777777777777'),
  ('u_88888888-8888-4888-8888-888888888888_part1-public',  'Part1 Pending',     '+910000000008', 'part1-public',  'pending',  false, false, true,  '88888888-8888-4888-8888-888888888888');

create temp table _r (n serial, who text, check_name text, expected text, actual text);
grant insert, select on _r to anon, authenticated;
grant usage on sequence _r_n_seq to anon, authenticated;

create function pg_temp.try_write(p_sql text) returns text language plpgsql as $$
declare v_rows int;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    raise exception using errcode = 'P0099', message = 'undo';
  exception
    when sqlstate 'P0099' then return 'rows=' || v_rows;
    when others then return 'blocked';
  end;
end $$;

create function pg_temp.try_call(p_sql text) returns text language plpgsql as $$
declare v_out text;
begin
  begin
    execute p_sql into v_out;
    return coalesce(v_out, 'null');
  exception when others then return 'blocked';
  end;
end $$;

-- ── Nothing else changed (checked as postgres) ─────────────────────────────────
insert into _r (who, check_name, expected, actual) values
  ('db', 'no lockdown policies yet',               '0', (select count(*) from pg_policies where schemaname = 'public' and policyname in ('events_select', 'photos_select', 'guests_select', 'profiles_select', 'likes_select', 'comments_select'))::text),
  ('db', 'no lockdown triggers yet',               '0', (select count(*) from pg_trigger where tgname like 'eb\_%')::text),
  ('db', 'owner-only visibility trigger kept',     'yes', case when exists (select 1 from pg_trigger where tgname = 'guard_event_public_setting') then 'yes' else 'no' end),
  ('db', 'RLS still off on the 14 core tables',    '0',  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity
                                                           and c.relname in ('events','photos','profiles','guests','comments','likes','messages','chat_rooms','allowed_users','pending_requests','profile_assigned_events','businesses','business_ratings','enquiries'))::text),
  ('db', 'visibility check function not created',  'no', case when exists (select 1 from pg_proc where proname = 'can_manage_event_visibility') then 'yes' else 'no' end),
  ('db', 'set_event_public_viewing still owner-only', 'yes', case when exists (select 1 from pg_proc where proname = 'set_event_public_viewing' and prosrc like '%Only the event creator%') then 'yes' else 'no' end),
  ('db', 'anon cannot run request_gallery_access', 'false', has_function_privilege('anon', 'public.request_gallery_access(text)', 'execute')::text),
  ('db', 'anon cannot run archive_deleted_event',  'false', has_function_privilege('anon', 'public.archive_deleted_event(text, int, int, bigint, text, timestamptz)', 'execute')::text),
  ('db', 'anon can run open_gallery',              'true',  has_function_privilege('anon', 'public.open_gallery(text)', 'execute')::text),
  ('db', 'anon can run get_public_gallery_media',  'true',  has_function_privilege('anon', 'public.get_public_gallery_media(text, int, int)', 'execute')::text),
  ('db', 'logged-in users cannot write profile_cards', 'false', (has_table_privilege('authenticated', 'public.profile_cards', 'update')
                                                                 or has_table_privilege('authenticated', 'public.profile_cards', 'delete')
                                                                 or has_table_privilege('authenticated', 'public.profile_cards', 'insert'))::text),
  ('db', 'anon cannot read profile_cards',         'false', has_table_privilege('anon', 'public.profile_cards', 'select')::text);

-- ── Anonymous visitor ──────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
insert into _r (who, check_name, expected, actual) values
  ('anon', 'existing direct reads still work (RLS off)', 'yes', case when (select count(*) from public.events) >= 31 then 'yes' else 'no' end),
  ('anon', 'open public gallery by id',          'public_view', public.open_gallery('part1-public') ->> 'access'),
  ('anon', 'open public gallery by join code',   'part1-public', public.open_gallery('part1-join-public') -> 'event' ->> 'id'),
  ('anon', 'public view hides owner and join code', 'hidden', case when (public.open_gallery('part1-public') -> 'event') ?| array['created_by', 'join_id'] then 'exposed' else 'hidden' end),
  ('anon', 'public view lists sub-gallery',      'part1-public-sub', public.open_gallery('part1-public') -> 'sub_events' -> 0 ->> 'id'),
  ('anon', 'sub-gallery link opens public view', 'public_view', public.open_gallery('part1-public-sub') ->> 'access'),
  ('anon', 'sub-gallery link lists siblings',    '1', jsonb_array_length(public.open_gallery('part1-public-sub') -> 'sub_events')::text),
  ('anon', 'private gallery asks to log in',     'login_required', public.open_gallery('part1-private') ->> 'access'),
  ('anon', 'private by join code asks to log in', 'login_required', public.open_gallery('part1-join-private') ->> 'access'),
  ('anon', 'unknown link',                       'not_found', public.open_gallery('part1-nope') ->> 'access'),
  ('anon', 'opening adds no guest row (2 seeded)', '2', (select count(*) from public.guests where event_id = 'part1-public')::text),
  ('anon', 'public media: photo, thumb-only photo, finished video', '3', (select count(*) from public.get_public_gallery_media('part1-public'))::text),
  ('anon', 'public media skips cover uploads',   '0', (select count(*) from public.get_public_gallery_media('part1-public') m where m.id = 'part1-c2')::text),
  ('anon', 'public media skips uploading rows',  '0', (select count(*) from public.get_public_gallery_media('part1-public') m where m.id = 'part1-u2')::text),
  ('anon', 'public media skips unfinished video', '0', (select count(*) from public.get_public_gallery_media('part1-public') m where m.id = 'part1-v2x')::text),
  ('anon', 'public media never returns originals', '0', (select count(*) from public.get_public_gallery_media('part1-public') m where m.preview_url ~ '/(p2|t2)\.jpg$' or m.stream_url ~ '\.jpg$')::text),
  ('anon', 'photo without preview uses thumbnail', 'https://m.test/part1/t2-thumb.webp', (select m.preview_url from public.get_public_gallery_media('part1-public') m where m.id = 'part1-t2')),
  ('anon', 'video comes as HLS stream',          'https://m.test/hls/part1/v2/master.m3u8', (select m.stream_url from public.get_public_gallery_media('part1-public') m where m.id = 'part1-v2')),
  ('anon', 'photos have no stream url',          '0', (select count(*) from public.get_public_gallery_media('part1-public') m where m.media_type = 'photo' and m.stream_url is not null)::text),
  ('anon', 'paging: limit 2 then offset 2',      '2+1', (select count(*) from public.get_public_gallery_media('part1-public', 2, 0))::text || '+' || (select count(*) from public.get_public_gallery_media('part1-public', 2, 2))::text),
  ('anon', 'sub-gallery inherits public',        '1', (select count(*) from public.get_public_gallery_media('part1-public-sub'))::text),
  ('anon', 'home shows host favourites only',    'part1-f1', (select string_agg(m.id, ',') from public.get_public_gallery_media('part1-fav') m)),
  ('anon', 'stray favourite of a private photo not shown', '0', (select count(*) from public.get_public_gallery_media('part1-fav') m where m.id = 'part1-p1')::text),
  ('anon', 'sub-gallery shows all its media',    '2', (select count(*) from public.get_public_gallery_media('part1-fav-sub'))::text),
  ('anon', 'private media returns nothing',      '0', (select count(*) from public.get_public_gallery_media('part1-private'))::text),
  ('anon', 'other host media returns nothing',   '0', (select count(*) from public.get_public_gallery_media('part1-other'))::text),
  ('anon', 'cannot request gallery access',      'blocked', pg_temp.try_call($$select public.request_gallery_access('part1-private')$$)),
  ('anon', 'cannot write deletion records',      'blocked', pg_temp.try_call($$select 'ok' from (select public.archive_deleted_event('part1-private', 1, 0, 10, 'x')) x$$)),
  ('anon', 'cannot read profile_cards',          'blocked', pg_temp.try_call($$select count(*)::text from public.profile_cards$$)),
  ('anon', 'tenant allowlist check works',       'false',   pg_temp.try_call($$select public.is_phone_allowed('+910000000000')::text$$));
reset role;

-- ── Random logged-in user ──────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","email":"random@part1.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('random', 'private gallery: can request',      'none', public.open_gallery('part1-private') ->> 'access'),
  ('random', 'request private access -> pending', 'pending', public.request_gallery_access('part1-private')),
  ('random', 'reopening shows pending',           'pending', public.open_gallery('part1-private') ->> 'access'),
  ('random', 'requesting again stays pending',    'pending', public.request_gallery_access('part1-join-private')),
  ('random', 'open public link joins gallery',    'member', public.open_gallery('part1-public') ->> 'access'),
  ('random', 'member result carries real id',     'part1-public', public.open_gallery('part1-join-public') ->> 'event_id'),
  ('random', 'sub-gallery of joined public',      'member', public.open_gallery('part1-public-sub') ->> 'access'),
  ('random', 'unknown link',                      'not_found', public.open_gallery('part1-nope') ->> 'access'),
  ('random', 'sees names via profile_cards',      'Part1 Owner', (select c.name from public.profile_cards c where c.id = '11111111-1111-4111-8111-111111111111')),
  ('random', 'cannot rename someone via profile_cards', 'blocked', pg_temp.try_write($$update public.profile_cards set name = 'x' where id = '11111111-1111-4111-8111-111111111111'$$)),
  ('random', 'cannot delete via profile_cards',   'blocked', pg_temp.try_write($$delete from public.profile_cards where id = '11111111-1111-4111-8111-111111111111'$$)),
  ('random', 'cannot archive others'' gallery',   'blocked', pg_temp.try_call($$select 'ok' from (select public.archive_deleted_event('part1-private', 1, 0, 10, 'x')) x$$));
reset role;

-- ── Approved member, rejected guest, guest admin, owner, platform admin ────────
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","email":"member@part1.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('member', 'opens private gallery',             'member', public.open_gallery('part1-private') ->> 'access'),
  ('member', 'opens by join code with real id',   'part1-private', public.open_gallery('part1-join-private') ->> 'event_id'),
  ('member', 'asking again stays approved',       'approved', public.request_gallery_access('part1-private'));
reset role;

select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","email":"rejected@part1.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('rejected', 'declined guest sees the request screen', 'none', public.open_gallery('part1-private') ->> 'access');
insert into _r (who, check_name, expected, actual) values
  ('rejected', 'asking again -> pending',          'pending', public.request_gallery_access('part1-private'));
insert into _r (who, check_name, expected, actual) values
  ('rejected', 'reopening shows pending',          'pending', public.open_gallery('part1-private') ->> 'access'),
  ('rejected', 'rejected on a public gallery joins on open', 'member', public.open_gallery('part1-public') ->> 'access');
reset role;

select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated","email":"pending@part1.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('pending', 'pending request joins public gallery on open', 'member', public.open_gallery('part1-public') ->> 'access');
reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","email":"gadmin@part1.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('guest_admin', 'opens as manager',             'manage', public.open_gallery('part1-private') ->> 'access');
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","email":"owner@part1.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('owner', 'opens own private gallery',          'manage', public.open_gallery('part1-private') ->> 'access'),
  ('owner', 'opens own public gallery',           'manage', public.open_gallery('part1-public') ->> 'access'),
  ('owner', 'join code resolves to real id',      'part1-private', public.open_gallery('part1-join-private') ->> 'event_id'),
  ('owner', 'opening own gallery adds no guest row', '0', (select count(*) from public.guests where user_id = '11111111-1111-4111-8111-111111111111')::text),
  ('owner', 'can write deletion record',          'ok', pg_temp.try_call($$select 'ok' from (select public.archive_deleted_event('part1-fav', 1, 0, 100, 'user_web', now())) x$$)),
  ('owner', 'cannot archive other host gallery',  'blocked', pg_temp.try_call($$select 'ok' from (select public.archive_deleted_event('part1-other', 1, 0, 100, 'user_web', now())) x$$));
reset role;

select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","email":"admin@part1.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('admin', 'platform admin manages any gallery', 'manage', public.open_gallery('part1-other') ->> 'access');
reset role;

-- ── Facts checked as postgres ──────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into _r (who, check_name, expected, actual) values
  ('db', 'public join wrote an approved guest row with account', 'approved/true', (select g.status || '/' || g.can_comment::text from public.guests g where g.user_id = '44444444-4444-4444-8444-444444444444' and g.event_id = 'part1-public')),
  ('db', 'pending row approved after opening public', 'approved', (select status from public.guests where id = 'u_88888888-8888-4888-8888-888888888888_part1-public')),
  ('db', 'rejected row approved after opening public', 'approved', (select status from public.guests where id = 'u_77777777-7777-4777-8777-777777777777_part1-public')),
  ('db', 'rejected private re-request is pending', 'pending', (select status from public.guests where id = 'u_77777777-7777-4777-8777-777777777777_part1-private')),
  ('db', 'private request wrote one pending row', '1', (select count(*) from public.guests g where g.user_id = '44444444-4444-4444-8444-444444444444' and g.event_id = 'part1-private' and g.status = 'pending')::text),
  ('db', 'deletion record has real owner and date', 'yes', case when exists (select 1 from public.deleted_events_archive where event_id = 'part1-fav' and user_id = '11111111-1111-4111-8111-111111111111' and event_created_at is not null) then 'yes' else 'no' end),
  ('db', 'no record for the refused archive',     'no', case when exists (select 1 from public.deleted_events_archive where event_id = 'part1-other') then 'yes' else 'no' end);

-- ── Results (raising here rolls back the whole transaction) ────────────────────
do $$
begin
  raise exception 'PART1_RESULTS%', (
    select json_agg(json_build_object('who', who, 'check', check_name, 'expected', expected, 'actual', actual,
                                      'pass', expected = actual) order by n)::text from _r);
end $$;
