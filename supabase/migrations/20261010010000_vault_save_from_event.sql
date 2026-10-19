-- "Save to EB Vault" from an event: the backend (service role) copies event originals into the user's Vault.
-- The backend has no auth.uid(), so it needs a manager check that takes the user explicitly. This mirrors
-- eb_private.can_manage_event (RLS part 1): platform admins, the event owner (id or email), and approved
-- guest admins. It also resolves sub-galleries linked by legacy parent id. Keep the two in sync.
begin;

create or replace function public.vault_user_can_manage_event(p_user_id text, p_email text, p_event_id text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_root text;
  v_owner text;
begin
  if p_user_id is null or p_event_id is null then return false; end if;

  if exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin' and p.delegated_by is null) then
    return true;
  end if;

  select coalesce(
    (select r.id from public.events e
       join public.events r on r.parent_id is null and (r.id = e.parent_id or r.legacy_id = e.parent_id)
     where e.id = p_event_id and e.parent_id is not null
     limit 1),
    (select e.id from public.events e where e.id = p_event_id and e.parent_id is null)
  ) into v_root;
  if v_root is null then return false; end if;

  select r.created_by into v_owner from public.events r where r.id = v_root;
  if v_owner = p_user_id or (p_email is not null and v_owner = p_email) then return true; end if;

  return exists (
    select 1 from public.guests g
    where g.user_id = p_user_id and g.status = 'approved' and coalesce(g.can_admin, false)
      and g.event_id in (p_event_id, v_root)
  );
end $$;

revoke all on function public.vault_user_can_manage_event(text, text, text) from public, anon, authenticated;
grant execute on function public.vault_user_can_manage_event(text, text, text) to service_role;

notify pgrst, 'reload schema';
commit;
