-- RLS lockdown, part 1: helpers, guests.user_id, profile_cards and the functions the apps call.
--
-- Generated from sections 1-3 of docs/security/rls-lockdown-draft.sql, minus can_manage_event_visibility and
-- set_event_public_viewing: creating them now would turn on the host visibility toggle, so they ship with part 2.
-- Adds new objects only (no triggers, no policies, no grants on existing tables, RLS unchanged), so existing screens
-- behave as before. Part 2 re-runs sections 1-3, which is safe: every statement is create-or-replace / if-not-exists.
--
-- Tests: docs/security/rls-lockdown-part1-tests.sql. Rollback: docs/security/rls-lockdown-part1-rollback.sql.

begin;
-- ════════════════════════════════════════════════════════════════════════════════
-- 1. Helpers (private schema: not exposed through the REST API)
-- ════════════════════════════════════════════════════════════════════════════════
create schema if not exists eb_private;
grant usage on schema eb_private to anon, authenticated;

-- Platform admin, same definition the dashboard and existing admin policies use
create or replace function eb_private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()::text and p.role = 'admin' and p.delegated_by is null
  )
$$;

-- Requests from the backend/Modal (service role) or direct database sessions (migrations, SQL editor)
create or replace function eb_private.is_trusted_session() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.role(), '') = 'service_role'
      or current_setting('request.jwt.claims', true) is null
      or current_setting('request.jwt.claims', true) = ''
$$;

