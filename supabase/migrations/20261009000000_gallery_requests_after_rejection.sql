-- Gallery requests after a rejection, and pending requests on galleries made public (decided 2026-10-09).
--
-- * A rejection isn't final: a rejected guest of a private gallery sees the normal "request access" screen, and
--   asking again makes the request pending. No cooldown.
-- * Opening a public gallery joins it, including for people whose earlier request was pending or rejected
--   (before, open_gallery answered "member" while the row stayed pending, which RLS would later block).
--
-- Replaces two functions from 20261007000000_rls_part1_gallery_link_functions.sql (same signatures, so their
-- grants are kept). Copied from docs/security/rls-lockdown-draft.sql; keep in sync.
-- Rollback: re-run those two functions from the part 1 migration.

begin;

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
    if v_root.is_public then
      -- Public galleries are joined on open, including by people whose earlier request was pending or rejected
      v_status := public.request_gallery_access(v_id);
      if v_status = 'approved' then return jsonb_build_object('access', 'member', 'event_id', v_id); end if;
    end if;
    -- A rejection isn't final: a rejected guest sees the same "request access" screen as someone who never asked
    if v_status = 'rejected' then v_status := null; end if;
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

commit;
