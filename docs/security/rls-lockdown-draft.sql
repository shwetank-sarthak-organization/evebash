-- DRAFT FOR REVIEW. NOT APPLIED. Do not copy into supabase/migrations until reviewed and tested.
--
-- Locks down the tables the website, mobile app and analytics dashboard read and write directly with the
-- public (anon) key. The backend and Modal use the service role, which bypasses RLS, so they are unaffected.
--
-- Access model (agreed 2026-10-06):
--   * Not logged in + link/QR to a PUBLIC gallery: view previews and video streams only, through
--     open_gallery() / get_public_gallery_media(). No direct table access, so nothing can be listed.
--   * Logged in + link/QR: open_gallery() joins the gallery. Public: approved at once. Private: the guest
--     calls request_gallery_access() and the host approves the guests row.
--   * Approved members can view, download originals, like and comment (unless the host set can_comment=false).
--   * The owner and guests the owner made admins (guests.can_admin) manage the gallery; only the owner deletes it.
--     Platform admins (role 'admin' with no delegated_by, as the dashboard checks) can do everything.
--   * The hidden primary/event "manager" delegation (profiles.delegated_by, profile_assigned_events) is not granted
--     any access here (decided 2026-10-06: guest admin covers it). Role, plan and delegation columns change only via
--     the service role or a platform admin.
--
-- Rollback: docs/security/rls-lockdown-rollback.sql

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

-- Expired-plan media limit (same rules as the apps' former client-side code). Paid roles (anything but admin, free,
-- user, freemium) whose plan_end_date has passed (end of that day, UTC):
--   grace   = up to 7 days later: everything still shows; the apps flag media beyond the free allowance
--   expired = more than 7 days later: only the oldest media fitting in the free 1 GB shows, counted across all the
--             owner's galleries (cover uploads excluded)
-- Returns {state} and, for grace/expired, retained_ids limited to the asked gallery's family (root + sub-galleries).
create or replace function eb_private.media_plan_limit(p_event_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_owner text;
  v_owner_id text;
  v_owner_email text;
  v_role text;
  v_end_date date;
  v_end timestamptz;
  v_root text := eb_private.root_event_id(p_event_id);
  v_family text[];
  v_total bigint := 0;
  v_ids text[] := '{}';
  r record;
begin
  select coalesce(e.created_by, root.created_by) into v_owner
    from public.events e left join public.events root on root.id = v_root
   where e.id = p_event_id;
  if v_owner is null then return jsonb_build_object('state', 'active'); end if;

  select p.id, p.email, p.role, p.plan_end_date into v_owner_id, v_owner_email, v_role, v_end_date
    from public.profiles p
   where case when position('@' in v_owner) > 0 then p.email = v_owner else p.id = v_owner end
   limit 1;
  if v_owner_id is null or v_end_date is null or lower(coalesce(v_role, 'free')) in ('admin', 'free', 'user', 'freemium') then
    return jsonb_build_object('state', 'active');
  end if;

  v_end := (v_end_date::timestamp + interval '1 day' - interval '1 millisecond') at time zone 'UTC';
  if now() <= v_end then return jsonb_build_object('state', 'active'); end if;
  v_family := array(select e.id from public.events e where e.id = v_root or e.parent_id = v_root);

  for r in
    select p.id, p.event_id, coalesce(p.size, 0) as size
      from public.photos p join public.events e on e.id = p.event_id
     where e.created_by in (v_owner_id, v_owner_email)
       and not coalesce(p.tags @> array['__cover_usage__']::text[], false)
     order by p.uploaded_at nulls first, p.id
  loop
    if v_total + r.size <= 1073741824 then
      v_total := v_total + r.size;
      if r.event_id = any(v_family) then v_ids := v_ids || r.id; end if;
    end if;
  end loop;

  return jsonb_build_object(
    'state', case when now() > v_end + interval '7 days' then 'expired' else 'grace' end,
    'retained_ids', to_jsonb(v_ids));
end $$;

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
-- Returns access: manage | member | public_view | pending | none | login_required | not_found
-- (a rejected guest gets none, so they can ask again)
create or replace function public.open_gallery(p_ref text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid text := auth.uid()::text;
  v_id text := eb_private.resolve_event(p_ref);
  v_root public.events%rowtype;
  v_status text;
  v_public jsonb;
  v_sample boolean;
begin
  if v_id is null then return jsonb_build_object('access', 'not_found'); end if;
  select * into v_root from public.events where id = eb_private.root_event_id(v_id);
  -- Sample galleries (the showcase) can be viewed read-only by anyone, like public ones, but are never joined
  v_sample := coalesce(v_root.is_sample_gallery, false);

  if eb_private.can_manage_event(v_id) then
    return jsonb_build_object('access', 'manage', 'event_id', v_id);
  end if;

  if v_uid is not null then
    select g.status into v_status from public.guests g
     where g.user_id = v_uid and g.event_id in (v_id, v_root.id)
     order by (g.status = 'approved') desc limit 1;
    if v_status = 'approved' then return jsonb_build_object('access', 'member', 'event_id', v_id); end if;
    if v_root.is_public then
      -- Public galleries are joined on open, including by people whose earlier request was pending or rejected
      v_status := public.request_gallery_access(v_id);
      if v_status = 'approved' then return jsonb_build_object('access', 'member', 'event_id', v_id); end if;
    end if;
    if not v_sample then
      -- A rejection isn't final: a rejected guest sees the same "request access" screen as someone who never asked
      if v_status = 'rejected' then v_status := null; end if;
      return jsonb_build_object('access', coalesce(v_status, 'none'), 'event_id', v_id, 'title', v_root.title);
    end if;
  elsif not (v_root.is_public or v_sample) then
    return jsonb_build_object('access', 'login_required', 'title', v_root.title);
  end if;

  -- Read-only view (not logged in on a public or sample gallery, or logged in on a sample gallery):
  -- display fields only (no owner id, join code or originals)
  select jsonb_build_object(
           'id', e.id, 'title', e.title, 'date', e.date, 'description', e.description, 'type', e.type,
           'category', e.category, 'template_id', e.template_id, 'parent_id', e.parent_id,
           'cover_image', e.cover_image, 'cover_mode', e.cover_mode, 'cover_offset', e.cover_offset,
           'cover_offset_x', e.cover_offset_x, 'cover_scale', e.cover_scale, 'vendors', e.vendors,
           'is_sample_gallery', v_sample)
    into v_public from public.events e where e.id = v_id;
  return jsonb_build_object(
    'access', 'public_view',
    'event', v_public,
    'sub_events', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'cover_image', s.cover_image, 'order', s."order",
                                          'date', s.date, 'category', s.category)
                       order by s."order" nulls last)
        from public.events s where s.parent_id = v_root.id), '[]'::jsonb));
