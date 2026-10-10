-- Run against a disposable migrated database (needs RLS part 1 and 20261010000000). All records are rolled back.
-- Covers who may move photos between galleries, and that photos never cross into another owner's event.
begin;
insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-00000000000a'), ('bbbbbbbb-0000-0000-0000-00000000000b'),
  ('cccccccc-0000-0000-0000-00000000000c'), ('dddddddd-0000-0000-0000-00000000000d'),
  ('eeeeeeee-0000-0000-0000-00000000000e')
on conflict do nothing;

-- A owns root1 (sub1, sub2, and subLegacy linked by legacy id). B owns root2.
insert into public.events (id, parent_id, legacy_id, created_by) values
  ('mv-root1', null, 'mv-legacy-root1', 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('mv-sub1', 'mv-root1', null, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('mv-sub2', 'mv-root1', null, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('mv-subLegacy', 'mv-legacy-root1', null, 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('mv-root2', null, null, 'bbbbbbbb-0000-0000-0000-00000000000b');
insert into public.photos (id, event_id) values ('mv-p1', 'mv-sub1'), ('mv-p2', 'mv-sub1'), ('mv-p3', 'mv-subLegacy'), ('mv-pB', 'mv-root2');
insert into public.faces (image_id, event_id) values ('mv-p1', 'mv-sub1');
-- C: approved guest admin of root1. D: guest admin request still pending. E: platform admin.
insert into public.guests (event_id, status, can_admin, user_id) values
  ('mv-root1', 'approved', true, 'cccccccc-0000-0000-0000-00000000000c'),
  ('mv-root1', 'pending', true, 'dddddddd-0000-0000-0000-00000000000d');
insert into public.profiles (id, role, delegated_by) values ('eeeeeeee-0000-0000-0000-00000000000e', 'admin', null)
on conflict (id) do update set role = 'admin', delegated_by = null;

create temporary table mv_cases (who text, photos text[], target text, allowed boolean, label text);
insert into mv_cases values
  ('aaaaaaaa-0000-0000-0000-00000000000a', array['mv-p1'], 'mv-sub2', true, 'owner moves between sub-galleries'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', array['mv-p3'], 'mv-root1', true, 'owner moves from a legacy-linked sub-gallery'),
  ('cccccccc-0000-0000-0000-00000000000c', array['mv-p2'], 'mv-sub2', true, 'approved guest admin'),
  ('eeeeeeee-0000-0000-0000-00000000000e', array['mv-p2'], 'mv-root1', true, 'platform admin'),
  ('dddddddd-0000-0000-0000-00000000000d', array['mv-p1'], 'mv-root1', false, 'pending guest admin'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', array['mv-p1'], 'mv-root1', false, 'owner of another event'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', array['mv-pB'], 'mv-root1', false, 'pulling another owner''s photo in'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', array['mv-p1'], 'mv-root2', false, 'pushing a photo into another owner''s event');
grant select on mv_cases to authenticated;

do $$
declare
  c record;
  ok boolean;
begin
  for c in select * from mv_cases loop
    perform set_config('request.jwt.claims', json_build_object('sub', c.who, 'role', 'authenticated')::text, true);
    begin
      execute 'set local role authenticated';
      perform public.move_photos_to_gallery(c.photos, c.target);
      ok := true;
    exception when others then
      ok := false;
    end;
    execute 'reset role';
    if ok is distinct from c.allowed then
      raise exception 'Move check failed: % (expected %, got %)', c.label, c.allowed, ok;
    end if;
  end loop;

  if (select event_id from public.photos where id = 'mv-pB') <> 'mv-root2' then raise exception 'Photo crossed into another event'; end if;
  if (select event_id from public.photos where id = 'mv-p1') <> 'mv-sub2' then raise exception 'Allowed move did not happen'; end if;
  if (select event_id from public.faces where image_id = 'mv-p1') <> 'mv-sub2' then raise exception 'Face row did not follow the photo'; end if;
end $$;
rollback;
