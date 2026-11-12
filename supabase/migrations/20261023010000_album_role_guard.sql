-- Album roles need Admin Access (2026-10-23). Someone who is an album's photographer or client must stay an
-- approved admin of the event: turning off their Admin Access, rejecting them or removing them is refused until
-- the album's roles are changed. Checked in the database so every path is covered (the website goes through the
-- backend, the app updates guests directly). Deleting the event itself is still allowed.
-- The error has SQLSTATE EBA01 and a message the apps show as it is.
begin;

create or replace function eb_private.guest_album_role_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_roles text;
begin
  -- Only an approved admin with an account can hold a role
  if old.user_id is null or old.status is distinct from 'approved' or not coalesce(old.can_admin, false) then
    return coalesce(new, old);
  end if;
  -- Still an approved admin after this change: nothing to check
  if tg_op = 'UPDATE' and new.status = 'approved' and coalesce(new.can_admin, false)
     and new.user_id is not distinct from old.user_id then
    return new;
  end if;
  -- The event is being deleted (guests go with it)
  if not exists (select 1 from public.events e where e.id = old.event_id) then
    return coalesce(new, old);
  end if;

  select string_agg(
           case when a.photographer_id = old.user_id then 'the photographer' else 'a client' end || ' in "' || a.title || '"',
           ', ' order by a.title)
    into v_roles
    from public.album_proofs a
   where a.event_id in (old.event_id, coalesce(old.parent_event_id, ''), coalesce(eb_private.root_event_id(old.event_id), ''))
     and (a.photographer_id = old.user_id or old.user_id = any(a.client_ids));

  if v_roles is null then return coalesce(new, old); end if;
  raise exception using
    errcode = 'EBA01',
    message = 'This person is ' || v_roles || '. Change the album''s roles first (Album tab > the album > ... > Change roles), then try again.';
end $$;
revoke all on function eb_private.guest_album_role_guard() from public, anon, authenticated;

drop trigger if exists guests_album_role_guard on public.guests;
create trigger guests_album_role_guard before update or delete on public.guests
  for each row execute function eb_private.guest_album_role_guard();

commit;