end $$;

-- Previews and video streams of a public (or sample) gallery, for viewers who aren't logged in.
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
       and coalesce((select r.is_public or coalesce(r.is_sample_gallery, false)
                       from public.events r where r.id = eb_private.root_event_id(p_event_id)), false)
  ),
  plan as (select eb_private.media_plan_limit(p_event_id) as l),
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
     -- Expired paid plan: only the media kept within the free allowance
     and ((select l ->> 'state' from plan) is distinct from 'expired'
          or m.id in (select jsonb_array_elements_text(l -> 'retained_ids') from plan))
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
  -- Asking again: approved stays approved; pending or rejected becomes pending (private) or approved (public)
  on conflict (id) do update
    set login_at = now(),
        status = case when public.guests.status = 'approved' then 'approved' else excluded.status end
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

-- Username "already taken" check for profile edit and sign-up, without exposing anyone's profile (other people's
-- profiles aren't readable once RLS is on). Usernames are stored lower-case; profiles_username_key enforces it on save.
create or replace function public.is_username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.profiles p
     where p.username = lower(trim(p_username))
       and p.id is distinct from auth.uid()::text
  )
$$;

-- Expired-plan media limit for a gallery the caller can see: {state: active | grace | expired, retained_ids}.
-- Worked out here because the owner's profile and other galleries aren't readable to guests once RLS is on.
-- Returns null for galleries the caller can't see. Nothing else about the owner is returned.
create or replace function public.get_media_plan_limit(p_event_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (eb_private.can_manage_event(p_event_id) or p_event_id in (select eb_private.viewable_event_ids())) then
    return null;
  end if;
  return eb_private.media_plan_limit(p_event_id);
end $$;

-- The Sample Galleries showcase list (also for logged-out visitors): display fields of top-level sample galleries.
create or replace function public.get_sample_galleries() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'title', e.title, 'date', e.date, 'description', e.description, 'type', e.type,
           'category', e.category, 'template_id', e.template_id, 'cover_image', e.cover_image,
           'cover_mode', e.cover_mode, 'cover_offset', e.cover_offset, 'cover_offset_x', e.cover_offset_x,
           'cover_scale', e.cover_scale, 'is_sample_gallery', true, 'sample_gallery_order', e.sample_gallery_order)
         order by e.sample_gallery_order nulls last, e.title), '[]'::jsonb)
    from public.events e
   where e.is_sample_gallery and (e.type = 'main' or (e.type is null and e.parent_id is null))
