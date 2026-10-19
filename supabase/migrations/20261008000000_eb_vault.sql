-- EB Vault Phase 1: private personal file storage, kept separate from event media.
-- Only the backend (service_role) touches these tables and functions. Clients get no
-- direct access except reading their own usage row for the storage bar.
-- Storage limits are a pool shared with event media, so the backend passes the plan
-- limit and the user's current event usage into the quota-checking functions.
begin;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- Running usage per user. used = committed files (including Trash); reserved = uploads in flight.
create table if not exists public.vault_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  used_bytes bigint not null default 0 check (used_bytes >= 0),
  reserved_bytes bigint not null default 0 check (reserved_bytes >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_folder_id uuid references public.vault_folders(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Everything trashed together shares the id of the item the user actually deleted.
  trash_root_id uuid
);
create index if not exists vault_folders_children_idx on public.vault_folders (owner_id, parent_folder_id) where deleted_at is null;
create index if not exists vault_folders_trash_idx on public.vault_folders (trash_root_id) where deleted_at is not null;
create unique index if not exists vault_folders_unique_name on public.vault_folders
  (owner_id, coalesce(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;

-- One row per stored B2 object. Several items (copies, and later "Save to Vault" from events)
-- can point at the same object; it is deleted from B2 only when ref_count reaches 0.
create table if not exists public.vault_objects (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  object_key text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  content_hash text,
  ref_count integer not null default 0 check (ref_count >= 0),
  created_at timestamptz not null default now(),
  delete_pending_since timestamptz,
  unique (bucket, object_key)
);
create index if not exists vault_objects_pending_idx on public.vault_objects (delete_pending_since) where delete_pending_since is not null;
create index if not exists vault_objects_hash_idx on public.vault_objects (content_hash) where content_hash is not null;

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.vault_folders(id) on delete set null,
  object_id uuid not null references public.vault_objects(id) on delete restrict,
  filename text not null check (char_length(filename) between 1 and 255),
  extension text not null default '',
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0),
  is_starred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  trash_root_id uuid
);
create index if not exists vault_items_folder_idx on public.vault_items (owner_id, folder_id) where deleted_at is null;
create index if not exists vault_items_recent_idx on public.vault_items (owner_id, updated_at desc) where deleted_at is null;
create index if not exists vault_items_starred_idx on public.vault_items (owner_id) where is_starred and deleted_at is null;
create index if not exists vault_items_trash_idx on public.vault_items (trash_root_id) where deleted_at is not null;
create index if not exists vault_items_created_idx on public.vault_items (owner_id, created_at);
create index if not exists vault_items_search_idx on public.vault_items using gin (lower(filename) extensions.gin_trgm_ops);
create unique index if not exists vault_items_unique_name on public.vault_items
  (owner_id, coalesce(folder_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(filename))
  where deleted_at is null;

-- Phase 1 leaves this empty. Later phases store generated previews (HEIC, MOV, Office) here.
create table if not exists public.vault_item_previews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.vault_items(id) on delete cascade,
  kind text not null check (kind in ('thumbnail', 'preview', 'transcode')),
  object_id uuid not null references public.vault_objects(id) on delete restrict,
  mime_type text not null,
  created_at timestamptz not null default now(),
  unique (item_id, kind)
);

create table if not exists public.vault_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.vault_folders(id) on delete set null,
  filename text not null check (char_length(filename) between 1 and 255),
  extension text not null default '',
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0),
  bucket text not null,
  object_key text not null unique,
  upload_mode text not null check (upload_mode in ('single', 'multipart')),
  multipart_upload_id text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'aborted', 'expired')),
  expires_at timestamptz not null,
  completed_item_id uuid references public.vault_items(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vault_uploads_pending_idx on public.vault_uploads (expires_at) where status = 'pending';

-- Keep object reference counts in step with items and previews, however rows are deleted
-- (including account deletion cascades).
create or replace function public.vault_track_object_refs()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    if tg_op = 'INSERT' or new.object_id is distinct from old.object_id then
      update public.vault_objects set ref_count = ref_count + 1, delete_pending_since = null where id = new.object_id;
    end if;
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    if tg_op = 'DELETE' or new.object_id is distinct from old.object_id then
      update public.vault_objects
      set ref_count = ref_count - 1,
          delete_pending_since = case when ref_count - 1 = 0 then now() else null end
      where id = old.object_id;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists vault_items_object_refs on public.vault_items;
create trigger vault_items_object_refs after insert or delete or update of object_id on public.vault_items
  for each row execute function public.vault_track_object_refs();
drop trigger if exists vault_previews_object_refs on public.vault_item_previews;
create trigger vault_previews_object_refs after insert or delete or update of object_id on public.vault_item_previews
  for each row execute function public.vault_track_object_refs();

create or replace function public.vault_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists vault_items_touch on public.vault_items;
create trigger vault_items_touch before update on public.vault_items for each row execute function public.vault_touch_updated_at();
drop trigger if exists vault_folders_touch on public.vault_folders;
create trigger vault_folders_touch before update on public.vault_folders for each row execute function public.vault_touch_updated_at();

-- "Report.pdf" -> "Report (1).pdf" when the name is taken among live siblings.
create or replace function public.vault_unique_name(p_owner uuid, p_folder_id uuid, p_name text, p_kind text, p_exclude_id uuid default null)
returns text language plpgsql stable set search_path = '' as $$
declare
  dot integer := case when p_kind = 'file' then length(p_name) - strpos(reverse(p_name), '.') + 1 else 0 end;
  stem text;
  ext text;
  candidate text := p_name;
  n integer := 0;
begin
  if p_kind = 'file' and strpos(p_name, '.') > 1 then
    stem := left(p_name, dot - 1);
    ext := substr(p_name, dot);
  else
    stem := p_name;
    ext := '';
  end if;
  loop
    if p_kind = 'file' then
      exit when not exists (
        select 1 from public.vault_items i
        where i.owner_id = p_owner and i.deleted_at is null and i.folder_id is not distinct from p_folder_id
          and lower(i.filename) = lower(candidate) and i.id is distinct from p_exclude_id);
    else
      exit when not exists (
        select 1 from public.vault_folders f
        where f.owner_id = p_owner and f.deleted_at is null and f.parent_folder_id is not distinct from p_folder_id
          and lower(f.name) = lower(candidate) and f.id is distinct from p_exclude_id);
    end if;
    n := n + 1;
    candidate := left(stem, 255 - length(ext) - length(n::text) - 3) || ' (' || n || ')' || ext;
  end loop;
  return candidate;
end $$;

create or replace function public.vault_owns_live_folder(p_owner uuid, p_folder_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select p_folder_id is null or exists (
    select 1 from public.vault_folders f where f.id = p_folder_id and f.owner_id = p_owner and f.deleted_at is null);
$$;

-- Reserves quota and records the upload in one statement, so simultaneous uploads cannot
-- together exceed the limit. p_limit_bytes null = unlimited. p_other_used_bytes = event media.
create or replace function public.vault_reserve_upload(
  p_owner uuid, p_folder_id uuid, p_filename text, p_extension text, p_mime_type text, p_size_bytes bigint,
  p_bucket text, p_object_key text, p_upload_mode text, p_expires_at timestamptz,
  p_limit_bytes bigint, p_other_used_bytes bigint
) returns uuid language plpgsql set search_path = '' as $$
declare
  upload_id uuid;
begin
  if p_size_bytes < 0 then raise exception 'vault_invalid_size'; end if;
  if not public.vault_owns_live_folder(p_owner, p_folder_id) then raise exception 'vault_not_found'; end if;

  insert into public.vault_accounts (owner_id) values (p_owner) on conflict (owner_id) do nothing;
  update public.vault_accounts a
  set reserved_bytes = a.reserved_bytes + p_size_bytes, updated_at = now()
  where a.owner_id = p_owner
    and (p_limit_bytes is null or a.used_bytes + a.reserved_bytes + p_size_bytes + coalesce(p_other_used_bytes, 0) <= p_limit_bytes);
  if not found then raise exception 'vault_quota_exceeded'; end if;

  insert into public.vault_uploads (owner_id, folder_id, filename, extension, mime_type, size_bytes, bucket, object_key, upload_mode, expires_at)
  values (p_owner, p_folder_id, p_filename, coalesce(p_extension, ''), coalesce(p_mime_type, 'application/octet-stream'),
          p_size_bytes, p_bucket, p_object_key, p_upload_mode, p_expires_at)
  returning id into upload_id;
  return upload_id;
end $$;

-- Releases the reservation of a pending upload. Returns the row so the caller can clean up B2.
create or replace function public.vault_release_upload(p_upload_id uuid, p_owner uuid, p_status text)
returns setof public.vault_uploads language plpgsql set search_path = '' as $$
declare
  upload public.vault_uploads%rowtype;
begin
  if p_status not in ('aborted', 'expired') then raise exception 'vault_invalid_status'; end if;
  select * into upload from public.vault_uploads u
  where u.id = p_upload_id and (p_owner is null or u.owner_id = p_owner) and u.status = 'pending'
  for update;
  if not found then return; end if;

  update public.vault_accounts set reserved_bytes = greatest(reserved_bytes - upload.size_bytes, 0), updated_at = now()
  where owner_id = upload.owner_id;
  update public.vault_uploads set status = p_status where id = upload.id returning * into upload;
  return next upload;
end $$;

-- Turns a verified upload into a file. The backend checks the real object size in B2 first;
-- a mismatch releases the reservation instead of committing.
create or replace function public.vault_complete_upload(p_upload_id uuid, p_owner uuid, p_actual_size bigint, p_content_hash text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  upload public.vault_uploads%rowtype;
  target_folder uuid;
  new_object uuid;
  new_item uuid;
  final_name text;
begin
  select * into upload from public.vault_uploads u
  where u.id = p_upload_id and u.owner_id = p_owner and u.status = 'pending'
  for update;
  if not found then raise exception 'vault_not_found'; end if;

  if p_actual_size is distinct from upload.size_bytes then
    perform public.vault_release_upload(upload.id, p_owner, 'aborted');
    return jsonb_build_object('status', 'size_mismatch', 'object_key', upload.object_key, 'bucket', upload.bucket);
  end if;

  -- If the destination folder was trashed meanwhile, the file lands in My Files.
  target_folder := case when public.vault_owns_live_folder(p_owner, upload.folder_id) then upload.folder_id else null end;
  final_name := public.vault_unique_name(p_owner, target_folder, upload.filename, 'file');

  insert into public.vault_objects (bucket, object_key, size_bytes, content_hash)
  values (upload.bucket, upload.object_key, upload.size_bytes, p_content_hash)
  returning id into new_object;

  insert into public.vault_items (owner_id, folder_id, object_id, filename, extension, mime_type, size_bytes)
  values (p_owner, target_folder, new_object, final_name, upload.extension, upload.mime_type, upload.size_bytes)
  returning id into new_item;

  update public.vault_accounts
  set reserved_bytes = greatest(reserved_bytes - upload.size_bytes, 0), used_bytes = used_bytes + upload.size_bytes, updated_at = now()
  where owner_id = p_owner;
  update public.vault_uploads set status = 'completed', completed_item_id = new_item where id = upload.id;

  return jsonb_build_object('status', 'ok', 'item_id', new_item);
end $$;

-- Copies share the stored object but count toward the user's storage like a new file.
create or replace function public.vault_copy_item(p_owner uuid, p_item_id uuid, p_target_folder_id uuid, p_limit_bytes bigint, p_other_used_bytes bigint)
returns uuid language plpgsql set search_path = '' as $$
declare
  source public.vault_items%rowtype;
  new_item uuid;
begin
  select * into source from public.vault_items i where i.id = p_item_id and i.owner_id = p_owner and i.deleted_at is null;
  if not found or not public.vault_owns_live_folder(p_owner, p_target_folder_id) then raise exception 'vault_not_found'; end if;

  insert into public.vault_accounts (owner_id) values (p_owner) on conflict (owner_id) do nothing;
  update public.vault_accounts a set used_bytes = a.used_bytes + source.size_bytes, updated_at = now()
  where a.owner_id = p_owner
    and (p_limit_bytes is null or a.used_bytes + a.reserved_bytes + source.size_bytes + coalesce(p_other_used_bytes, 0) <= p_limit_bytes);
  if not found then raise exception 'vault_quota_exceeded'; end if;

  insert into public.vault_items (owner_id, folder_id, object_id, filename, extension, mime_type, size_bytes)
  values (p_owner, p_target_folder_id, source.object_id,
          public.vault_unique_name(p_owner, p_target_folder_id, source.filename, 'file'),
          source.extension, source.mime_type, source.size_bytes)
  returning id into new_item;
  return new_item;
end $$;

-- Rejects moving a folder into itself or any of its own subfolders.
create or replace function public.vault_move_folder(p_owner uuid, p_folder_id uuid, p_new_parent_id uuid)
returns text language plpgsql set search_path = '' as $$
declare
  current_name text;
  final_name text;
begin
  select f.name into current_name from public.vault_folders f
  where f.id = p_folder_id and f.owner_id = p_owner and f.deleted_at is null for update;
  if not found or not public.vault_owns_live_folder(p_owner, p_new_parent_id) then raise exception 'vault_not_found'; end if;

  if p_new_parent_id is not null and exists (
    with recursive ancestors as (
      select f.id, f.parent_folder_id from public.vault_folders f where f.id = p_new_parent_id
      union all
      select f.id, f.parent_folder_id from public.vault_folders f join ancestors a on f.id = a.parent_folder_id
    )
    select 1 from ancestors where id = p_folder_id
  ) then
    raise exception 'vault_invalid_move';
  end if;

  final_name := public.vault_unique_name(p_owner, p_new_parent_id, current_name, 'folder', p_folder_id);
  update public.vault_folders set parent_folder_id = p_new_parent_id, name = final_name where id = p_folder_id;
  return final_name;
end $$;

-- Sends a file, or a folder with everything inside it, to Trash as one group.
create or replace function public.vault_trash(p_owner uuid, p_kind text, p_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  if p_kind = 'file' then
    update public.vault_items set deleted_at = now(), trash_root_id = p_id
    where id = p_id and owner_id = p_owner and deleted_at is null;
    if not found then raise exception 'vault_not_found'; end if;
  elsif p_kind = 'folder' then
    if not exists (select 1 from public.vault_folders where id = p_id and owner_id = p_owner and deleted_at is null) then
      raise exception 'vault_not_found';
    end if;
    with recursive tree as (
      select f.id from public.vault_folders f where f.id = p_id
      union all
      select f.id from public.vault_folders f join tree t on f.parent_folder_id = t.id
      where f.owner_id = p_owner and f.deleted_at is null
    ), trashed_folders as (
      update public.vault_folders f set deleted_at = now(), trash_root_id = p_id
      from tree where f.id = tree.id returning f.id
    )
    update public.vault_items i set deleted_at = now(), trash_root_id = p_id
    from tree where i.folder_id = tree.id and i.owner_id = p_owner and i.deleted_at is null;
  else
    raise exception 'vault_invalid_kind';
  end if;
end $$;

-- Restores a Trash group. If its original folder is gone or still in Trash, it goes to My Files.
create or replace function public.vault_restore(p_owner uuid, p_kind text, p_id uuid)
returns void language plpgsql set search_path = '' as $$
declare
  parent uuid;
  root_name text;
begin
  if p_kind = 'file' then
    select i.folder_id, i.filename into parent, root_name from public.vault_items i
    where i.id = p_id and i.owner_id = p_owner and i.deleted_at is not null and i.trash_root_id = p_id for update;
    if not found then raise exception 'vault_not_found'; end if;
    if not public.vault_owns_live_folder(p_owner, parent) then parent := null; end if;
    update public.vault_items
    set deleted_at = null, trash_root_id = null, folder_id = parent,
        filename = public.vault_unique_name(p_owner, parent, root_name, 'file', p_id)
    where id = p_id;
  elsif p_kind = 'folder' then
    select f.parent_folder_id, f.name into parent, root_name from public.vault_folders f
    where f.id = p_id and f.owner_id = p_owner and f.deleted_at is not null and f.trash_root_id = p_id for update;
    if not found then raise exception 'vault_not_found'; end if;
    if not public.vault_owns_live_folder(p_owner, parent) then parent := null; end if;
    update public.vault_folders set deleted_at = null, trash_root_id = null
    where trash_root_id = p_id and owner_id = p_owner and id <> p_id;
    update public.vault_folders
    set deleted_at = null, trash_root_id = null, parent_folder_id = parent,
        name = public.vault_unique_name(p_owner, parent, root_name, 'folder', p_id)
    where id = p_id;
    update public.vault_items set deleted_at = null, trash_root_id = null
    where trash_root_id = p_id and owner_id = p_owner;
  else
    raise exception 'vault_invalid_kind';
  end if;
end $$;

-- Permanently deletes a Trash group and frees its storage. Stored objects whose last reference
-- goes away are flagged (delete_pending_since) for the backend job to remove from B2.
create or replace function public.vault_purge(p_owner uuid, p_trash_root_id uuid)
returns bigint language plpgsql set search_path = '' as $$
declare
  v_owner uuid;
  freed bigint;
begin
  select coalesce(
    (select i.owner_id from public.vault_items i where i.trash_root_id = p_trash_root_id and i.deleted_at is not null limit 1),
    (select f.owner_id from public.vault_folders f where f.trash_root_id = p_trash_root_id and f.deleted_at is not null limit 1)
  ) into v_owner;
  if v_owner is null or (p_owner is not null and v_owner <> p_owner) then raise exception 'vault_not_found'; end if;

  -- Everything under a purged folder goes too, including items that were trashed separately
  -- earlier, so nothing is left stranded in Trash still counting toward storage.
  with recursive tree as (
    select f.id from public.vault_folders f
    where f.trash_root_id = p_trash_root_id and f.deleted_at is not null and f.owner_id = v_owner
    union
    select f.id from public.vault_folders f join tree t on f.parent_folder_id = t.id
  ), removed as (
    delete from public.vault_items i
    where i.owner_id = v_owner
      and ((i.trash_root_id = p_trash_root_id and i.deleted_at is not null) or i.folder_id in (select id from tree))
    returning i.size_bytes
  )
  select coalesce(sum(size_bytes), 0) into freed from removed;

  delete from public.vault_folders f
  where f.owner_id = v_owner and f.deleted_at is not null and f.trash_root_id = p_trash_root_id;

  update public.vault_accounts set used_bytes = greatest(used_bytes - freed, 0), updated_at = now() where owner_id = v_owner;
  return freed;
end $$;

-- Background job: permanently deletes Trash groups older than the retention period.
create or replace function public.vault_purge_expired_trash(p_older_than interval, p_limit integer default 500)
returns integer language plpgsql set search_path = '' as $$
declare
  root uuid;
  purged integer := 0;
begin
  for root in
    select distinct r.trash_root_id from (
      select trash_root_id, deleted_at from public.vault_items where deleted_at is not null and trash_root_id = id
      union all
      select trash_root_id, deleted_at from public.vault_folders where deleted_at is not null and trash_root_id = id
    ) r
    where r.deleted_at < now() - p_older_than
    limit p_limit
  loop
    perform public.vault_purge(null, root);
    purged := purged + 1;
  end loop;
  return purged;
end $$;

-- Event media bytes counted against the shared plan storage (originals plus streaming/preview assets).
create or replace function public.vault_event_storage_bytes(p_identifiers text[])
returns bigint language sql stable set search_path = '' as $$
  select coalesce(sum(coalesce(p.size, 0) + coalesce(p.overhead_size, 0)), 0)::bigint
  from public.photos p where p.user_id = any(p_identifiers);
$$;

-- After a paid plan expires, only the oldest media up to p_budget stays visible: events and Vault on
-- one timeline, oldest first, skipping anything that would not fit (same rule as event galleries).
-- Returns the Vault item ids that stay visible.
create or replace function public.vault_retained_item_ids(p_owner uuid, p_identifiers text[], p_budget bigint)
returns setof uuid language plpgsql stable set search_path = '' as $$
declare
  media record;
  kept bigint := 0;
begin
  for media in
    select null::uuid as item_id, coalesce(p.size, 0)::bigint as bytes, p.uploaded_at as at
    from public.photos p join public.events e on e.id::text = p.event_id::text
    where e.created_by::text = any(p_identifiers) and not ('__cover_usage__' = any(coalesce(p.tags, '{}'::text[])))
    union all
    select i.id, i.size_bytes, i.created_at from public.vault_items i where i.owner_id = p_owner
    order by at asc nulls first, item_id nulls first
  loop
    if kept + media.bytes <= p_budget then
      kept := kept + media.bytes;
      if media.item_id is not null then return next media.item_id; end if;
    end if;
  end loop;
end $$;

-- Access: clients only read their own usage row. Everything else goes through the backend.
alter table public.vault_accounts enable row level security;
alter table public.vault_folders enable row level security;
alter table public.vault_objects enable row level security;
alter table public.vault_items enable row level security;
alter table public.vault_item_previews enable row level security;
alter table public.vault_uploads enable row level security;

revoke all on public.vault_accounts, public.vault_folders, public.vault_objects, public.vault_items,
  public.vault_item_previews, public.vault_uploads from anon, authenticated;
grant all on public.vault_accounts, public.vault_folders, public.vault_objects, public.vault_items,
  public.vault_item_previews, public.vault_uploads to service_role;

grant select on public.vault_accounts to authenticated;
drop policy if exists "Users read their own vault usage" on public.vault_accounts;
create policy "Users read their own vault usage" on public.vault_accounts
  for select to authenticated using (owner_id = auth.uid());

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.vault_track_object_refs()', 'public.vault_touch_updated_at()',
    'public.vault_unique_name(uuid, uuid, text, text, uuid)', 'public.vault_owns_live_folder(uuid, uuid)',
    'public.vault_reserve_upload(uuid, uuid, text, text, text, bigint, text, text, text, timestamptz, bigint, bigint)',
    'public.vault_release_upload(uuid, uuid, text)', 'public.vault_complete_upload(uuid, uuid, bigint, text)',
    'public.vault_copy_item(uuid, uuid, uuid, bigint, bigint)', 'public.vault_move_folder(uuid, uuid, uuid)',
    'public.vault_trash(uuid, text, uuid)', 'public.vault_restore(uuid, text, uuid)',
    'public.vault_purge(uuid, uuid)', 'public.vault_purge_expired_trash(interval, integer)',
    'public.vault_event_storage_bytes(text[])', 'public.vault_retained_item_ids(uuid, text[], bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
