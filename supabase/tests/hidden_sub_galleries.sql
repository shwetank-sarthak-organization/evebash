-- Run against a disposable migrated database (needs RLS part 1, 20261009020000, 20261011020000 and 20261019000000).
-- A sub-gallery hidden from guests opens only for the event's managers, and logged-out visitors of a public event
-- don't get it (or its favourites), nor hidden photos, either. All records are rolled back.
begin;
insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a'), ('bbbbbbbb-0000-0000-0000-00000000000b'),
  ('cccccccc-0000-0000-0000-00000000000c')
on conflict do nothing;

-- A owns a private event (hg-root) and a public one (hg-pub), each with a visible and a hidden sub-gallery.
-- B is an approved member of hg-root; C is an approved guest admin of hg-root.
insert into public.events (id, parent_id, created_by, is_public, is_hidden, type, title) values
  ('hg-root', null, 'aaaaaaaa-0000-0000-0000-00000000000a', false, false, 'main', 'Private'),
  ('hg-vis', 'hg-root', 'aaaaaaaa-0000-0000-0000-00000000000a', false, false, 'sub', 'Visible'),
  ('hg-hid', 'hg-root', 'aaaaaaaa-0000-0000-0000-00000000000a', false, true, 'sub', 'Hidden'),
  ('hg-pub', null, 'aaaaaaaa-0000-0000-0000-00000000000a', true, false, 'main', 'Public'),
  ('hg-pub-vis', 'hg-pub', 'aaaaaaaa-0000-0000-0000-00000000000a', false, false, 'sub', 'Public visible'),
  ('hg-pub-hid', 'hg-pub', 'aaaaaaaa-0000-0000-0000-00000000000a', false, true, 'sub', 'Public hidden');
insert into public.guests (id, event_id, status, can_admin, user_id) values
  ('hg-g-b', 'hg-root', 'approved', false, 'bbbbbbbb-0000-0000-0000-00000000000b'),
  ('hg-g-c', 'hg-root', 'approved', true, 'cccccccc-0000-0000-0000-00000000000c');
insert into public.photos (id, event_id, media_type, status, preview_url, is_hidden) values
  ('hg-p-vis', 'hg-pub-vis', 'photo', 'processed', 'https://media.example/vis.webp', false),
  ('hg-p-hid', 'hg-pub-hid', 'photo', 'processed', 'https://media.example/hid.webp', false),
  ('hg-p-own-hid', 'hg-pub-vis', 'photo', 'processed', 'https://media.example/own-hid.webp', true),
  ('hg-p-home', 'hg-pub', 'photo', 'processed', 'https://media.example/home.webp', false);
insert into public.event_favourite_photos (event_id, photo_id) values
  ('hg-pub', 'hg-p-vis'), ('hg-pub', 'hg-p-hid'), ('hg-pub', 'hg-p-own-hid');

create temporary table hg_cases (who text, ref text, expected text, label text);
insert into hg_cases values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'hg-hid', 'manage', 'owner opens the hidden sub-gallery'),
  ('cccccccc-0000-0000-0000-00000000000c', 'hg-hid', 'manage', 'guest admin opens the hidden sub-gallery'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'hg-hid', 'not_found', 'member can''t open the hidden sub-gallery'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'hg-vis', 'member', 'member opens a visible sub-gallery'),
  ('', 'hg-pub-hid', 'not_found', 'logged-out visitor can''t open a hidden public sub-gallery'),
  ('', 'hg-pub-vis', 'public_view', 'logged-out visitor opens a visible public sub-gallery');
grant select on hg_cases to authenticated, anon;

do $$
declare
  c record;
  got text;
  subs jsonb;
  media_ids text[];
  subs_media text[];
begin
  for c in select * from hg_cases loop
    perform set_config('request.jwt.claims', case when c.who = '' then '' else json_build_object('sub', c.who, 'role', 'authenticated')::text end, true);
    execute case when c.who = '' then 'set local role anon' else 'set local role authenticated' end;
    got := public.open_gallery(c.ref) ->> 'access';
    execute 'reset role';
    if got is distinct from c.expected then
      raise exception 'Hidden gallery check failed: % (expected %, got %)', c.label, c.expected, got;
    end if;
  end loop;

  -- Logged out on the public event: the sub-gallery list and Home's favourites leave the hidden one out
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  subs := public.open_gallery('hg-pub') -> 'sub_events';
  select array_agg(m.id order by m.id) into media_ids from public.get_public_gallery_media('hg-pub') m;
  if exists (select 1 from public.get_public_gallery_media('hg-pub-hid')) then
    raise exception 'Hidden public sub-gallery returned media';
  end if;
  -- A hidden photo in a visible sub-gallery isn't returned on that sub-gallery's page either
  select array_agg(m.id order by m.id) into subs_media from public.get_public_gallery_media('hg-pub-vis') m;
  execute 'reset role';
  if jsonb_array_length(subs) <> 1 or subs -> 0 ->> 'id' <> 'hg-pub-vis' then
    raise exception 'Public sub-gallery list should only have hg-pub-vis, got %', subs;
  end if;
  -- Home: its visible favourite plus its own upload (not the hidden photo or the hidden sub-gallery's favourite)
  if media_ids is distinct from array['hg-p-home', 'hg-p-vis'] then
    raise exception 'Home should have hg-p-home and hg-p-vis, got %', media_ids;
  end if;
  if subs_media is distinct from array['hg-p-vis'] then
    raise exception 'Visible sub-gallery should only return hg-p-vis (not the hidden photo), got %', subs_media;
  end if;
end $$;
rollback;