$$;

-- Tenant login allowlist check without exposing the list
create or replace function public.is_phone_allowed(p_phone text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.allowed_users a where a.phone = p_phone)
$$;

-- From Shwetank's 2026-10-05 migrations (20261004020000_event_admin_visibility.sql), which never applied: they compared
-- profiles.id (text) with auth.uid() (uuid) and read a guests.email column that doesn't exist. Same rules, fixed:
-- the owner and the gallery's guest admins may switch a top-level gallery public/private (his manager types are dropped).
create or replace function public.can_manage_event_visibility(p_event_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event_id and e.parent_id is null)
     and eb_private.can_manage_event(p_event_id)
$$;

create or replace function public.set_event_public_viewing(event_id text, public_viewing boolean) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare event_row public.events%rowtype;
begin
  select * into event_row from public.events e where e.id = event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if event_row.parent_id is not null then raise exception 'Change visibility on the parent event'; end if;
  if not public.can_manage_event_visibility(event_id) then
    raise exception 'Only the event owner and event admins can change public viewing' using errcode = '42501';
  end if;
  if public_viewing is null then raise exception 'Visibility is required'; end if;
  update public.events e set is_public = public_viewing where e.id = event_id;
  return public_viewing;
end $$;

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
revoke execute on function public.is_username_available(text) from public, anon, authenticated;
grant execute on function public.is_username_available(text) to authenticated;
revoke execute on function public.get_media_plan_limit(text) from public, anon, authenticated;
grant execute on function public.get_media_plan_limit(text) to authenticated;
revoke execute on function public.get_sample_galleries() from public, anon, authenticated;
grant execute on function public.get_sample_galleries() to anon, authenticated;
revoke execute on function public.can_manage_event_visibility(text) from public, anon;
revoke execute on function public.set_event_public_viewing(text, boolean) from public, anon;
grant execute on function public.can_manage_event_visibility(text) to authenticated;
grant execute on function public.set_event_public_viewing(text, boolean) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 4. Protected columns
-- ════════════════════════════════════════════════════════════════════════════════
-- Role (which is also the plan), delegation and plan dates change only through the server or a platform admin.
-- A new profile always starts as a plain user.
create or replace function eb_private.protect_profile_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if eb_private.is_trusted_session() or eb_private.is_platform_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'user'; new.role_type := null; new.delegated_by := null;
    new.subscription_duration := null; new.plan_start_date := null; new.plan_end_date := null;
    new.pending_plan_role := null; new.pending_subscription_duration := null;
    new.pending_plan_start_date := null; new.pending_plan_end_date := null;
    return new;
  end if;
  if (new.role, new.role_type, new.delegated_by, new.subscription_duration, new.plan_start_date, new.plan_end_date,
      new.pending_plan_role, new.pending_subscription_duration, new.pending_plan_start_date, new.pending_plan_end_date)
     is distinct from
     (old.role, old.role_type, old.delegated_by, old.subscription_duration, old.plan_start_date, old.plan_end_date,
      old.pending_plan_role, old.pending_subscription_duration, old.pending_plan_start_date, old.pending_plan_end_date) then
    raise exception 'Plan, role and admin changes go through the server' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists eb_protect_profile_columns on public.profiles;
create trigger eb_protect_profile_columns before insert or update on public.profiles
  for each row execute function eb_private.protect_profile_columns();

