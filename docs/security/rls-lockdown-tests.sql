-- Step 3 tests for rls-lockdown-draft.sql. Run: BEGIN + draft (without its begin/commit) + this file, in ONE request.
-- The final statement raises STEP3_RESULTS[...] which also rolls everything back. Never add a COMMIT.
-- Last run 2026-10-09 on the live DB: 147/147 passed, nothing persisted (adds username check, expired-plan limit
-- and sample galleries).
-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 3 TESTS. Runs after the draft inside the same transaction, which is always rolled back:
-- the last statement raises an error carrying the results, so nothing is ever committed.
-- ════════════════════════════════════════════════════════════════════════════════

-- Made-up test data (created as postgres, a trusted session)
insert into public.profiles (id, name, email, phone, role) values
  ('11111111-1111-4111-8111-111111111111', 'Step3 Owner',       'owner@step3.test',  '+910000000001', 'standard'),
  ('22222222-2222-4222-8222-222222222222', 'Step3 Guest Admin', 'gadmin@step3.test', '+910000000002', 'user'),
  ('33333333-3333-4333-8333-333333333333', 'Step3 Member',      'member@step3.test', '+910000000003', 'user'),
  ('44444444-4444-4444-8444-444444444444', 'Step3 Random',      'random@step3.test', '+910000000004', 'user'),
  ('55555555-5555-4555-8555-555555555555', 'Step3 Admin',       'admin@step3.test',  '+910000000005', 'admin'),
  ('66666666-6666-4666-8666-666666666666', 'Step3 Other Host',  'other@step3.test',  '+910000000006', 'standard'),
  ('77777777-7777-4777-8777-777777777777', 'Step3 Pending',     'pending@step3.test',  '+910000000007', 'user'),
  ('88888888-8888-4888-8888-888888888888', 'Step3 Rejected',    'rejected@step3.test', '+910000000008', 'user');

insert into public.events (id, title, created_by, is_public, parent_id, join_id) values
  ('step3-private',    'Step3 Private',    '11111111-1111-4111-8111-111111111111', false, null, 'step3-join-private'),
  ('step3-public',     'Step3 Public',     '11111111-1111-4111-8111-111111111111', true,  null, 'step3-join-public'),
  ('step3-public-sub', 'Step3 Public Sub', '11111111-1111-4111-8111-111111111111', false, 'step3-public', null),
  ('step3-empty',      'Step3 Empty',      '11111111-1111-4111-8111-111111111111', false, null, null),
  ('step3-other',      'Step3 Other',      '66666666-6666-4666-8666-666666666666', false, null, null);

insert into public.photos (id, event_id, storage_key, url, preview_url, thumbnail_url, media_type, status, user_id) values
  ('step3-p1',  'step3-private',    'step3/p1.jpg',  'https://m.test/step3/p1.jpg',  'https://m.test/step3/p1-preview.webp',  'https://m.test/step3/p1-thumb.webp',  'photo', 'processed', '11111111-1111-4111-8111-111111111111'),
  ('step3-p1b', 'step3-private',    'step3/p1b.jpg', 'https://m.test/step3/p1b.jpg', 'https://m.test/step3/p1b-preview.webp', 'https://m.test/step3/p1b-thumb.webp', 'photo', 'processed', '11111111-1111-4111-8111-111111111111'),
  ('step3-p2',  'step3-public',     'step3/p2.jpg',  'https://m.test/step3/p2.jpg',  'https://m.test/step3/p2-preview.webp',  'https://m.test/step3/p2-thumb.webp',  'photo', 'processed', '11111111-1111-4111-8111-111111111111'),
  ('step3-v2',  'step3-public',     'step3/v2.mp4',  'https://m.test/hls/step3/v2/master.m3u8', null, 'https://m.test/hls/step3/v2/poster.jpg', 'video', 'processed', '11111111-1111-4111-8111-111111111111'),
  ('step3-v2x', 'step3-public',     'step3/v2x.mp4', 'https://m.test/step3/v2x.mp4', null, null, 'video', 'processing', '11111111-1111-4111-8111-111111111111'),
  ('step3-p2s', 'step3-public-sub', 'step3/p2s.jpg', 'https://m.test/step3/p2s.jpg', 'https://m.test/step3/p2s-preview.webp', 'https://m.test/step3/p2s-thumb.webp', 'photo', 'processed', '11111111-1111-4111-8111-111111111111'),
  ('step3-p3',  'step3-other',      'step3/p3.jpg',  'https://m.test/step3/p3.jpg',  'https://m.test/step3/p3-preview.webp',  'https://m.test/step3/p3-thumb.webp',  'photo', 'processed', '66666666-6666-4666-8666-666666666666');

