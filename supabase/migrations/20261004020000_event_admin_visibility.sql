begin;
create or replace function public.can_manage_event_visibility(p_event_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  with event_scope as (
    select e.id, e.created_by from public.events e
    where e.id::text = p_event_id and e.parent_id is null
  ), caller as (
    select id, case when email_confirmed_at is not null then lower(email) end as email,
      case when phone_confirmed_at is not null then phone end as phone
    from auth.users where id = auth.uid()
  )
  select auth.uid() is not null and (
    exists(select 1 from event_scope, caller c where created_by::text = c.id::text or created_by::text = c.email)
    or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_type = 'primary' and p.delegated_by::text in (select created_by::text from event_scope))
    or exists(select 1 from public.profiles p join public.profile_assigned_events a on a.profile_id = p.id where p.id = auth.uid() and p.role_type = 'event' and a.event_id::text in (select id::text from event_scope))
    or exists(select 1 from public.guests g, caller c where g.status = 'approved' and g.can_admin = true
      and (g.event_id::text in (select id::text from event_scope) or g.parent_event_id::text in (select id::text from event_scope))
      and (g.email in (c.id::text, c.email, c.phone) or g.phone in (c.id::text, c.email, c.phone)))
  );
$$;
revoke all on function public.can_manage_event_visibility(text) from public;
grant execute on function public.can_manage_event_visibility(text) to authenticated;

create or replace function public.guard_event_public_setting()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not new.is_public then return new; end if;
    if auth.uid() is null or not exists(select 1 from auth.users u where u.id = auth.uid() and (new.created_by::text = u.id::text or (u.email_confirmed_at is not null and new.created_by::text = lower(u.email)))) then
      raise exception 'Only the event owner can create a public event' using errcode = '42501';
    end if;
  else
    if new.is_public is not distinct from old.is_public then return new; end if;
    if not public.can_manage_event_visibility(old.id::text) then
      raise exception 'Only the event owner and event admins can change public viewing' using errcode = '42501';
    end if;
  end if;
  if new.parent_id is not null then raise exception 'Sub-galleries inherit public viewing from their parent event'; end if;
  return new;
end $$;

create or replace function public.set_event_public_viewing(event_id text, public_viewing boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare event_row public.events%rowtype;
begin
  select * into event_row from public.events e where e.id::text = event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if not public.can_manage_event_visibility(event_id) then
    raise exception 'Only the event owner and event admins can change public viewing' using errcode = '42501';
  end if;
  if event_row.parent_id is not null then raise exception 'Change visibility on the parent event'; end if;
  if public_viewing is null then raise exception 'Visibility is required'; end if;
  update public.events e set is_public = public_viewing where e.id::text = event_id;
  return public_viewing;
end $$;
revoke all on function public.set_event_public_viewing(text, boolean) from public, anon;
grant execute on function public.set_event_public_viewing(text, boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