-- Gallery owner and visibility (rules from Shwetank's 2026-10-05 migration): owner can't change; owner and managers
-- may change is_public; only the owner may create a gallery that starts public; sub-galleries inherit visibility;
-- sample-gallery flag only by platform admins.
create or replace function eb_private.protect_event_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if eb_private.is_trusted_session() or eb_private.is_platform_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.is_public and (new.created_by is distinct from auth.uid()::text) then
      raise exception 'Only the event owner can create a public event' using errcode = '42501';
    end if;
    if new.is_public and new.parent_id is not null then
      raise exception 'Sub-galleries inherit public viewing from their parent event';
    end if;
    if new.is_sample_gallery then
      raise exception 'Sample galleries are managed by EveBash admins' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'A gallery''s owner cannot be changed' using errcode = '42501';
  end if;
  if new.is_public is distinct from old.is_public then
    if new.parent_id is not null then raise exception 'Sub-galleries inherit public viewing from their parent event'; end if;
    if not public.can_manage_event_visibility(old.id) then
      raise exception 'Only the event owner and event admins can change public viewing' using errcode = '42501';
    end if;
  end if;
  if new.is_sample_gallery is distinct from old.is_sample_gallery or new.sample_gallery_order is distinct from old.sample_gallery_order then
    raise exception 'Sample galleries are managed by EveBash admins' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists eb_protect_event_columns on public.events;
create trigger eb_protect_event_columns before insert or update on public.events
  for each row execute function eb_private.protect_event_columns();
-- Retire the live owner-only trigger from 20260925000000_add_event_public_viewing.sql: its checks are in
-- protect_event_columns above, and it would block guest admins from changing visibility.
drop trigger if exists guard_event_public_setting on public.events;

-- ════════════════════════════════════════════════════════════════════════════════
-- 5. Row level security, launch tables
-- ════════════════════════════════════════════════════════════════════════════════
-- Anonymous visitors get no direct table access; they use open_gallery / get_public_gallery_media.

-- events
alter table public.events enable row level security;
create policy events_select on public.events for select to authenticated
  using (id in (select eb_private.viewable_event_ids()));
create policy events_insert on public.events for insert to authenticated
  with check (created_by = auth.uid()::text or eb_private.is_platform_admin());
create policy events_update on public.events for update to authenticated
  using (eb_private.can_manage_event(id)) with check (eb_private.can_manage_event(id));
create policy events_delete on public.events for delete to authenticated
  using (eb_private.is_event_owner(id) or eb_private.is_platform_admin());

-- photos (uploads are written by the backend with the service role)
alter table public.photos enable row level security;
create policy photos_select on public.photos for select to authenticated
  using (event_id in (select eb_private.viewable_event_ids()));
create policy photos_insert on public.photos for insert to authenticated
  with check (eb_private.can_manage_event(event_id));
create policy photos_update on public.photos for update to authenticated
  using (eb_private.can_manage_event(event_id)) with check (eb_private.can_manage_event(event_id));
create policy photos_delete on public.photos for delete to authenticated
  using (eb_private.can_manage_event(event_id));

-- guests (gallery membership and access requests)
alter table public.guests enable row level security;
create policy guests_select on public.guests for select to authenticated
  using (user_id = auth.uid()::text or eb_private.can_manage_event(event_id));
create policy guests_update on public.guests for update to authenticated
  using (eb_private.can_manage_event(event_id)) with check (eb_private.can_manage_event(event_id));
create policy guests_delete on public.guests for delete to authenticated
  using (user_id = auth.uid()::text or eb_private.can_manage_event(event_id));
-- inserts only through request_gallery_access / open_gallery

-- likes
alter table public.likes enable row level security;
create policy likes_select on public.likes for select to authenticated
  using (eb_private.photo_event_id(photo_id) in (select eb_private.viewable_event_ids()));
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = auth.uid()::text
              and eb_private.photo_event_id(photo_id) in (select eb_private.viewable_event_ids()));
create policy likes_delete on public.likes for delete to authenticated
  using (user_id = auth.uid()::text or eb_private.can_manage_event(eb_private.photo_event_id(photo_id)));

-- comments
alter table public.comments enable row level security;
create policy comments_select on public.comments for select to authenticated
  using (eb_private.photo_event_id(photo_id) in (select eb_private.viewable_event_ids()));
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid()::text and eb_private.can_comment_on_photo(photo_id));
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid()::text or eb_private.can_manage_event(eb_private.photo_event_id(photo_id)));

-- event_favourite_photos (host's picks): replaces "any logged-in user can change any gallery's favourites"
drop policy if exists "Allow authenticated users to manage event favourites" on public.event_favourite_photos;
drop policy if exists "Allow reading event favourites" on public.event_favourite_photos;
create policy favourites_select on public.event_favourite_photos for select to authenticated
  using (event_id in (select eb_private.viewable_event_ids()));
create policy favourites_insert on public.event_favourite_photos for insert to authenticated
  with check (eb_private.can_manage_event(event_id));
create policy favourites_delete on public.event_favourite_photos for delete to authenticated
  using (eb_private.can_manage_event(event_id));

-- faces: replaces "anyone can read every face scan". Find You runs on the backend; clients only delete.
drop policy if exists "Allow reading face index" on public.faces;
create policy faces_delete on public.faces for delete to authenticated
  using (eb_private.can_manage_event(event_id));

-- profiles
alter table public.profiles enable row level security;
drop policy if exists "Users can update own profile" on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid()::text or eb_private.is_platform_admin());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid()::text);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()::text or eb_private.is_platform_admin())
  with check (id = auth.uid()::text or eb_private.is_platform_admin());