insert into public.guests (id, name, phone, event_id, status, can_admin, can_upload, can_comment, user_id) values
  ('u_22222222-2222-4222-8222-222222222222_step3-private', 'Step3 Guest Admin', '+910000000002', 'step3-private', 'approved', true,  true,  true, '22222222-2222-4222-8222-222222222222'),
  ('u_33333333-3333-4333-8333-333333333333_step3-private', 'Step3 Member',      '+910000000003', 'step3-private', 'approved', false, false, true, '33333333-3333-4333-8333-333333333333');

-- Requests made while step3-public was private, one still pending and one rejected (2026-10-09: opening it now joins)
insert into public.guests (id, name, phone, event_id, status, can_admin, can_upload, can_comment, user_id) values
  ('u_77777777-7777-4777-8777-777777777777_step3-public', 'Step3 Pending',  '+910000000007', 'step3-public', 'pending',  false, false, true, '77777777-7777-4777-8777-777777777777'),
  ('u_88888888-8888-4888-8888-888888888888_step3-public', 'Step3 Rejected', '+910000000008', 'step3-public', 'rejected', false, false, true, '88888888-8888-4888-8888-888888888888');

insert into public.likes (photo_id, user_id) values ('step3-p1', '33333333-3333-4333-8333-333333333333');
insert into public.comments (photo_id, user_id, text) values ('step3-p1', '33333333-3333-4333-8333-333333333333', 'step3 comment');
insert into public.faces (image_id, descriptor, event_id, image_url, width, height) values ('step3-p1', '{0.1,0.2,0.3}', 'step3-private', 'https://m.test/step3/p1-preview.webp', 100, 100);
insert into public.event_favourite_photos (event_id, photo_id, marked_by) values ('step3-private', 'step3-p1', '11111111-1111-4111-8111-111111111111');
insert into public.faces (image_id, descriptor, event_id, image_url, width, height) values ('step3-p2s', '{0.4}', 'step3-public-sub', 'https://m.test/step3/p2s-preview.webp', 100, 100);

-- Added 2026-10-07 for get_public_gallery_media: cover uploads and uploading rows are left out; a top-level gallery's
-- Home tab shows the host's favourites from its family (a stray favourite of another gallery's photo must not leak)
insert into public.events (id, title, created_by, is_public, parent_id) values
  ('step3-fav',     'Step3 Fav',     '11111111-1111-4111-8111-111111111111', true,  null),
  ('step3-fav-sub', 'Step3 Fav Sub', '11111111-1111-4111-8111-111111111111', false, 'step3-fav');
insert into public.photos (id, event_id, storage_key, url, preview_url, thumbnail_url, media_type, status, tags, user_id) values
  ('step3-c2', 'step3-public',  'step3/c2.jpg', 'https://m.test/step3/c2.jpg', 'https://m.test/step3/c2-preview.webp', 'https://m.test/step3/c2-thumb.webp', 'photo', 'processed', '{__cover_usage__}', '11111111-1111-4111-8111-111111111111'),
  ('step3-u2', 'step3-public',  'step3/u2.jpg', 'https://m.test/step3/u2.jpg', 'https://m.test/step3/u2-preview.webp', 'https://m.test/step3/u2-thumb.webp', 'photo', 'uploading', null, '11111111-1111-4111-8111-111111111111'),
  ('step3-f1', 'step3-fav-sub', 'step3/f1.jpg', 'https://m.test/step3/f1.jpg', 'https://m.test/step3/f1-preview.webp', 'https://m.test/step3/f1-thumb.webp', 'photo', 'processed', null, '11111111-1111-4111-8111-111111111111'),
  ('step3-f2', 'step3-fav-sub', 'step3/f2.jpg', 'https://m.test/step3/f2.jpg', 'https://m.test/step3/f2-preview.webp', 'https://m.test/step3/f2-thumb.webp', 'photo', 'processed', null, '11111111-1111-4111-8111-111111111111');
insert into public.event_favourite_photos (event_id, photo_id, marked_by) values
  ('step3-fav-sub', 'step3-f1', '11111111-1111-4111-8111-111111111111'),
  ('step3-fav-sub', 'step3-p1', '11111111-1111-4111-8111-111111111111');

