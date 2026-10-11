-- Issue #39 (decided by Sarthak 2026-10-11): the guest switches now do something.
-- * Comments: only managers and members whose host turned on "Allow Comments" may post; everyone who can view still
--   reads comments. eb_private.can_comment_on_photo was "anyone who can view, unless switched off"; it now needs the
--   switch ON (it's what lockdown part 2's comments policy uses). public.can_comment_on_photo lets the website and
--   app hide the comment box (logged-in users only).
-- * Uploads: open_gallery also returns can_upload / can_comment for managers (always true) and members (their
--   switches), so a member whose host allowed uploads gets an upload button. The backend checks the same switch
--   (issue #40).
-- Rollback: re-run eb_private.can_comment_on_photo from 20261007000000, open_gallery from 20261009020000, and
-- drop function public.can_comment_on_photo(text).

begin;

-- Comments: managers, and approved members whose host turned on "Allow Comments" (off for new members). Everyone who
-- can view a gallery can still read its comments.
create or replace function eb_private.can_comment_on_photo(p_photo_id text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_event text := eb_private.photo_event_id(p_photo_id); v_root text;
begin
  if auth.uid() is null or v_event is null then return false; end if;
  if eb_private.can_manage_event(v_event) then return true; end if;
  v_root := eb_private.root_event_id(v_event);
  return exists (
    select 1 from public.guests g
    where g.user_id = auth.uid()::text and g.event_id in (v_event, v_root)
      and g.status = 'approved' and coalesce(g.can_comment, false)
  );
end $$;

-- For the website and app: show the comment box only when this is true
create or replace function public.can_comment_on_photo(p_photo_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select eb_private.can_comment_on_photo(p_photo_id)
$$;
revoke all on function public.can_comment_on_photo(text) from public, anon;
grant execute on function public.can_comment_on_photo(text) to authenticated;

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
        from public.events s where s.parent_id = v_root.id), '[]'::jsonb));
end $function$;

commit;
