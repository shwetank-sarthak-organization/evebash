-- Lockdown items D and E (decided 2026-10-09). Both broke for guests or logged-out visitors once RLS is on, because they
-- read other people's rows from the device:
-- D  Expired-plan media limit: worked out in the database (eb_private.media_plan_limit) instead of on the viewer's
--    device; get_media_plan_limit for the apps, and get_public_gallery_media applies it for logged-out viewers.
-- E  Sample Galleries: viewable read-only by anyone, like public galleries but never joined (open_gallery,
--    get_public_gallery_media), and listed by get_sample_galleries.
-- Copied from docs/security/rls-lockdown-draft.sql; keep in sync.
-- Rollback: re-run open_gallery and get_public_gallery_media from 20261009000000 / 20261007000000, then drop
-- get_media_plan_limit(text), get_sample_galleries() and eb_private.media_plan_limit(text).

begin;

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

revoke execute on function eb_private.media_plan_limit(text) from public;
grant execute on function eb_private.media_plan_limit(text) to anon, authenticated;
revoke execute on function public.get_media_plan_limit(text) from public, anon, authenticated;
grant execute on function public.get_media_plan_limit(text) to authenticated;
revoke execute on function public.get_sample_galleries() from public, anon, authenticated;
grant execute on function public.get_sample_galleries() to anon, authenticated;

commit;
