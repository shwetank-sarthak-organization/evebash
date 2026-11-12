-- Phone cover (todo #11, issue #64): a gallery can have a second cover for phones (the app and phone browsers), with
-- its own photo and framing, next to the existing cover, which becomes the computer cover. Decided 2026-11-06 (Sarthak).
-- * events.phone_cover_image: the phone cover's photo; null = phones show the computer cover's photo.
-- * events.phone_cover_mode / phone_cover_offset / phone_cover_offset_x / phone_cover_scale: its Fit / Fill and
--   framing, with the same meaning as cover_mode / cover_offset / cover_offset_x / cover_scale (a focus point in
--   percent and a zoom, shared/themes/coverFocus.ts); phone_cover_mode null = phones use the computer cover's framing.
-- * open_gallery (logged-out view of public and sample galleries) and get_sample_galleries also return the new
--   fields. Both are the live definitions of 2026-11-06 with only the phone fields added.
-- Nothing existing changes: every new column starts empty, so every gallery looks as it does today until a host sets a
-- phone cover; older app builds ignore the new columns.
-- Rollback:
--   alter table public.events drop column phone_cover_image, drop column phone_cover_mode,
--     drop column phone_cover_offset, drop column phone_cover_offset_x, drop column phone_cover_scale;
--   then re-run the two functions below without the phone_* lines.

begin;

alter table public.events
  add column if not exists phone_cover_image text,
  add column if not exists phone_cover_mode text,
  add column if not exists phone_cover_offset numeric,
  add column if not exists phone_cover_offset_x numeric,
  add column if not exists phone_cover_scale numeric;

alter table public.events drop constraint if exists events_phone_cover_mode_check;
alter table public.events
  add constraint events_phone_cover_mode_check check (phone_cover_mode is null or phone_cover_mode in ('fit', 'fill'));

comment on column public.events.phone_cover_image is
  'Cover photo for phones (the app and phone browsers); null = phones show cover_image.';
comment on column public.events.phone_cover_mode is
  'Phone cover fit or fill; null = phones use the computer cover''s framing (cover_mode, cover_offset, ...).';
comment on column public.events.phone_cover_offset is
  'Phone cover focus point, up/down: percent from the middle (-50 top edge .. 50 bottom edge), as cover_offset.';
comment on column public.events.phone_cover_offset_x is
  'Phone cover focus point, left/right: percent from the middle (-50 left edge .. 50 right edge), as cover_offset_x.';
comment on column public.events.phone_cover_scale is
  'Phone cover zoom, 1 to 2.5, as cover_scale.';

create or replace function public.open_gallery(p_ref text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
           'cover_offset_x', e.cover_offset_x, 'cover_scale', e.cover_scale,
           'phone_cover_image', e.phone_cover_image, 'phone_cover_mode', e.phone_cover_mode,
           'phone_cover_offset', e.phone_cover_offset, 'phone_cover_offset_x', e.phone_cover_offset_x,
           'phone_cover_scale', e.phone_cover_scale, 'vendors', e.vendors,
           'is_sample_gallery', v_sample)
    into v_public from public.events e where e.id = v_id;
  return jsonb_build_object(
    'access', 'public_view',
    'event', v_public,
    'sub_events', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'cover_image', s.cover_image,
                                          'phone_cover_image', s.phone_cover_image, 'order', s."order",
                                          'date', s.date, 'category', s.category)
                       order by s."order" nulls last)
        from public.events s where s.parent_id = v_root.id and not coalesce(s.is_hidden, false)), '[]'::jsonb));
end $function$;

create or replace function public.get_sample_galleries()
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'title', e.title, 'date', e.date, 'description', e.description, 'type', e.type,
           'category', e.category, 'template_id', e.template_id, 'cover_image', e.cover_image,
           'cover_mode', e.cover_mode, 'cover_offset', e.cover_offset, 'cover_offset_x', e.cover_offset_x,
           'cover_scale', e.cover_scale,
           'phone_cover_image', e.phone_cover_image, 'phone_cover_mode', e.phone_cover_mode,
           'phone_cover_offset', e.phone_cover_offset, 'phone_cover_offset_x', e.phone_cover_offset_x,
           'phone_cover_scale', e.phone_cover_scale,
           'is_sample_gallery', true, 'sample_gallery_order', e.sample_gallery_order)
         order by e.sample_gallery_order nulls last, e.title), '[]'::jsonb)
    from public.events e
   where e.is_sample_gallery and (e.type = 'main' or (e.type is null and e.parent_id is null))
$function$;

notify pgrst, 'reload schema';

commit;
