-- Album proofing (2026-10-22). The photographer uploads each album page design, the couple reviews it with
-- pins, comments and voice notes, and the photographer sends new versions until every page is approved.
-- Only an event's owner and admins use it, and only through the backend (service role, behind ALBUM_PROOFING):
-- RLS is on with no policies and anon/authenticated have no grants, so the public key can't read or change any
-- of it (#21). Only a preview and a thumbnail of each design are kept; the original is never stored.
-- Previews, thumbnails and voice notes count towards the gallery owner's plan storage (vault_event_storage_bytes).
begin;

create table if not exists public.album_proofs (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  -- Rounds sent for review so far; 0 while the album is still a draft only its managers have worked on
  current_round integer not null default 0,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists album_proofs_event_id_idx on public.album_proofs(event_id);

-- One page design: a spread (two album pages in one image) or a single page.
create table if not exists public.album_proof_pages (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.album_proofs(id) on delete cascade,
  position integer not null,
  layout text not null default 'spread' check (layout in ('spread', 'single')),
  -- The version that was approved; the approval no longer counts once a newer version is sent
  approved_version integer,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists album_proof_pages_album_id_idx on public.album_proof_pages(album_id, position);

-- Every upload of a page. round stays 0 until the photographer sends it for review.
create table if not exists public.album_proof_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.album_proof_pages(id) on delete cascade,
  version integer not null,
  round integer not null default 0,
  file_name text,
  preview_key text not null,
  thumbnail_key text not null,
  -- Size of the uploaded design
  width integer,
  height integer,
  -- Preview + thumbnail, the bytes that are stored
  bytes bigint not null default 0,
  uploaded_by text,
  created_at timestamptz not null default now(),
  unique (page_id, version)
);

create table if not exists public.album_proof_comments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.album_proof_pages(id) on delete cascade,
  version integer not null,
  -- Replies hang off a top-level comment
  parent_id uuid references public.album_proof_comments(id) on delete cascade,
  author_id text not null,
  kind text not null default 'note' check (kind in ('replace', 'bigger', 'smaller', 'edit', 'remove', 'note')),
  -- Where the pin sits on the design, as a fraction of its width and height; null for the whole page
  pin_x real check (pin_x between 0 and 1),
  pin_y real check (pin_y between 0 and 1),
  body text check (char_length(body) <= 2000),
  voice_key text,
  voice_seconds real,
  voice_bytes bigint not null default 0,
  -- "Replace photo": the favourite the couple wants in its place
  replacement_photo_id text references public.photos(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'done')),
  -- Null while it is a draft only its author sees; set by "Send feedback"
  sent_at timestamptz,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists album_proof_comments_page_id_idx on public.album_proof_comments(page_id);
create index if not exists album_proof_comments_parent_id_idx on public.album_proof_comments(parent_id);
create index if not exists album_proof_comments_replacement_photo_id_idx on public.album_proof_comments(replacement_photo_id);

create table if not exists public.album_proof_rounds (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.album_proofs(id) on delete cascade,
  number integer not null,
  sent_by text,
  sent_at timestamptz not null default now(),
  page_count integer not null default 0,
  updated_page_count integer not null default 0,
  unique (album_id, number)
);

-- B2 files of deleted versions and voice notes, also when a whole album or event is deleted. The backend deletes
-- them from B2 and then the row.
create table if not exists public.album_proof_deleted_files (
  id bigint generated always as identity primary key,
  storage_key text not null,
  queued_at timestamptz not null default now()
);

alter table public.album_proofs enable row level security;
alter table public.album_proof_pages enable row level security;
alter table public.album_proof_page_versions enable row level security;
alter table public.album_proof_comments enable row level security;
alter table public.album_proof_rounds enable row level security;
alter table public.album_proof_deleted_files enable row level security;
revoke all on table public.album_proofs, public.album_proof_pages, public.album_proof_page_versions,
  public.album_proof_comments, public.album_proof_rounds, public.album_proof_deleted_files from public, anon, authenticated;
grant all on table public.album_proofs, public.album_proof_pages, public.album_proof_page_versions,
  public.album_proof_comments, public.album_proof_rounds, public.album_proof_deleted_files to service_role;

create or replace function eb_private.album_proof_queue_deleted_files()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'album_proof_page_versions' then
    insert into public.album_proof_deleted_files (storage_key) values (old.preview_key), (old.thumbnail_key);
  elsif old.voice_key is not null then
    if tg_op = 'DELETE' then
      insert into public.album_proof_deleted_files (storage_key) values (old.voice_key);
    elsif old.voice_key is distinct from new.voice_key then
      insert into public.album_proof_deleted_files (storage_key) values (old.voice_key);
    end if;
  end if;
  return null;
end $$;
revoke all on function eb_private.album_proof_queue_deleted_files() from public, anon, authenticated;

drop trigger if exists album_proof_page_versions_queue_files on public.album_proof_page_versions;
create trigger album_proof_page_versions_queue_files after delete on public.album_proof_page_versions
  for each row execute function eb_private.album_proof_queue_deleted_files();
drop trigger if exists album_proof_comments_queue_files on public.album_proof_comments;
create trigger album_proof_comments_queue_files after delete or update of voice_key on public.album_proof_comments
  for each row execute function eb_private.album_proof_queue_deleted_files();

-- Adds a page at the end of the album with its first version. Locks the album so uploads running at the same time
-- get different positions, and enforces the page limit. Raises album_not_found / album_page_limit / album_approved.
create or replace function public.album_proof_add_page(
  p_album_id uuid, p_layout text, p_file_name text, p_preview_key text, p_thumbnail_key text,
  p_width integer, p_height integer, p_bytes bigint, p_user_id text, p_max_pages integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_approved timestamptz;
  v_count integer;
  v_position integer;
  v_page_id uuid;
begin
  select approved_at into v_approved from public.album_proofs where id = p_album_id for update;
  if not found then raise exception 'album_not_found'; end if;
  if v_approved is not null then raise exception 'album_approved'; end if;
  select count(*), coalesce(max(position), 0) into v_count, v_position from public.album_proof_pages where album_id = p_album_id;
  if v_count >= p_max_pages then raise exception 'album_page_limit'; end if;
  insert into public.album_proof_pages (album_id, position, layout)
    values (p_album_id, v_position + 1, p_layout) returning id into v_page_id;
  insert into public.album_proof_page_versions (page_id, version, file_name, preview_key, thumbnail_key, width, height, bytes, uploaded_by)
    values (v_page_id, 1, p_file_name, p_preview_key, p_thumbnail_key, p_width, p_height, p_bytes, p_user_id);
  update public.album_proofs set updated_at = now() where id = p_album_id;
  return v_page_id;
end $$;

-- A new version of a page. If the page already has a version that hasn't been sent for review yet, the new upload
-- takes its place (and its files are queued for deletion) instead of adding another. Returns the version number.
create or replace function public.album_proof_add_version(
  p_page_id uuid, p_file_name text, p_preview_key text, p_thumbnail_key text,
  p_width integer, p_height integer, p_bytes bigint, p_user_id text
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_album_id uuid;
  v_latest integer;
  v_latest_round integer;
  v_version integer;
begin
  select album_id into v_album_id from public.album_proof_pages where id = p_page_id for update;
  if not found then raise exception 'album_page_not_found'; end if;
  if exists (select 1 from public.album_proofs where id = v_album_id and approved_at is not null) then
    raise exception 'album_approved';
  end if;
  select version, round into v_latest, v_latest_round from public.album_proof_page_versions
    where page_id = p_page_id order by version desc limit 1;
  if v_latest is not null and v_latest_round = 0 then
    delete from public.album_proof_page_versions where page_id = p_page_id and version = v_latest;
    v_version := v_latest;
  else
    v_version := coalesce(v_latest, 0) + 1;
  end if;
  insert into public.album_proof_page_versions (page_id, version, file_name, preview_key, thumbnail_key, width, height, bytes, uploaded_by)
    values (p_page_id, v_version, p_file_name, p_preview_key, p_thumbnail_key, p_width, p_height, p_bytes, p_user_id);
  update public.album_proofs set updated_at = now() where id = v_album_id;
  return v_version;
end $$;

-- Sends every version not yet sent as the next review round. An approved album is reopened by it.
-- Raises album_not_found / album_nothing_to_send.
create or replace function public.album_proof_send_round(p_album_id uuid, p_user_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_round integer;
  v_pages integer;
  v_updated integer;
begin
  select current_round + 1 into v_round from public.album_proofs where id = p_album_id for update;
  if not found then raise exception 'album_not_found'; end if;
  select count(*), count(*) filter (where v.version > 1) into v_pages, v_updated
    from public.album_proof_page_versions v join public.album_proof_pages p on p.id = v.page_id
   where p.album_id = p_album_id and v.round = 0;
  if v_pages = 0 then raise exception 'album_nothing_to_send'; end if;
  update public.album_proof_page_versions v set round = v_round
    from public.album_proof_pages p where p.id = v.page_id and p.album_id = p_album_id and v.round = 0;
  insert into public.album_proof_rounds (album_id, number, sent_by, page_count, updated_page_count)
    values (p_album_id, v_round, p_user_id, v_pages, v_updated);
  update public.album_proofs set current_round = v_round, approved_at = null, approved_by = null, updated_at = now()
   where id = p_album_id;
  return jsonb_build_object('round', v_round, 'pages', v_pages, 'updatedPages', v_updated);
end $$;

-- Puts the album's pages in the given order. p_page_ids must be exactly the album's pages.
create or replace function public.album_proof_reorder(p_album_id uuid, p_page_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.album_proofs where id = p_album_id for update;
  if not found then raise exception 'album_not_found'; end if;
  if (select count(*) from public.album_proof_pages where album_id = p_album_id) <> coalesce(cardinality(p_page_ids), 0)
     or (select count(distinct id) from public.album_proof_pages where album_id = p_album_id and id = any(p_page_ids))
        <> coalesce(cardinality(p_page_ids), 0) then
    raise exception 'album_reorder_mismatch';
  end if;
  update public.album_proof_pages p set position = o.ord
    from unnest(p_page_ids) with ordinality as o(id, ord)
   where p.id = o.id and p.album_id = p_album_id;
  update public.album_proofs set updated_at = now() where id = p_album_id;
end $$;

revoke all on function public.album_proof_add_page(uuid, text, text, text, text, integer, integer, bigint, text, integer) from public, anon, authenticated;
revoke all on function public.album_proof_add_version(uuid, text, text, text, integer, integer, bigint, text) from public, anon, authenticated;
revoke all on function public.album_proof_send_round(uuid, text) from public, anon, authenticated;
revoke all on function public.album_proof_reorder(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.album_proof_add_page(uuid, text, text, text, text, integer, integer, bigint, text, integer) to service_role;
grant execute on function public.album_proof_add_version(uuid, text, text, text, integer, integer, bigint, text) to service_role;
grant execute on function public.album_proof_send_round(uuid, text) to service_role;
grant execute on function public.album_proof_reorder(uuid, uuid[]) to service_role;

-- Same as 20261010030000, plus album proofs (preview + thumbnail of every version, and voice notes) in the
-- owner's galleries. Same signature and grants.
create or replace function public.vault_event_storage_bytes(p_identifiers text[])
returns bigint
language sql
stable
set search_path = ''
as $$
  select ((
    select coalesce(sum(coalesce(p.size, 0) + coalesce(p.overhead_size, 0)), 0)
      from public.photos p
      join public.events e on e.id = p.event_id
      left join public.events root on root.id = e.parent_id
     where coalesce(root.created_by, e.created_by) = any(p_identifiers)
  ) + (
    select coalesce(sum(coalesce(v.bytes, 0)), 0)
      from public.album_proof_page_versions v
      join public.album_proof_pages pg on pg.id = v.page_id
      join public.album_proofs a on a.id = pg.album_id
      join public.events e on e.id = a.event_id
      left join public.events root on root.id = e.parent_id
     where coalesce(root.created_by, e.created_by) = any(p_identifiers)
  ) + (
    select coalesce(sum(coalesce(c.voice_bytes, 0)), 0)
      from public.album_proof_comments c
      join public.album_proof_pages pg on pg.id = c.page_id
      join public.album_proofs a on a.id = pg.album_id
      join public.events e on e.id = a.event_id
      left join public.events root on root.id = e.parent_id
     where coalesce(root.created_by, e.created_by) = any(p_identifiers)
  ))::bigint;
$$;

notify pgrst, 'reload schema';
commit;