-- Visibility and ownership live on the top-level gallery; sub-galleries inherit them
create or replace function eb_private.root_event_id(p_event_id text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(e.parent_id, e.id) from public.events e where e.id = p_event_id
$$;

create or replace function eb_private.is_event_owner(p_event_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.events r
    where r.id = eb_private.root_event_id(p_event_id)
      and (r.created_by = auth.uid()::text or r.created_by = (auth.jwt() ->> 'email'))
  )
$$;

-- Owner, platform admin, or an approved guest the owner made an admin
create or replace function eb_private.can_manage_event(p_event_id text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid text := auth.uid()::text;
  v_root text;
  v_owner text;
begin
  if v_uid is null or p_event_id is null then return false; end if;
  if eb_private.is_platform_admin() then return true; end if;
  v_root := eb_private.root_event_id(p_event_id);
  if v_root is null then return false; end if;
  select r.created_by into v_owner from public.events r where r.id = v_root;
  if v_owner = v_uid or v_owner = (auth.jwt() ->> 'email') then return true; end if;
  return exists (
    select 1 from public.guests g
    where g.user_id = v_uid and g.status = 'approved' and coalesce(g.can_admin, false)
      and g.event_id in (p_event_id, v_root)
  );
end $$;

-- Every gallery the caller may view. Used as `event_id in (select ...)` so it runs once per query.
create or replace function eb_private.viewable_event_ids() returns setof text
language plpgsql stable security definer set search_path = '' as $$
declare v_uid text := auth.uid()::text;
begin
  if v_uid is null then return; end if;
  if eb_private.is_platform_admin() then
    return query select e.id from public.events e;
    return;
  end if;
  return query
  with granted as (
    select e.id from public.events e
     where e.created_by = v_uid or e.created_by = (auth.jwt() ->> 'email')
    union
    select g.event_id from public.guests g where g.user_id = v_uid and g.status = 'approved' and g.event_id is not null
  )
  select e.id from public.events e
   where e.id in (select id from granted) or e.parent_id in (select id from granted);
end $$;

create or replace function eb_private.photo_event_id(p_photo_id text) returns text
language sql stable security definer set search_path = '' as $$
  select p.event_id from public.photos p where p.id = p_photo_id
$$;

-- Viewers may comment unless the host turned commenting off for them
create or replace function eb_private.can_comment_on_photo(p_photo_id text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_event text := eb_private.photo_event_id(p_photo_id); v_root text;
begin
  if auth.uid() is null or v_event is null then return false; end if;
  if eb_private.can_manage_event(v_event) then return true; end if;
  if v_event not in (select eb_private.viewable_event_ids()) then return false; end if;
  v_root := eb_private.root_event_id(v_event);
  return not exists (
    select 1 from public.guests g
    where g.user_id = auth.uid()::text and g.event_id in (v_event, v_root) and g.can_comment = false
  );
end $$;

create or replace function eb_private.resolve_event(p_ref text) returns text
language sql stable security definer set search_path = '' as $$
  select e.id from public.events e
   where e.id = p_ref or e.legacy_id = p_ref or e.join_id = p_ref
   order by (e.id = p_ref) desc, (e.join_id = p_ref) desc
   limit 1
$$;

revoke execute on all functions in schema eb_private from public;
grant execute on all functions in schema eb_private to anon, authenticated;  -- policies run as the caller

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. Schema changes
-- ════════════════════════════════════════════════════════════════════════════════
-- Gallery membership (guest access) is tied to a logged-in account instead of a phone number
alter table public.guests add column if not exists user_id text;
create unique index if not exists guests_user_event_key on public.guests (user_id, event_id) where user_id is not null;

-- Fix B: the column the website and app already send
alter table public.deleted_events_archive add column if not exists event_created_at timestamptz;

-- Names and avatars for likes/comments, without exposing email or phone
create or replace view public.profile_cards as
  select id, name, profile_image from public.profiles;
-- Supabase's default privileges give anon and authenticated full rights on new relations, and this view is
-- auto-updatable (it runs as its owner, past RLS), so take writes away from both before granting read.
revoke all on public.profile_cards from anon, authenticated;
grant select on public.profile_cards to authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 3. Functions the apps call
-- ════════════════════════════════════════════════════════════════════════════════
-- Opens a gallery from a link/QR reference (id, legacy id or join code).
-- Returns access: manage | member | public_view | pending | rejected | none | login_required | not_found
create or replace function public.open_gallery(p_ref text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid text := auth.uid()::text;
  v_id text := eb_private.resolve_event(p_ref);
  v_root public.events%rowtype;
  v_status text;
  v_public jsonb;
begin
  if v_id is null then return jsonb_build_object('access', 'not_found'); end if;
  select * into v_root from public.events where id = eb_private.root_event_id(v_id);

  if eb_private.can_manage_event(v_id) then
    return jsonb_build_object('access', 'manage', 'event_id', v_id);
  end if;

  if v_uid is not null then
    select g.status into v_status from public.guests g
     where g.user_id = v_uid and g.event_id in (v_id, v_root.id)
     order by (g.status = 'approved') desc limit 1;
    if v_status = 'approved' then return jsonb_build_object('access', 'member', 'event_id', v_id); end if;
    if v_status = 'rejected' then return jsonb_build_object('access', 'rejected', 'title', v_root.title); end if;
    if v_root.is_public then
      perform public.request_gallery_access(v_id);  -- public galleries are joined on open
      return jsonb_build_object('access', 'member', 'event_id', v_id);
    end if;
    return jsonb_build_object('access', coalesce(v_status, 'none'), 'event_id', v_id, 'title', v_root.title);
  end if;

  if not v_root.is_public then
    return jsonb_build_object('access', 'login_required', 'title', v_root.title);
  end if;

  -- Not logged in, public gallery: display fields only (no owner id, join code or originals)
  select jsonb_build_object(
           'id', e.id, 'title', e.title, 'date', e.date, 'description', e.description, 'type', e.type,
           'category', e.category, 'template_id', e.template_id, 'parent_id', e.parent_id,
           'cover_image', e.cover_image, 'cover_mode', e.cover_mode, 'cover_offset', e.cover_offset,
           'cover_offset_x', e.cover_offset_x, 'cover_scale', e.cover_scale, 'vendors', e.vendors)
    into v_public from public.events e where e.id = v_id;
  return jsonb_build_object(
    'access', 'public_view',
    'event', v_public,
    'sub_events', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'cover_image', s.cover_image, 'order', s."order")
                       order by s."order" nulls last)
        from public.events s where s.parent_id = v_root.id), '[]'::jsonb));
end $$;

