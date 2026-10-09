-- Run against a disposable migrated database. All test records are rolled back.
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

do $$
declare
  a constant uuid := '00000000-0000-0000-0000-00000000000a';
  b constant uuid := '00000000-0000-0000-0000-00000000000b';
  up1 uuid; up2 uuid; up3 uuid;
  res jsonb;
  item1 uuid; item2 uuid; copy1 uuid;
  photos uuid; trip uuid; beach uuid;
  acct public.vault_accounts%rowtype;
  name_out text;
begin
  -- Quota: limit 1000 bytes, 300 already used by event media -> 700 available.
  up1 := public.vault_reserve_upload(a, null, 'report.pdf', 'pdf', 'application/pdf', 400, 'vault', 'a/1', 'single', now() + interval '1 hour', 1000, 300);
  begin
    perform public.vault_reserve_upload(a, null, 'big.mov', 'mov', 'video/quicktime', 301, 'vault', 'a/2', 'single', now() + interval '1 hour', 1000, 300);
    raise exception 'Expected quota rejection';
  exception when raise_exception then
    if sqlerrm <> 'vault_quota_exceeded' then raise; end if;
  end;
  up2 := public.vault_reserve_upload(a, null, 'notes.txt', 'txt', 'text/plain', 300, 'vault', 'a/3', 'single', now() + interval '1 hour', 1000, 300);
  select * into acct from public.vault_accounts where owner_id = a;
  if acct.reserved_bytes <> 700 or acct.used_bytes <> 0 then raise exception 'Reservations not tracked: %', row_to_json(acct); end if;

  -- Another user cannot complete or release someone else's upload.
  begin
    perform public.vault_complete_upload(up1, b, 400, null);
    raise exception 'Expected ownership rejection on complete';
  exception when raise_exception then
    if sqlerrm <> 'vault_not_found' then raise; end if;
  end;
  if exists (select 1 from public.vault_release_upload(up1, b, 'aborted')) then raise exception 'Other user released an upload'; end if;

  -- Completing moves bytes from reserved to used. A size mismatch releases instead.
  res := public.vault_complete_upload(up1, a, 400, 'sha256:abc');
  if res->>'status' <> 'ok' then raise exception 'Complete failed: %', res; end if;
  item1 := (res->>'item_id')::uuid;
  res := public.vault_complete_upload(up2, a, 999, null);
  if res->>'status' <> 'size_mismatch' then raise exception 'Expected size mismatch: %', res; end if;
  select * into acct from public.vault_accounts where owner_id = a;
  if acct.used_bytes <> 400 or acct.reserved_bytes <> 0 then raise exception 'Usage wrong after complete: %', row_to_json(acct); end if;

  -- Duplicate names get a suffix.
  up3 := public.vault_reserve_upload(a, null, 'Report.pdf', 'pdf', 'application/pdf', 100, 'vault', 'a/4', 'single', now() + interval '1 hour', 1000, 300);
  res := public.vault_complete_upload(up3, a, 100, null);
  item2 := (res->>'item_id')::uuid;
  if (select filename from public.vault_items where id = item2) <> 'Report (1).pdf' then raise exception 'Duplicate name not suffixed'; end if;

  -- Copies share the object, count toward storage, and respect the limit.
  copy1 := public.vault_copy_item(a, item2, null, 1000, 300);
  if (select ref_count from public.vault_objects o join public.vault_items i on i.object_id = o.id where i.id = item2) <> 2 then
    raise exception 'Copy did not share the object';
  end if;
  begin
    perform public.vault_copy_item(a, item1, null, 1000, 300);
    raise exception 'Expected quota rejection on copy';
  exception when raise_exception then
    if sqlerrm <> 'vault_quota_exceeded' then raise; end if;
  end;
  begin
    perform public.vault_copy_item(b, item1, null, null, 0);
    raise exception 'Expected ownership rejection on copy';
  exception when raise_exception then
    if sqlerrm <> 'vault_not_found' then raise; end if;
  end;

  -- Folder moves: no moving into itself or a descendant; no moving into another user's folder.
  insert into public.vault_folders (owner_id, name) values (a, 'Photos') returning id into photos;
  insert into public.vault_folders (owner_id, parent_folder_id, name) values (a, photos, 'Trip') returning id into trip;
  insert into public.vault_folders (owner_id, parent_folder_id, name) values (a, trip, 'Beach') returning id into beach;
  begin
    perform public.vault_move_folder(a, photos, beach);
    raise exception 'Expected cycle rejection';
  exception when raise_exception then
    if sqlerrm <> 'vault_invalid_move' then raise; end if;
  end;
  begin
    perform public.vault_move_folder(a, photos, photos);
    raise exception 'Expected self-move rejection';
  exception when raise_exception then
    if sqlerrm <> 'vault_invalid_move' then raise; end if;
  end;
  begin
    perform public.vault_move_folder(b, beach, null);
    raise exception 'Expected ownership rejection on move';
  exception when raise_exception then
    if sqlerrm <> 'vault_not_found' then raise; end if;
  end;
  name_out := public.vault_move_folder(a, beach, null);
  if name_out <> 'Beach' or (select parent_folder_id from public.vault_folders where id = beach) is not null then
    raise exception 'Valid move failed';
  end if;

  -- Trash a folder with contents, restore it, trash again and purge.
  update public.vault_items set folder_id = trip where id = item1;
  perform public.vault_trash(a, 'folder', photos);
  if (select count(*) from public.vault_folders where trash_root_id = photos) <> 2 then raise exception 'Folder tree not trashed'; end if;
  if (select deleted_at is null from public.vault_items where id = item1) then raise exception 'File inside folder not trashed'; end if;
  select * into acct from public.vault_accounts where owner_id = a;
  if acct.used_bytes <> 600 then raise exception 'Trashed files must still count: %', acct.used_bytes; end if;
  begin
    perform public.vault_restore(b, 'folder', photos);
    raise exception 'Expected ownership rejection on restore';
  exception when raise_exception then
    if sqlerrm <> 'vault_not_found' then raise; end if;
  end;
  perform public.vault_restore(a, 'folder', photos);
  if exists (select 1 from public.vault_items where id = item1 and deleted_at is not null) then raise exception 'Restore missed a file'; end if;

  perform public.vault_trash(a, 'file', item1);
  perform public.vault_trash(a, 'folder', photos);
  begin
    perform public.vault_purge(b, photos);
    raise exception 'Expected ownership rejection on purge';
  exception when raise_exception then
    if sqlerrm <> 'vault_not_found' then raise; end if;
  end;
  if public.vault_purge(a, photos) <> 400 then raise exception 'Purge should free the separately trashed file inside the folder'; end if;
  select * into acct from public.vault_accounts where owner_id = a;
  if acct.used_bytes <> 200 then raise exception 'Usage wrong after purge: %', acct.used_bytes; end if;
  if (select delete_pending_since is null from public.vault_objects where object_key = 'a/1') then
    raise exception 'Unreferenced object not flagged for B2 deletion';
  end if;
  if exists (select 1 from public.vault_folders where id in (photos, trip)) then raise exception 'Purged folders remain'; end if;

  -- Expired Trash is purged by the background job.
  perform public.vault_trash(a, 'file', copy1);
  update public.vault_items set deleted_at = now() - interval '31 days' where id = copy1;
  if public.vault_purge_expired_trash(interval '30 days') <> 1 then raise exception 'Expired trash not purged'; end if;
  if (select ref_count from public.vault_objects where object_key = 'a/4') <> 1 then raise exception 'Shared object ref count wrong'; end if;
end $$;

-- Clients can read only their own usage row and nothing else.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);
do $$ begin
  if exists (select 1 from public.vault_accounts) then raise exception 'User saw another user''s usage'; end if;
  begin
    perform 1 from public.vault_items;
    raise exception 'Client must not read vault_items';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.vault_trash('00000000-0000-0000-0000-00000000000a', 'file', gen_random_uuid());
    raise exception 'Client must not call vault functions';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
do $$ begin
  if (select count(*) from public.vault_accounts) <> 1 then raise exception 'Owner cannot read own usage'; end if;
end $$;
reset role;
rollback;
