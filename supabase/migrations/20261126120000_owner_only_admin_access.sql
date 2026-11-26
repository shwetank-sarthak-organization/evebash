-- Issue #329: only the event owner gives or takes away Admin Access, and changes or removes an admin.
-- Guest admins could switch off their own Admin (website) or another admin's, and remove admins, because the
-- guests update/delete policies let anyone who manages the event change any row. "Owner" here also covers the
-- owner's delegated account manager (profiles.role_type 'primary' delegated by the owner) and platform admins.
-- The backend (service role, a trusted session) checks the same rule itself in apps/backend/src/routes/permissions.ts.

create or replace function eb_private.can_manage_event_admins(p_event_id text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select eb_private.is_event_owner(p_event_id)
      or eb_private.is_platform_admin()
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()::text
          and p.role_type = 'primary'
          and p.delegated_by is not null
          and p.delegated_by in (
            eb_private.event_creator(eb_private.root_event_id(p_event_id)),
            (select o.email from public.profiles o where o.id = eb_private.event_creator(eb_private.root_event_id(p_event_id)))
          )
      )
$$;

-- For the website and app: whether the person signed in may change Admin Access on this event
create or replace function public.can_manage_event_admins(p_event_id text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select eb_private.can_manage_event_admins(p_event_id)
$$;

revoke all on function public.can_manage_event_admins(text) from public;
grant execute on function public.can_manage_event_admins(text) to authenticated;

create or replace function eb_private.guest_admin_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if eb_private.is_trusted_session() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if coalesce(old.can_admin, false) and not eb_private.can_manage_event_admins(old.event_id) then
      raise exception 'Only the event owner can remove an admin' using errcode = '42501';
    end if;
    return old;
  end if;

  if (
       new.can_admin is distinct from old.can_admin
       or (coalesce(old.can_admin, false) and (
             new.status is distinct from old.status
          or new.can_upload is distinct from old.can_upload
          or new.can_comment is distinct from old.can_comment
       ))
     )
     and not eb_private.can_manage_event_admins(old.event_id) then
    raise exception 'Only the event owner can change Admin Access' using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists guests_admin_guard on public.guests;
create trigger guests_admin_guard
  before update or delete on public.guests
  for each row execute function eb_private.guest_admin_guard();
