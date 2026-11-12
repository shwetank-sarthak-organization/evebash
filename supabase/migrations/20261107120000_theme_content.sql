-- Theme content (todo #10): a theme's own content on the guest page, filled in by the host in Preview Guest Theme's
-- edit mode (todo #11). Decided 2026-11-07 (Sarthak): one JSON column with one block per kind of content, so later
-- blocks (how we met, milestones...) need no new column.
-- * events.theme_content: {"couple": {"left": {...}, "right": {...}}, ...}. Kept on the main event only; albums show
--   their main event's. The blocks and their checks are in shared/themes/themeContent.ts.
-- * set_theme_content_block(event, block, value): the only way the website and app write it. Replaces one block and
--   keeps the others (two hosts editing different blocks don't undo each other); null or empty removes the block.
--   Only the event's managers (owner, guest admins, platform admins) may call it; any gallery id of the event saves
--   on its main event.
-- * open_gallery (logged-out view of public and sample galleries) also returns theme_content. It is the live
--   definition of 2026-11-07 with only that field added.
-- Nothing existing changes: the column starts as {} for every event, so every gallery looks as it does today until a
-- host fills something in; older app builds ignore the new column.
-- Rollback:
--   drop function public.set_theme_content_block(text, text, jsonb);
--   alter table public.events drop column theme_content;
--   then re-run open_gallery below without the theme_content line.

begin;

alter table public.events add column if not exists theme_content jsonb not null default '{}'::jsonb;

alter table public.events drop constraint if exists events_theme_content_check;
alter table public.events
  add constraint events_theme_content_check
  check (jsonb_typeof(theme_content) = 'object' and octet_length(theme_content::text) <= 32768);

comment on column public.events.theme_content is
  'The theme''s own content on the guest page, one block per kind (couple, ...); main events only. Written by set_theme_content_block.';

create or replace function public.set_theme_content_block(p_event_id text, p_block text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := eb_private.resolve_event(p_event_id);
  v_root text;
  v_content jsonb;
begin
  if p_block is null or p_block !~ '^[a-z][A-Za-z]{0,31}$' then
    raise exception 'Unknown theme content block' using errcode = '22023';
  end if;
  if p_value is not null and jsonb_typeof(p_value) not in ('object', 'array') then
    raise exception 'A theme content block must be an object or a list' using errcode = '22023';
  end if;
  if v_id is null then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if not eb_private.can_manage_event(v_id) then
    raise exception 'Only the event''s managers can change its theme content' using errcode = '42501';
  end if;
  v_root := eb_private.root_event_id(v_id);

  update public.events
     set theme_content = case
           when p_value is null or p_value in ('{}'::jsonb, '[]'::jsonb) then theme_content - p_block
           else theme_content || jsonb_build_object(p_block, p_value)
         end
   where id = v_root
   returning theme_content into v_content;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
  return v_content;
end $$;

revoke all on function public.set_theme_content_block(text, text, jsonb) from public, anon;
grant execute on function public.set_theme_content_block(text, text, jsonb) to authenticated, service_role;

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
           'theme_content', e.theme_content,
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

notify pgrst, 'reload schema';

commit;
