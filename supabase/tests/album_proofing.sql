-- Run against a disposable migrated database (needs 20261022010000_album_proofing.sql). Checks the album proofing
-- functions, the B2 file queue and the storage count. All records are rolled back.
begin;
insert into public.events (id, parent_id, created_by, type, title) values
  ('ap-root', null, 'ap-owner', 'main', 'Wedding'),
  ('ap-sub', 'ap-root', 'ap-owner', 'sub', 'Haldi');
insert into public.photos (id, event_id, media_type, status, size, overhead_size) values
  ('ap-photo', 'ap-sub', 'photo', 'processed', 1000, 100);
insert into public.album_proofs (id, event_id, title) values
  ('a0000000-0000-4000-8000-000000000001', 'ap-root', 'Wedding Album');

do $$
declare
  v_album uuid := 'a0000000-0000-4000-8000-000000000001';
  v_p1 uuid; v_p2 uuid; v_p3 uuid;
  v_version integer;
  v_result jsonb;
  v_failed boolean;
begin
  -- Pages go to the end in upload order
  v_p1 := public.album_proof_add_page(v_album, 'spread', '01.jpg', 'k/p1-v1-preview', 'k/p1-v1-thumb', 9000, 3000, 500, 'ap-designer', 3);
  v_p2 := public.album_proof_add_page(v_album, 'single', '02.jpg', 'k/p2-v1-preview', 'k/p2-v1-thumb', 3000, 3000, 300, 'ap-designer', 3);
  v_p3 := public.album_proof_add_page(v_album, 'spread', '03.jpg', 'k/p3-v1-preview', 'k/p3-v1-thumb', 9000, 3000, 200, 'ap-designer', 3);
  assert (select array_agg(id order by position) from public.album_proof_pages where album_id = v_album) = array[v_p1, v_p2, v_p3],
    'pages are numbered in upload order';

  -- The page limit holds
  v_failed := false;
  begin
    perform public.album_proof_add_page(v_album, 'spread', '04.jpg', 'k/x', 'k/y', 1, 1, 1, 'ap-designer', 3);
  exception when others then
    v_failed := sqlerrm = 'album_page_limit';
  end;
  assert v_failed, 'a 4th page is refused at a limit of 3';

  -- A second upload before sending replaces the unsent version and queues its files
  v_version := public.album_proof_add_version(v_p1, '01b.jpg', 'k/p1-v1b-preview', 'k/p1-v1b-thumb', 9000, 3000, 600, 'ap-designer');
  assert v_version = 1, 'unsent version is replaced, not stacked';
  assert (select count(*) from public.album_proof_page_versions where page_id = v_p1) = 1, 'one version of page 1';
  assert exists (select 1 from public.album_proof_deleted_files where storage_key = 'k/p1-v1-preview')
     and exists (select 1 from public.album_proof_deleted_files where storage_key = 'k/p1-v1-thumb'),
    'replaced version files are queued for deletion';

  -- Round 1 sends every page
  v_result := public.album_proof_send_round(v_album, 'ap-designer');
  assert v_result = '{"round": 1, "pages": 3, "updatedPages": 0}'::jsonb, 'round 1: ' || v_result::text;
  assert (select current_round from public.album_proofs where id = v_album) = 1, 'album is on round 1';
  assert not exists (select 1 from public.album_proof_page_versions where round = 0
                      and page_id in (v_p1, v_p2, v_p3)), 'all versions sent';

  v_failed := false;
  begin
    perform public.album_proof_send_round(v_album, 'ap-designer');
  exception when others then
    v_failed := sqlerrm = 'album_nothing_to_send';
  end;
  assert v_failed, 'nothing new to send is refused';

  -- After sending, a new upload is version 2, and round 2 counts it as updated and reopens an approved album
  v_version := public.album_proof_add_version(v_p2, '02-v2.jpg', 'k/p2-v2-preview', 'k/p2-v2-thumb', 3000, 3000, 350, 'ap-designer');
  assert v_version = 2, 'version 2 after the first was sent';
  update public.album_proofs set approved_at = now(), approved_by = 'ap-couple' where id = v_album;
  v_failed := false;
  begin
    perform public.album_proof_add_version(v_p3, '03-v2.jpg', 'k/x', 'k/y', 1, 1, 1, 'ap-designer');
  exception when others then
    v_failed := sqlerrm = 'album_approved';
  end;
  assert v_failed, 'an approved album takes no uploads';
  v_result := public.album_proof_send_round(v_album, 'ap-designer');
  assert v_result = '{"round": 2, "pages": 1, "updatedPages": 1}'::jsonb, 'round 2: ' || v_result::text;
  assert (select approved_at is null from public.album_proofs where id = v_album), 'round 2 reopens the album';

  -- Reorder needs exactly the album's pages
  perform public.album_proof_reorder(v_album, array[v_p3, v_p1, v_p2]);
  assert (select array_agg(id order by position) from public.album_proof_pages where album_id = v_album) = array[v_p3, v_p1, v_p2],
    'pages reordered';
  v_failed := false;
  begin
    perform public.album_proof_reorder(v_album, array[v_p3, v_p1]);
  exception when others then
    v_failed := sqlerrm = 'album_reorder_mismatch';
  end;
  assert v_failed, 'reorder with a page missing is refused';

  -- Voice notes: replacing or deleting one queues the old file
  insert into public.album_proof_comments (id, page_id, version, author_id, voice_key, voice_bytes)
    values ('c0000000-0000-4000-8000-000000000001', v_p1, 1, 'ap-couple', 'k/voice-1', 40);
  update public.album_proof_comments set voice_key = 'k/voice-2' where id = 'c0000000-0000-4000-8000-000000000001';
  assert exists (select 1 from public.album_proof_deleted_files where storage_key = 'k/voice-1'), 'replaced voice note queued';
  update public.album_proof_comments set body = 'Swap this photo' where id = 'c0000000-0000-4000-8000-000000000001';
  assert (select count(*) from public.album_proof_deleted_files where storage_key = 'k/voice-2') = 0, 'editing the text keeps the voice note';

  -- Storage: the photo (1100) + every stored version (600 + 300 + 350 + 200) + the voice note (40), for the owner only
  assert public.vault_event_storage_bytes(array['ap-owner']) = 1100 + 600 + 300 + 350 + 200 + 40,
    'owner storage includes album files: ' || public.vault_event_storage_bytes(array['ap-owner']);
  assert public.vault_event_storage_bytes(array['someone-else']) = 0, 'other people are not charged';

  -- Deleting the event removes the album and queues every remaining file
  delete from public.album_proof_deleted_files;
  delete from public.events where id = 'ap-root';
  assert not exists (select 1 from public.album_proofs where id = v_album), 'album deleted with its event';
  assert (select count(*) from public.album_proof_deleted_files) = 9,
    'all 4 versions (8 files) and the voice note queued: ' || (select count(*) from public.album_proof_deleted_files);

  -- Only the backend can reach the tables
  assert not has_table_privilege('anon', 'public.album_proofs', 'select'), 'anon cannot read albums';
  assert not has_table_privilege('authenticated', 'public.album_proof_comments', 'insert'), 'authenticated cannot write comments';
  assert not has_function_privilege('authenticated', 'public.album_proof_send_round(uuid, text)', 'execute'), 'authenticated cannot send rounds';
end $$;

rollback;
