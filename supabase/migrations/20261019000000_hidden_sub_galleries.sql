-- Hidden from guests: a host can hide a sub-gallery, or single photos and videos, from guests ("Hide from guests"
-- on the host page and in the app). They then show only in the Host section, for everyone including the host; the
-- event's managers (owner, guest admins, platform admins) still see and edit them there.
-- * events.is_hidden (sub-galleries only; the Home / primary gallery can't be hidden), photos.is_hidden.
-- * open_gallery: a hidden sub-gallery opens only for managers (others get not_found), and the public sub-gallery
--   list leaves hidden ones out.
-- * get_public_gallery_media (logged-out visitors of public galleries): hidden photos and videos, and hidden
--   sub-galleries' media, aren't returned (on their own page or among Home's favourites). Home now lists the
--   favourites first and then its own uploads (before, its own uploads only showed when no favourites were picked),
--   as the website and app do.
-- The website, app and backend leave hidden sub-galleries and media out of the guest side (Collections, gallery
-- cards, grids, Home's favourites, Find You, downloads). Members can still read their rows directly until RLS lockdown
-- part 2 (issue #21), which should treat hidden sub-galleries as manager-only too.
-- open_gallery is copied from 20261011020000 and get_public_gallery_media from 20261009020000, each with only the
-- hidden-gallery lines added.
-- Rollback: re-run open_gallery from 20261011020000 and get_public_gallery_media from 20261009020000, then
-- alter table public.events drop column is_hidden; alter table public.photos drop column is_hidden.

begin;

alter table public.events add column if not exists is_hidden boolean not null default false;
comment on column public.events.is_hidden is 'Sub-gallery hidden from guests by the host; managers still see it.';
alter table public.photos add column if not exists is_hidden boolean not null default false;
comment on column public.photos.is_hidden is 'Photo or video hidden from guests by the host; shown only in the Host section.';

CREATE OR REPLACE FUNCTION public.open_gallery(p_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid text := auth.uid()::text;
  v_id text := eb_private.resolve_event(p_ref);
  v_root public.events%rowtype;
  v_status text;
  v_public jsonb;
  v_sample boolean;
  v_can_upload boolean := false;
  v_can_comment boolean := false;
begin
  if v_id is null then return jsonb_build_object('access', 'not_found'); end if;
  select * into v_root from public.events where id = eb_private.root_event_id(v_id);
  -- Sample galleries (the showcase) can be viewed read-only by anyone, like public ones, but are never joined
  v_sample := coalesce(v_root.is_sample_gallery, false);

  if eb_private.can_manage_event(v_id) then
    return jsonb_build_object('access', 'manage', 'event_id', v_id, 'can_upload', true, 'can_comment', true);
  end if;

  -- A sub-gallery the host hid from guests is only for the event's managers (owner, guest admins, platform admins)
  if exists (select 1 from public.events e where e.id = v_id and e.parent_id is not null and coalesce(e.is_hidden, false)) then
    return jsonb_build_object('access', 'not_found');
  end if;

  if v_uid is not null then
    select g.status, coalesce(g.can_upload, false), coalesce(g.can_comment, false)
      into v_status, v_can_upload, v_can_comment from public.guests g
     where g.user_id = v_uid and g.event_id in (v_id, v_root.id)
     order by (g.status = 'approved') desc limit 1;
    -- What the host allowed this member (website and app show the upload button and comment box from these)
    if v_status = 'approved' then
      return jsonb_build_object('access', 'member', 'event_id', v_id, 'can_upload', v_can_upload, 'can_comment', v_can_comment);
    end if;
    if v_root.is_public then
      -- Public galleries are joined on open, including by people whose earlier request was pending or rejected
      v_status := public.request_gallery_access(v_id);
      -- Just joined (or asked again): uploads and comments start off
      if v_status = 'approved' then
        return jsonb_build_object('access', 'member', 'event_id', v_id, 'can_upload', false, 'can_comment', false);
      end if;
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
        from public.events s where s.parent_id = v_root.id and not coalesce(s.is_hidden, false)), '[]'::jsonb));
end $function$;

create or replace function public.get_public_gallery_media(p_event_id text, p_limit int default 60, p_offset int default 0)
returns table (id text, event_id text, media_type text, preview_url text, thumbnail_url text, stream_url text,
               width int, height int, duration numeric, sort_order int, uploaded_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with gallery as (
    select e.id, e.parent_id is null as is_top_level
      from public.events e
     where e.id = p_event_id
       and not (e.parent_id is not null and coalesce(e.is_hidden, false))
       and coalesce((select r.is_public or coalesce(r.is_sample_gallery, false)
                       from public.events r where r.id = eb_private.root_event_id(p_event_id)), false)
  ),
  plan as (select eb_private.media_plan_limit(p_event_id) as l),
  family as (
    select g.id from gallery g where g.is_top_level
    union
    select s.id from public.events s join gallery g on s.parent_id = g.id where g.is_top_level and not coalesce(s.is_hidden, false)
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
     where p.event_id = (select g.id from gallery g)
       and p.id not in (select fav.photo_id from favourites fav)
  )
  select m.id, m.event_id, m.media_type,
         coalesce(m.preview_url, m.thumbnail_url),
         m.thumbnail_url,
         case when m.media_type = 'video' then m.url end,      -- HLS master playlist, not the uploaded file
         m.width, m.height, m.duration, m."order", m.uploaded_at
    from media m
   where (m.media_type is distinct from 'video' or m.status = 'processed')
     and not coalesce(m.is_hidden, false)
     and m.status is distinct from 'uploading'
     and not coalesce(m.tags @> array['__cover_usage__']::text[], false)
     and coalesce(m.preview_url, m.thumbnail_url) is not null
     -- Expired paid plan: only the media kept within the free allowance
     and ((select l ->> 'state' from plan) is distinct from 'expired'
          or m.id in (select jsonb_array_elements_text(l -> 'retained_ids') from plan))
   order by m.picked_at desc nulls last, m."order" nulls last, m.uploaded_at desc
   limit least(greatest(coalesce(p_limit, 60), 1), 200) offset greatest(coalesce(p_offset, 0), 0)
$$;

notify pgrst, 'reload schema';
commit;