create policy profiles_delete on public.profiles for delete to authenticated
  using (id = auth.uid()::text or eb_private.is_platform_admin());

-- profile_assigned_events (hidden manager feature, not used): platform admins only, for the dashboard's existing cleanup
alter table public.profile_assigned_events enable row level security;
create policy assigned_admin on public.profile_assigned_events for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());

-- allowed_users / pending_requests (tenant phone allowlist)
alter table public.allowed_users enable row level security;
create policy allowed_users_admin on public.allowed_users for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());
alter table public.pending_requests enable row level security;
create policy pending_requests_submit on public.pending_requests for insert to anon, authenticated
  with check (true);
create policy pending_requests_admin on public.pending_requests for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());

-- deleted_events_archive / modal_cost_logs: platform admins read (dashboard); writes by the server,
-- archive_deleted_event(), or a platform admin
drop policy if exists "Allow authenticated and service role read" on public.deleted_events_archive;
drop policy if exists "Allow service role full access" on public.deleted_events_archive;
create policy archive_admin on public.deleted_events_archive for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());
drop policy if exists "Allow anon and authenticated read" on public.modal_cost_logs;
drop policy if exists "Allow service role full access" on public.modal_cost_logs;
create policy cost_logs_admin on public.modal_cost_logs for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());

-- infra_invoices: the existing admin check let delegate admins in
drop policy if exists "Allow authenticated admins full access to infra_invoices" on public.infra_invoices;
create policy infra_invoices_admin on public.infra_invoices for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());

-- pricing_plans: public read stays; dashboard writes need a platform admin
create policy pricing_plans_admin on public.pricing_plans for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());

-- ════════════════════════════════════════════════════════════════════════════════
-- 6. Row level security, business features (not in launch scope: owner/participant only)
-- ════════════════════════════════════════════════════════════════════════════════
-- Phase 2 business features (vendor listings, ratings, enquiries, client-vendor chat): logged-in users only for now;
-- decide public browsing when Phase 2 launches.
alter table public.businesses enable row level security;
create policy businesses_select on public.businesses for select to authenticated using (true);
create policy businesses_insert on public.businesses for insert to authenticated
  with check (created_by = auth.uid()::text);
create policy businesses_update on public.businesses for update to authenticated
  using (created_by = auth.uid()::text or eb_private.is_platform_admin())
  with check (created_by = auth.uid()::text or eb_private.is_platform_admin());
-- REVIEW: mobile incrementBusinessViewCount updates profile_views on someone else's business; move it to a function.
create policy businesses_delete on public.businesses for delete to authenticated
  using (created_by = auth.uid()::text or eb_private.is_platform_admin());

alter table public.business_ratings enable row level security;
create policy ratings_select on public.business_ratings for select to authenticated using (true);
create policy ratings_write on public.business_ratings for all to authenticated
  using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

alter table public.enquiries enable row level security;
create policy enquiries_select on public.enquiries for select to authenticated
  using (user_id = auth.uid()::text or vendor_owner_id = auth.uid()::text or eb_private.is_platform_admin());
create policy enquiries_insert on public.enquiries for insert to authenticated
  with check (user_id = auth.uid()::text);

alter table public.chat_rooms enable row level security;
create policy chat_rooms_participants on public.chat_rooms for all to authenticated
  using (client_uid = auth.uid()::text or vendor_uid = auth.uid()::text)
  with check (client_uid = auth.uid()::text or vendor_uid = auth.uid()::text);

alter table public.messages enable row level security;
create policy messages_select on public.messages for select to authenticated
  using (exists (select 1 from public.chat_rooms r where r.id = room_id
                 and (r.client_uid = auth.uid()::text or r.vendor_uid = auth.uid()::text)));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid()::text and exists (
    select 1 from public.chat_rooms r where r.id = room_id
       and (r.client_uid = auth.uid()::text or r.vendor_uid = auth.uid()::text)));

-- ════════════════════════════════════════════════════════════════════════════════
-- 7. Anonymous key: no writes anywhere except tenant access requests
-- ════════════════════════════════════════════════════════════════════════════════
revoke insert, update, delete, truncate on all tables in schema public from anon;
grant insert on public.pending_requests to anon;

commit;
