-- Issue #39 (decided by Sarthak 2026-10-11): a new gallery member starts with photo uploads and comments OFF on both
-- website and app; the host turns them on per guest. Until now request_gallery_access wrote can_comment = true, the
-- app's approve turned uploads and comments on, and the website's approve left them as they were.
-- Also: a pending or rejected guest who asks again starts with the switches off (a rejected guest admin no longer
-- comes back as admin once approved again). Approved members keep what the host set.
-- Only request_gallery_access changes; create or replace keeps its grants (no anon EXECUTE).
-- Rollback: re-run the function from 20261009000000_gallery_requests_after_rejection.sql.

begin;

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
  -- New members can view and download only: uploads, comments and admin start off (the column defaults) until the
  -- host turns them on for that guest
  insert into public.guests (id, name, phone, event_id, parent_event_owner_id, event_title, status, user_id, login_at,
                             can_upload, can_comment, can_admin)
  values ('u_' || v_uid || '_' || v_root.id,
          coalesce((select p.name from public.profiles p where p.id = v_uid), 'Guest'),
          coalesce((select p.phone from public.profiles p where p.id = v_uid), ''),
          v_root.id, v_root.created_by, v_root.title,
          case when v_root.is_public then 'approved' else 'pending' end,
          v_uid, now(), false, false, false)
  -- Asking again: approved stays approved (switches kept); pending or rejected becomes pending (private) or approved
  -- (public) and starts with the switches off again, like a new member
  on conflict (id) do update
    set login_at = now(),
        status = case when public.guests.status = 'approved' then 'approved' else excluded.status end,
        can_upload = case when public.guests.status = 'approved' then public.guests.can_upload else false end,
        can_comment = case when public.guests.status = 'approved' then public.guests.can_comment else false end,
        can_admin = case when public.guests.status = 'approved' then public.guests.can_admin else false end
  returning status into v_status;
  return v_status;
end $$;

commit;
