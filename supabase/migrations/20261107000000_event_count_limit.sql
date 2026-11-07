-- Plan event limit in the database (2026-11-07, issue #6). The website and app check how many events a plan allows
-- before creating one, but nothing stopped a direct database call. Now a new top-level event made from a website or
-- app session fails when its creator already has as many as their plan's pricing_plans.events.
-- * Same rules as the apps: top-level events only (sub-galleries are free), counted by the creator's id, email or
--   phone; platform admins and delegated accounts have no limit; the plan comes from profiles.role (unknown roles use
--   the free plan's limit). An expired paid plan keeps its limit, as in the apps.
-- * Existing events are never touched: accounts already at or over their limit keep everything, they just can't add
--   more. Saving an existing event (the apps save with upsert) and ownership transfers (an update) aren't checked.
-- * Only website and app sessions (anon, authenticated) are checked. The backend (service role) and the SQL Editor
--   aren't, so support can still create events for people.
-- Error: SQLSTATE EBA02, with a message the website shows as it is.
-- Rollback: drop trigger if exists eb_event_count_limit on public.events; drop function eb_private.enforce_event_count_limit().
begin;

create or replace function eb_private.enforce_event_count_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller text := auth.uid()::text;
  v_profile record;
  v_limit integer;
  v_count integer;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  if new.parent_id is not null then return new; end if;
  -- An upsert of an event that already exists is a save, not a new event
  if exists (select 1 from public.events e where e.id = new.id) then return new; end if;

  if v_caller is null then
    raise exception 'Please log in to create an event.' using errcode = 'EBA02';
  end if;

  select p.id, p.email, p.phone, p.role, p.delegated_by into v_profile from public.profiles p where p.id = v_caller;
  if found and (v_profile.role = 'admin' or v_profile.delegated_by is not null) then return new; end if;

  -- One check at a time per person, so two quick creates can't both get the last slot
  perform pg_advisory_xact_lock(hashtextextended('eb_event_count_limit:' || v_caller, 0));

  select coalesce(
           (select pp.events from public.pricing_plans pp where pp.id = v_profile.role),
           (select pp.events from public.pricing_plans pp where pp.id = 'free'),
           1)
    into v_limit;

  select count(*) into v_count
    from public.events e
   where e.parent_id is null
     and e.created_by in (v_caller, coalesce(v_profile.email, v_caller), coalesce(v_profile.phone, v_caller));

  if v_count >= v_limit then
    raise exception 'Your plan allows % %, and you have %. Upgrade your plan to create more.',
      v_limit, case when v_limit = 1 then 'event' else 'events' end, v_count
      using errcode = 'EBA02';
  end if;
  return new;
end $$;

revoke all on function eb_private.enforce_event_count_limit() from public, anon, authenticated;

drop trigger if exists eb_event_count_limit on public.events;
create trigger eb_event_count_limit before insert on public.events
  for each row execute function eb_private.enforce_event_count_limit();

commit;