-- Previews and video streams of a public gallery, for viewers who aren't logged in.
-- Photo originals (photos.url) are never returned.
-- A top-level gallery's Home tab shows the host's favourites from it and its sub-galleries when there are any,
-- as members see it; otherwise the gallery's own media. Cover uploads and unfinished media are left out, as in the apps.
create or replace function public.get_public_gallery_media(p_event_id text, p_limit int default 60, p_offset int default 0)
returns table (id text, event_id text, media_type text, preview_url text, thumbnail_url text, stream_url text,
               width int, height int, duration numeric, sort_order int, uploaded_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with gallery as (
    select e.id, e.parent_id is null as is_top_level
      from public.events e
     where e.id = p_event_id
       and coalesce((select r.is_public from public.events r where r.id = eb_private.root_event_id(p_event_id)), false)
  ),
  family as (
    select g.id from gallery g where g.is_top_level
    union
    select s.id from public.events s join gallery g on s.parent_id = g.id where g.is_top_level
  ),
  favourites as (
    select f.photo_id, max(f.created_at) as picked_at
      from public.event_favourite_photos f
     where f.event_id in (select family.id from family)
     group by f.photo_id
  ),
  media as (
    select p.*, fav.picked_at
      from favourites fav join public.photos p on p.id = fav.photo_id
     where p.event_id in (select family.id from family)
    union all
    select p.*, null::timestamptz
      from public.photos p
     where p.event_id = (select g.id from gallery g) and not exists (select 1 from favourites)
  )
  select m.id, m.event_id, m.media_type,
         coalesce(m.preview_url, m.thumbnail_url),
         m.thumbnail_url,
         case when m.media_type = 'video' then m.url end,      -- HLS master playlist, not the uploaded file
         m.width, m.height, m.duration, m."order", m.uploaded_at
    from media m
   where (m.media_type is distinct from 'video' or m.status = 'processed')
     and m.status is distinct from 'uploading'
     and not coalesce(m.tags @> array['__cover_usage__']::text[], false)
     and coalesce(m.preview_url, m.thumbnail_url) is not null
   order by m.picked_at desc nulls last, m."order" nulls last, m.uploaded_at desc
   limit least(greatest(coalesce(p_limit, 60), 1), 200) offset greatest(coalesce(p_offset, 0), 0)
$$;

-- Logged-in guest asks to join a gallery. Public: approved at once. Private: pending until the host approves.
create or replace function public.request_gallery_access(p_ref text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid text := auth.uid()::text;
  v_id text := eb_private.resolve_event(p_ref);
  v_root public.events%rowtype;
  v_status text;
begin
  if v_uid is null then raise exception 'Log in to request access' using errcode = '42501'; end if;
  if v_id is null then raise exception 'Gallery not found'; end if;
  select * into v_root from public.events where id = eb_private.root_event_id(v_id);
  -- can_comment defaults to false in the table; members may comment unless the host turns it off for them
  insert into public.guests (id, name, phone, event_id, parent_event_owner_id, event_title, status, user_id, login_at, can_comment)
  values ('u_' || v_uid || '_' || v_root.id,
          coalesce((select p.name from public.profiles p where p.id = v_uid), 'Guest'),
          coalesce((select p.phone from public.profiles p where p.id = v_uid), ''),
          v_root.id, v_root.created_by, v_root.title,
          case when v_root.is_public then 'approved' else 'pending' end,
          v_uid, now(), true)
  on conflict (id) do update set login_at = now()
  returning status into v_status;
  return v_status;
end $$;

-- Deletion record, written with the gallery's real owner (call before deleting the gallery)
create or replace function public.archive_deleted_event(p_event_id text, p_photos_count int, p_videos_count int,
                                                        p_total_bytes bigint, p_deleted_by text, p_event_created_at timestamptz default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found then return; end if;
  if not eb_private.can_manage_event(p_event_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.deleted_events_archive (event_id, user_id, event_title, photos_count, videos_count, total_bytes,
                                             estimated_modal_cost_inr, deleted_by, event_created_at)
  values (p_event_id, coalesce(v_event.created_by, auth.uid()::text), coalesce(v_event.title, 'Untitled Gallery'),
          greatest(coalesce(p_photos_count, 0), 0), greatest(coalesce(p_videos_count, 0), 0),
          greatest(coalesce(p_total_bytes, 0), 0), 0, left(coalesce(p_deleted_by, 'user'), 40), p_event_created_at);
end $$;

-- Tenant login allowlist check without exposing the list
create or replace function public.is_phone_allowed(p_phone text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.allowed_users a where a.phone = p_phone)
$$;

-- Postgres grants EXECUTE to PUBLIC, and Supabase's default privileges to anon and authenticated, on new
-- functions, so revoke from all three before granting
revoke execute on function public.open_gallery(text) from public, anon, authenticated;
revoke execute on function public.get_public_gallery_media(text, int, int) from public, anon, authenticated;
revoke execute on function public.request_gallery_access(text) from public, anon, authenticated;
revoke execute on function public.archive_deleted_event(text, int, int, bigint, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.is_phone_allowed(text) from public, anon, authenticated;
grant execute on function public.open_gallery(text) to anon, authenticated;
grant execute on function public.get_public_gallery_media(text, int, int) to anon, authenticated;
grant execute on function public.is_phone_allowed(text) to anon, authenticated;
grant execute on function public.request_gallery_access(text) to authenticated;
grant execute on function public.archive_deleted_event(text, int, int, bigint, text, timestamptz) to authenticated;

commit;
