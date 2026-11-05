-- Run against a disposable migrated database (needs 20261022010000 and 20261105000000). All records are rolled back.
-- Covers: each event's size includes its sub-galleries and album data, and the rows add up to the plan's event total.
begin;
-- A owns big (sub, a sub-gallery made by admin D, and legacy-linked), small, and empty. B owns other.
insert into public.events (id, parent_id, legacy_id, created_by, title, type) values
  ('st-big', null, 'st-old-big', 'user-a', 'Wedding', 'main'),
  ('st-sub', 'st-big', null, 'user-a', 'Baraat', 'sub'),
  ('st-admin-sub', 'st-big', null, 'user-d', 'Haldi', 'sub'),
  ('st-legacy', 'st-old-big', null, 'user-a', 'Sangeet', 'sub'),
  ('st-small', null, null, 'user-a', 'Reception', 'main'),
  ('st-empty', null, null, 'user-a', 'Engagement', 'main'),
  ('st-other', null, null, 'user-b', 'Not mine', 'main');
insert into public.photos (id, event_id, size, overhead_size) values
  ('st-p1', 'st-big', 100, 10), ('st-p2', 'st-sub', 200, 0), ('st-p3', 'st-admin-sub', 300, 30),
  ('st-p4', 'st-legacy', 50, 0), ('st-p5', 'st-small', 400, 0), ('st-p6', 'st-other', 999, 0);
insert into public.album_proofs (id, event_id, title) values ('00000000-0000-0000-0000-0000000000a1', 'st-small', 'Album');
insert into public.album_proof_pages (id, album_id, position) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 1);
insert into public.album_proof_page_versions (page_id, version, preview_key, thumbnail_key, bytes) values ('00000000-0000-0000-0000-0000000000b1', 1, 'p', 't', 70);
insert into public.album_proof_comments (page_id, voice_bytes) values ('00000000-0000-0000-0000-0000000000b1', 5);

do $$
declare
  v_rows text;
  v_sum bigint;
  v_total bigint := public.vault_event_storage_bytes(array['user-a', 'a@example.com']);
begin
  select string_agg(event_id || '=' || bytes, ',' order by bytes desc, title) into v_rows
    from public.vault_event_storage_by_event(array['user-a', 'a@example.com']);
  -- Largest first, sub-galleries and album data in their event, the empty event at 0, B's event absent
  if v_rows <> 'st-big=690,st-small=475,st-empty=0' then raise exception 'Unexpected rows: %', v_rows; end if;

  select sum(bytes) into v_sum from public.vault_event_storage_by_event(array['user-a', 'a@example.com']);
  if v_sum <> v_total then raise exception 'Rows add up to % but the total is %', v_sum, v_total; end if;

  if has_function_privilege('authenticated', 'public.vault_event_storage_by_event(text[])', 'execute') then
    raise exception 'Clients can read other people''s storage';
  end if;
end $$;
rollback;