-- Results table and a helper that tries a write, records the outcome, then undoes it
-- D/E data (2026-10-09): an expired paid owner, a paid owner in grace, and a private sample gallery
insert into public.profiles (id, name, email, phone, role, plan_end_date) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'step3 Expired Host', 'expired@step3.test', '+910000000010', 'standard', current_date - 10),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'step3 Grace Host',   'grace@step3.test',   '+910000000011', 'standard', current_date - 3);
insert into public.events (id, title, created_by, is_public, parent_id) values
  ('step3-exp',  'step3 Expired',       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true,  null),
  ('step3-exp2', 'step3 Expired Other', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false, null);
insert into public.events (id, title, created_by, is_public, parent_id) values
  ('step3-grace', 'step3 Grace', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true, null);
insert into public.events (id, title, created_by, is_public, parent_id, is_sample_gallery) values
  ('step3-sample',     'step3 Sample',     '11111111-1111-4111-8111-111111111111', false, null, true),
  ('step3-sample-sub', 'step3 Sample Sub', '11111111-1111-4111-8111-111111111111', false, 'step3-sample', false);
insert into public.photos (id, event_id, storage_key, url, preview_url, thumbnail_url, media_type, status, size, uploaded_at, user_id) values
  ('step3-eold', 'step3-exp2',  'x/eold.jpg', 'https://m.test/x/eold.jpg', 'https://m.test/x/eold-p.webp', 'https://m.test/x/eold-t.webp', 'photo', 'processed', 629145600, '2020-01-01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('step3-ea',   'step3-exp',   'x/ea.jpg',   'https://m.test/x/ea.jpg',   'https://m.test/x/ea-p.webp',   'https://m.test/x/ea-t.webp',   'photo', 'processed', 314572800, '2020-01-02', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('step3-eb',   'step3-exp',   'x/eb.jpg',   'https://m.test/x/eb.jpg',   'https://m.test/x/eb-p.webp',   'https://m.test/x/eb-t.webp',   'photo', 'processed', 209715200, '2020-01-03', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('step3-ga',   'step3-grace', 'x/ga.jpg',   'https://m.test/x/ga.jpg',   'https://m.test/x/ga-p.webp',   'https://m.test/x/ga-t.webp',   'photo', 'processed', 943718400, '2020-01-01', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('step3-gb',   'step3-grace', 'x/gb.jpg',   'https://m.test/x/gb.jpg',   'https://m.test/x/gb-p.webp',   'https://m.test/x/gb-t.webp',   'photo', 'processed', 943718400, '2020-01-02', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('step3-sp',   'step3-sample-sub', 'x/sp.jpg', 'https://m.test/x/sp.jpg', 'https://m.test/x/sp-p.webp', 'https://m.test/x/sp-t.webp', 'photo', 'processed', 1000, '2020-01-01', '11111111-1111-4111-8111-111111111111');

-- Usernames for the is_username_available checks (2026-10-09)
update public.profiles set username = 'step3owner' where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set username = 'step3random' where id = '44444444-4444-4444-8444-444444444444';

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

-- ── Anonymous visitor ──────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
insert into _r (who, check_name, expected, actual) values
  ('anon', 'cannot list galleries',              '0', (select count(*) from public.events where id like 'step3-%')::text),
  ('anon', 'cannot list photos',                 '0', (select count(*) from public.photos where id like 'step3-%')::text),
  ('anon', 'cannot read profiles',               '0', (select count(*) from public.profiles where id like '11111111%')::text),
  ('anon', 'cannot read guests (phones)',        '0', (select count(*) from public.guests where event_id like 'step3-%')::text),
  ('anon', 'cannot read face scans',             '0', (select count(*) from public.faces where event_id like 'step3-%')::text),
  ('anon', 'cannot read likes',                  '0', (select count(*) from public.likes where photo_id like 'step3-%')::text),
  ('anon', 'cannot read comments',               '0', (select count(*) from public.comments where photo_id like 'step3-%')::text),
  ('anon', 'cannot read favourites',             '0', (select count(*) from public.event_favourite_photos where event_id like 'step3-%')::text),
  ('anon', 'cannot read cost logs',              '0', (select count(*) from public.modal_cost_logs)::text),
  ('anon', 'cannot read deletion records',       '0', (select count(*) from public.deleted_events_archive)::text),
  ('anon', 'can read pricing plans',             'yes', case when (select count(*) from public.pricing_plans) > 0 then 'yes' else 'no' end),
  ('anon', 'open public gallery by id',          'public_view', public.open_gallery('step3-public') ->> 'access'),
  ('anon', 'open public gallery by join code',   'public_view', public.open_gallery('step3-join-public') ->> 'access'),
  ('anon', 'public view hides owner id',         'hidden', case when (public.open_gallery('step3-public') -> 'event') ? 'created_by' then 'exposed' else 'hidden' end),
  ('anon', 'public view lists sub-gallery',      '1', jsonb_array_length(public.open_gallery('step3-public') -> 'sub_events')::text),
  ('anon', 'private gallery asks to log in',     'login_required', public.open_gallery('step3-private') ->> 'access'),
  ('anon', 'unknown link',                       'not_found', public.open_gallery('step3-nope') ->> 'access'),
  ('anon', 'public media: photo + finished video', '2', (select count(*) from public.get_public_gallery_media('step3-public'))::text),
  ('anon', 'public media never returns originals', '0', (select count(*) from public.get_public_gallery_media('step3-public') m where m.preview_url like '%/p2.jpg' or m.stream_url like '%/p2.jpg')::text),
  ('anon', 'public media: video as HLS stream',  'yes', case when exists (select 1 from public.get_public_gallery_media('step3-public') m where m.media_type = 'video' and m.stream_url like '%master.m3u8') then 'yes' else 'no' end),
  ('anon', 'sub-gallery inherits public',        '1', (select count(*) from public.get_public_gallery_media('step3-public-sub'))::text),
  ('anon', 'private media returns nothing',      '0', (select count(*) from public.get_public_gallery_media('step3-private'))::text),
  ('anon', 'other host media returns nothing',   '0', (select count(*) from public.get_public_gallery_media('step3-other'))::text);
insert into _r (who, check_name, expected, actual) values
  ('anon', 'cannot edit a gallery',              'blocked', pg_temp.try_write($$update public.events set title = 'x' where id = 'step3-public'$$)),
  ('anon', 'cannot delete photos',               'blocked', pg_temp.try_write($$delete from public.photos where id = 'step3-p2'$$)),
  ('anon', 'cannot create a profile',            'blocked', pg_temp.try_write($$insert into public.profiles (id, name) values ('77777777-7777-4777-8777-777777777777', 'x')$$)),
  ('anon', 'cannot make anyone admin',           'blocked', pg_temp.try_write($$update public.profiles set role = 'admin' where id = '44444444-4444-4444-8444-444444444444'$$)),
  ('anon', 'cannot add guests',                  'blocked', pg_temp.try_write($$insert into public.guests (id, name, phone, event_id, status) values ('x', 'x', 'x', 'step3-private', 'approved')$$)),
  ('anon', 'can submit tenant access request',   'rows=1',  pg_temp.try_write($$insert into public.pending_requests (phone, name, requested_at) values ('+919999999999', 'step3', now())$$)),
  ('anon', 'cannot request gallery access',      'blocked', pg_temp.try_call($$select public.request_gallery_access('step3-private')$$)),
  ('anon', 'tenant allowlist check works',       'false',   pg_temp.try_call($$select public.is_phone_allowed('+910000000000')::text$$));
insert into _r (who, check_name, expected, actual) values
  ('anon', 'public media skips cover uploads and uploading rows', '0', (select count(*) from public.get_public_gallery_media('step3-public') m where m.id in ('step3-c2', 'step3-u2'))::text),
  ('anon', 'home shows host favourites only',    'step3-f1', (select string_agg(m.id, ',') from public.get_public_gallery_media('step3-fav') m)),
  ('anon', 'sub-gallery shows all its media',    '2', (select count(*) from public.get_public_gallery_media('step3-fav-sub'))::text),
  ('anon', 'cannot read profile_cards',          'blocked', pg_temp.try_call($$select count(*)::text from public.profile_cards$$));
reset role;

-- ── Random logged-in user (not a member of anything) ───────────────────────────
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","email":"random@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('random', 'sees no galleries before joining',  '0', (select count(*) from public.events where id like 'step3-%')::text),
  ('random', 'sees no photos before joining',     '0', (select count(*) from public.photos where id like 'step3-%')::text),
  ('random', 'sees only own profile',             '1', (select count(*) from public.profiles where id like '%-4%-8%' and name like 'Step3%')::text),
  ('random', 'cannot read others'' email/phone',  '0', (select count(*) from public.profiles where id = '11111111-1111-4111-8111-111111111111')::text),
  ('random', 'sees names via profile_cards',      'yes', case when exists (select 1 from public.profile_cards where id = '11111111-1111-4111-8111-111111111111') then 'yes' else 'no' end),
  ('random', 'cannot read face scans',            '0', (select count(*) from public.faces where event_id like 'step3-%')::text),
  ('random', 'cannot read cost logs',             '0', (select count(*) from public.modal_cost_logs)::text),
  ('random', 'cannot read deletion records',      '0', (select count(*) from public.deleted_events_archive)::text),
  ('random', 'cannot read company invoices',      '0', (select count(*) from public.infra_invoices)::text),
  ('random', 'private gallery: can request',      'none', public.open_gallery('step3-private') ->> 'access'),
  ('random', 'request private access -> pending', 'pending', public.request_gallery_access('step3-private')),
  ('random', 'still no access while pending',     '0', (select count(*) from public.events where id = 'step3-private')::text),
  ('random', 'open public link joins gallery',    'member', public.open_gallery('step3-public') ->> 'access');
insert into _r (who, check_name, expected, actual) values
  ('random', 'after joining: public + sub visible', '2', (select count(*) from public.events where id like 'step3-public%')::text),
  ('random', 'after joining: originals visible (download)', 'yes', case when exists (select 1 from public.photos where id = 'step3-p2' and url like '%/p2.jpg') then 'yes' else 'no' end),
  ('random', 'after joining: can comment by default', 'yes', case when exists (select 1 from public.guests where user_id = '44444444-4444-4444-8444-444444444444' and event_id = 'step3-public' and can_comment) then 'yes' else 'no' end),
  ('random', 'still cannot see other host',       '0', (select count(*) from public.events where id = 'step3-other')::text);
insert into _r (who, check_name, expected, actual) values
  ('random', 'can edit own name',                 'rows=1', pg_temp.try_write($$update public.profiles set name = 'renamed' where id = '44444444-4444-4444-8444-444444444444'$$)),
  ('random', 'cannot make self admin',            'blocked', pg_temp.try_write($$update public.profiles set role = 'admin' where id = '44444444-4444-4444-8444-444444444444'$$)),
  ('random', 'cannot give self a paid plan',      'blocked', pg_temp.try_write($$update public.profiles set role = 'standard', plan_end_date = '2030-01-01' where id = '44444444-4444-4444-8444-444444444444'$$)),
  ('random', 'cannot make self a manager',        'blocked', pg_temp.try_write($$update public.profiles set delegated_by = '11111111-1111-4111-8111-111111111111', role_type = 'primary' where id = '44444444-4444-4444-8444-444444444444'$$)),
  ('random', 'cannot edit someone else''s profile', 'rows=0', pg_temp.try_write($$update public.profiles set name = 'x' where id = '11111111-1111-4111-8111-111111111111'$$)),
  ('random', 'cannot approve own request',        'rows=0', pg_temp.try_write($$update public.guests set status = 'approved' where user_id = '44444444-4444-4444-8444-444444444444' and event_id = 'step3-private'$$)),
  ('random', 'can like a photo in joined gallery', 'rows=1', pg_temp.try_write($$insert into public.likes (photo_id, user_id) values ('step3-p2', '44444444-4444-4444-8444-444444444444')$$)),
  ('random', 'can comment in joined gallery',     'rows=1', pg_temp.try_write($$insert into public.comments (photo_id, user_id, text) values ('step3-p2', '44444444-4444-4444-8444-444444444444', 'hi')$$)),
  ('random', 'cannot like in private gallery',    'blocked', pg_temp.try_write($$insert into public.likes (photo_id, user_id) values ('step3-p1', '44444444-4444-4444-8444-444444444444')$$)),
  ('random', 'cannot like as someone else',       'blocked', pg_temp.try_write($$insert into public.likes (photo_id, user_id) values ('step3-p2', '33333333-3333-4333-8333-333333333333')$$)),
  ('random', 'cannot delete owner''s gallery',    'rows=0', pg_temp.try_write($$delete from public.events where id = 'step3-public'$$)),
  ('random', 'cannot change visibility',          'blocked', pg_temp.try_call($$select public.set_event_public_viewing('step3-private', true)::text$$)),
  ('random', 'cannot create gallery for someone else', 'blocked', pg_temp.try_write($$insert into public.events (id, title, created_by) values ('step3-fake', 'x', '11111111-1111-4111-8111-111111111111')$$)),
  ('random', 'can create own private gallery',    'rows=1', pg_temp.try_write($$insert into public.events (id, title, created_by) values ('step3-mine', 'x', '44444444-4444-4444-8444-444444444444')$$)),
  ('random', 'can create own public gallery',     'rows=1', pg_temp.try_write($$insert into public.events (id, title, created_by, is_public) values ('step3-mine-pub', 'x', '44444444-4444-4444-8444-444444444444', true)$$)),
  ('random', 'cannot mark sample gallery',        'blocked', pg_temp.try_write($$insert into public.events (id, title, created_by, is_sample_gallery) values ('step3-sample', 'x', '44444444-4444-4444-8444-444444444444', true)$$)),
  ('random', 'cannot add favourites in joined gallery', 'blocked', pg_temp.try_write($$insert into public.event_favourite_photos (event_id, photo_id) values ('step3-public', 'step3-p2')$$)),
  ('random', 'cannot archive others'' gallery',   'blocked', pg_temp.try_call($$select 'ok' from (select public.archive_deleted_event('step3-private', 1, 0, 10, 'x')) x$$)),
  ('random', 'cannot rename someone via profile_cards', 'blocked', pg_temp.try_write($$update public.profile_cards set name = 'x' where id = '11111111-1111-4111-8111-111111111111'$$)),
  ('random', 'cannot delete via profile_cards',   'blocked', pg_temp.try_write($$delete from public.profile_cards where id = '11111111-1111-4111-8111-111111111111'$$));
insert into _r (who, check_name, expected, actual) values
  ('random', 'username taken by someone else',    'false', public.is_username_available('step3owner')::text),
  ('random', 'username check ignores case/spaces', 'false', public.is_username_available(' Step3Owner ')::text),
  ('random', 'own username counts as free',       'true',  public.is_username_available('step3random')::text),
  ('random', 'unused username is free',           'true',  public.is_username_available('step3-unused-name')::text),
  ('random', 'anon cannot check usernames',       'false', has_function_privilege('anon', 'public.is_username_available(text)', 'execute')::text);
reset role;

-- ── Pending and rejected requests on a gallery that is now public ─────────────
select set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","email":"pending@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('pending', 'sees nothing before opening',       '0', (select count(*) from public.events where id = 'step3-public')::text),
  ('pending', 'opening the public gallery joins',  'member', public.open_gallery('step3-public') ->> 'access');
insert into _r (who, check_name, expected, actual) values
  ('pending', 'then sees the gallery',             '1', (select count(*) from public.events where id = 'step3-public')::text),
  ('pending', 'and its photos with originals',     'yes', case when exists (select 1 from public.photos where id = 'step3-p2' and url like '%/p2.jpg') then 'yes' else 'no' end);
reset role;

select set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated","email":"rejected@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('rejected', 'opening the public gallery joins', 'member', public.open_gallery('step3-public') ->> 'access');
insert into _r (who, check_name, expected, actual) values
  ('rejected', 'then sees the gallery',            '1', (select count(*) from public.events where id = 'step3-public')::text);
reset role;

-- ── Approved member of the private gallery ─────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","email":"member@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('member', 'sees the private gallery',          '1', (select count(*) from public.events where id = 'step3-private')::text),
  ('member', 'sees its photos with originals',    '2', (select count(*) from public.photos where event_id = 'step3-private' and url like 'https://m.test/step3/p1%')::text),
  ('member', 'sees likes and comments',           '2', ((select count(*) from public.likes where photo_id = 'step3-p1') + (select count(*) from public.comments where photo_id = 'step3-p1'))::text),
  ('member', 'sees host favourites',              '1', (select count(*) from public.event_favourite_photos where event_id = 'step3-private')::text),
  ('member', 'sees own membership row only',      '1', (select count(*) from public.guests where event_id = 'step3-private')::text),
  ('member', 'cannot see face scans',             '0', (select count(*) from public.faces where event_id = 'step3-private')::text);
insert into _r (who, check_name, expected, actual) values
  ('member', 'can delete own comment',            'rows=1', pg_temp.try_write($$delete from public.comments where photo_id = 'step3-p1' and user_id = '33333333-3333-4333-8333-333333333333'$$)),
  ('member', 'cannot delete photos',              'rows=0', pg_temp.try_write($$delete from public.photos where id = 'step3-p1b'$$)),
  ('member', 'cannot approve other guests',       'rows=0', pg_temp.try_write($$update public.guests set status = 'approved' where user_id = '44444444-4444-4444-8444-444444444444'$$)),
  ('member', 'cannot change favourites',          'blocked', pg_temp.try_write($$insert into public.event_favourite_photos (event_id, photo_id) values ('step3-private', 'step3-p1b')$$));
reset role;

-- ── Guest admin of the private gallery ─────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","email":"gadmin@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('guest_admin', 'sees the gallery',             '1', (select count(*) from public.events where id = 'step3-private')::text),
  ('guest_admin', 'sees all guest requests',      '3', (select count(*) from public.guests where event_id = 'step3-private')::text),
  ('guest_admin', 'open link reports manage',     'manage', public.open_gallery('step3-private') ->> 'access');
insert into _r (who, check_name, expected, actual) values
  ('guest_admin', 'can edit gallery details',     'rows=1', pg_temp.try_write($$update public.events set title = 'edited' where id = 'step3-private'$$)),
  ('guest_admin', 'can approve a pending guest',  'rows=1', pg_temp.try_write($$update public.guests set status = 'approved' where user_id = '44444444-4444-4444-8444-444444444444' and event_id = 'step3-private'$$)),
  ('guest_admin', 'can delete a photo',           'rows=1', pg_temp.try_write($$delete from public.photos where id = 'step3-p1b'$$)),
  ('guest_admin', 'can add favourites',           'rows=1', pg_temp.try_write($$insert into public.event_favourite_photos (event_id, photo_id) values ('step3-private', 'step3-p1b')$$)),
  ('guest_admin', 'can switch visibility',        'true',   pg_temp.try_call($$select public.set_event_public_viewing('step3-private', true)::text$$)),
  ('guest_admin', 'cannot delete the gallery',    'rows=0', pg_temp.try_write($$delete from public.events where id = 'step3-empty'$$)),
  ('guest_admin', 'cannot change gallery owner',  'blocked', pg_temp.try_write($$update public.events set created_by = '22222222-2222-4222-8222-222222222222' where id = 'step3-private'$$)),
  ('guest_admin', 'cannot mark sample gallery',   'blocked', pg_temp.try_write($$update public.events set is_sample_gallery = true where id = 'step3-private'$$)),
  ('guest_admin', 'cannot touch other host',      'rows=0', pg_temp.try_write($$update public.events set title = 'x' where id = 'step3-other'$$));
reset role;

-- ── Gallery owner ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","email":"owner@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('owner', 'sees all own galleries',             '4', (select count(*) from public.events where id in ('step3-private','step3-public','step3-public-sub','step3-empty'))::text),
  ('owner', 'does not see other host',            '0', (select count(*) from public.events where id = 'step3-other')::text),
  ('owner', 'sees guest requests',                '3', (select count(*) from public.guests where event_id = 'step3-private')::text),
  ('owner', 'cannot read face scans directly',    '0', (select count(*) from public.faces where event_id = 'step3-private')::text);
insert into _r (who, check_name, expected, actual) values
  ('owner', 'can switch visibility',              'false',  pg_temp.try_call($$select public.set_event_public_viewing('step3-private', false)::text$$)),
  ('owner', 'sub-gallery cannot change visibility', 'blocked', pg_temp.try_call($$select public.set_event_public_viewing('step3-public-sub', true)::text$$)),
  ('owner', 'direct face delete is a no-op (cascade does it)', 'rows=0', pg_temp.try_write($$delete from public.faces where event_id = 'step3-private'$$)),
  ('owner', 'can write deletion record',          'ok',     pg_temp.try_call($$select 'ok' from (select public.archive_deleted_event('step3-empty', 1, 0, 100, 'user_web', now())) x$$)),
  ('owner', 'cannot read deletion records (admin only)', '0', (select count(*) from public.deleted_events_archive where event_id = 'step3-empty')::text),
  ('owner', 'can delete own gallery',             'rows=1', pg_temp.try_write($$delete from public.events where id = 'step3-empty'$$)),
  ('owner', 'cannot make self admin',             'blocked', pg_temp.try_write($$update public.profiles set role = 'admin' where id = '11111111-1111-4111-8111-111111111111'$$)),
  ('owner', 'cannot delete other host gallery',   'rows=0', pg_temp.try_write($$delete from public.events where id = 'step3-other'$$));
delete from public.events where id = 'step3-public-sub';   -- kept (not undone): checked below as postgres
reset role;

-- ── EveBash platform admin (analytics dashboard) ───────────────────────────────
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","email":"admin@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('admin', 'sees every gallery',                 'yes', case when (select count(*) from public.events) >= 31 + 4 then 'yes' else 'no' end),
  ('admin', 'sees all profiles',                  'yes', case when (select count(*) from public.profiles) >= 5 + 6 then 'yes' else 'no' end),
  ('admin', 'reads cost logs',                    'yes', case when (select count(*) from public.modal_cost_logs) > 0 then 'yes' else 'no' end),
  ('admin', 'reads deletion records',             'yes', case when (select count(*) from public.deleted_events_archive) > 0 then 'yes' else 'no' end);
insert into _r (who, check_name, expected, actual) values
  ('admin', 'can change a user''s plan',          'rows=1', pg_temp.try_write($$update public.profiles set role = 'standard' where id = '44444444-4444-4444-8444-444444444444'$$)),
  ('admin', 'can mark sample gallery',            'rows=1', pg_temp.try_write($$update public.events set is_sample_gallery = true where id = 'step3-public'$$)),
  ('admin', 'can delete any gallery',             'rows=1', pg_temp.try_write($$delete from public.events where id = 'step3-empty'$$));
reset role;

-- ── D: expired-plan limit, E: sample galleries (2026-10-09) ────────────────────
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
insert into _r (who, check_name, expected, actual) values
  ('anon', 'expired owner: only media within 1 GB', 'step3-ea', (select string_agg(m.id, ',') from public.get_public_gallery_media('step3-exp') m)),
  ('anon', 'grace owner: everything still shows', '2', (select count(*) from public.get_public_gallery_media('step3-grace'))::text),
  ('anon', 'cannot ask for plan limits', 'blocked', pg_temp.try_call($$select public.get_media_plan_limit('step3-exp')::text$$)),
  ('anon', 'private sample gallery opens read-only', 'public_view', public.open_gallery('step3-sample') ->> 'access'),
  ('anon', 'sample flag in the payload', 'true', public.open_gallery('step3-sample') -> 'event' ->> 'is_sample_gallery'),
  ('anon', 'sample sub-gallery media', '1', (select count(*) from public.get_public_gallery_media('step3-sample-sub'))::text),
  ('anon', 'sample list has the gallery, not its sub', '1', (select count(*) from jsonb_array_elements(public.get_sample_galleries()) x where x ->> 'id' like 'step3-sample%')::text),
  ('anon', 'ordinary private gallery still asks to log in', 'login_required', public.open_gallery('step3-exp2') ->> 'access');
reset role;

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","email":"random@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('random', 'sample gallery: read-only, not joined', 'public_view', public.open_gallery('step3-sample') ->> 'access'),
  ('random', 'cannot see plan limits of a gallery they cannot see', 'null', coalesce(public.get_media_plan_limit('step3-exp2')::text, 'null'));
insert into _r (who, check_name, expected, actual) values
  ('random', 'opening a sample adds no guest row', '0', (select count(*) from public.guests where event_id like 'step3-sample%' and user_id = '44444444-4444-4444-8444-444444444444')::text);
reset role;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","email":"expired@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('expired_host', 'own gallery: expired', 'expired', public.get_media_plan_limit('step3-exp') ->> 'state'),
  ('expired_host', 'retained ids only from this gallery', '["step3-ea"]', (public.get_media_plan_limit('step3-exp') -> 'retained_ids')::text),
  ('expired_host', 'other gallery keeps its old item', '["step3-eold"]', (public.get_media_plan_limit('step3-exp2') -> 'retained_ids')::text);
reset role;

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","email":"grace@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('grace_host', 'own gallery: grace', 'grace', public.get_media_plan_limit('step3-grace') ->> 'state'),
  ('grace_host', 'grace flags the item over 1 GB', '["step3-ga"]', (public.get_media_plan_limit('step3-grace') -> 'retained_ids')::text);
reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","email":"owner@step3.test"}', true);
set local role authenticated;
insert into _r (who, check_name, expected, actual) values
  ('owner', 'unpaid/no end date: no limit', 'active', public.get_media_plan_limit('step3-public') ->> 'state'),
  ('owner', 'own sample gallery: manage', 'manage', public.open_gallery('step3-sample') ->> 'access');
reset role;

-- ── Facts checked as postgres (not subject to the rules) ───────────────────────
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into _r (who, check_name, expected, actual) values
  ('db', 'deletion record written with real owner', 'yes', case when exists (select 1 from public.deleted_events_archive where event_id = 'step3-empty' and user_id = '11111111-1111-4111-8111-111111111111') then 'yes' else 'no' end),
  ('db', 'owner deleted sub-gallery',               '0', (select count(*) from public.events where id = 'step3-public-sub')::text),
  ('db', 'its photos removed automatically',        '0', (select count(*) from public.photos where id = 'step3-p2s')::text),
  ('db', 'its face scans removed automatically',    '0', (select count(*) from public.faces where event_id = 'step3-public-sub')::text),
  ('db', 'anon cannot run request_gallery_access',  'false', has_function_privilege('anon', 'public.request_gallery_access(text)', 'execute')::text);

-- ── Results (raising here rolls back the whole transaction) ────────────────────
do $$
begin
  raise exception 'STEP3_RESULTS%', (
    select json_agg(json_build_object('who', who, 'check', check_name, 'expected', expected, 'actual', actual,
                                      'pass', expected = actual) order by n)::text from _r);
end $$;
