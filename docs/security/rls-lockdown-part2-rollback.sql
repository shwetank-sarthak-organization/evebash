-- Rollback for PART 2 of the lockdown (sections 4-7 of docs/security/rls-lockdown-draft.sql: triggers, row level
-- security, policies, anon write grants, plus the part 2 visibility functions). One transaction, takes seconds.
--
-- Use this one after part 2. It does NOT touch part 1 or the later functions (open_gallery, get_public_gallery_media,
-- request_gallery_access, archive_deleted_event, profile_cards, is_username_available, get_media_plan_limit,
-- get_sample_galleries, eb_private.*): the live website and app need them, so galleries keep working after a rollback.
-- (rls-lockdown-rollback.sql removes everything, part 1 included, and would break the gallery pages.)
--
-- Anon write grants below are the exact list live on 2026-10-09 (every table except policy_acceptances). If tables
-- were added since (for example Vault), re-check with:
--   select table_name, string_agg(privilege_type, ',') from information_schema.table_privileges
--    where table_schema = 'public' and grantee = 'anon' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
--    group by 1 order by 1;

begin;

-- 7. Anonymous write grants as they were before part 2
grant insert, update, delete, truncate on public.allowed_users to anon;
grant insert, update, delete, truncate on public.business_ratings to anon;
grant insert, update, delete, truncate on public.businesses to anon;
grant insert, update, delete, truncate on public.chat_rooms to anon;
grant insert, update, delete, truncate on public.comments to anon;
grant insert, update, delete, truncate on public.contact_messages to anon;
grant insert, update, delete, truncate on public.deleted_events_archive to anon;
grant insert, update, delete, truncate on public.enquiries to anon;
grant insert, update, delete, truncate on public.event_favourite_photos to anon;
grant insert, update, delete, truncate on public.event_notifications_outbox to anon;
grant insert, update, delete, truncate on public.events to anon;
grant insert, update, delete, truncate on public.faces to anon;
grant insert, update, delete, truncate on public.guests to anon;
grant insert, update, delete, truncate on public.infra_invoices to anon;
grant insert, update, delete, truncate on public.likes to anon;
grant insert, update, delete, truncate on public.messages to anon;
grant insert, update, delete, truncate on public.modal_cost_logs to anon;
grant insert, update, delete, truncate on public.payments to anon;
grant insert, update, delete, truncate on public.pending_requests to anon;
grant insert, update, delete, truncate on public.photos to anon;
grant insert, update, delete, truncate on public.pricing_plans to anon;
grant insert, update, delete, truncate on public.processing_outbox to anon;
grant insert, update, delete, truncate on public.profile_assigned_events to anon;
grant insert, update, delete, truncate on public.profiles to anon;
grant insert, update, delete, truncate on public.upload_intents to anon;
grant insert, update, delete, truncate on public.vendor_leads to anon;

-- 6 + 5. New policies
drop policy if exists events_select on public.events;
drop policy if exists events_insert on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;
drop policy if exists photos_select on public.photos;
drop policy if exists photos_insert on public.photos;
drop policy if exists photos_update on public.photos;
drop policy if exists photos_delete on public.photos;
drop policy if exists guests_select on public.guests;
drop policy if exists guests_update on public.guests;
drop policy if exists guests_delete on public.guests;
drop policy if exists likes_select on public.likes;
drop policy if exists likes_insert on public.likes;
drop policy if exists likes_delete on public.likes;
drop policy if exists comments_select on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_delete on public.comments;
drop policy if exists favourites_select on public.event_favourite_photos;
drop policy if exists favourites_insert on public.event_favourite_photos;
drop policy if exists favourites_delete on public.event_favourite_photos;
drop policy if exists faces_delete on public.faces;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
drop policy if exists assigned_admin on public.profile_assigned_events;
drop policy if exists allowed_users_admin on public.allowed_users;
drop policy if exists pending_requests_submit on public.pending_requests;
drop policy if exists pending_requests_admin on public.pending_requests;
drop policy if exists archive_admin on public.deleted_events_archive;
drop policy if exists cost_logs_admin on public.modal_cost_logs;
drop policy if exists infra_invoices_admin on public.infra_invoices;
drop policy if exists pricing_plans_admin on public.pricing_plans;
drop policy if exists businesses_select on public.businesses;
drop policy if exists businesses_insert on public.businesses;
drop policy if exists businesses_update on public.businesses;
drop policy if exists businesses_delete on public.businesses;
drop policy if exists ratings_select on public.business_ratings;
drop policy if exists ratings_write on public.business_ratings;
drop policy if exists enquiries_select on public.enquiries;
drop policy if exists enquiries_insert on public.enquiries;
drop policy if exists chat_rooms_participants on public.chat_rooms;
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;

-- Tables that had RLS off before
alter table public.events disable row level security;
alter table public.photos disable row level security;
alter table public.guests disable row level security;
alter table public.likes disable row level security;
alter table public.comments disable row level security;
alter table public.profiles disable row level security;
alter table public.profile_assigned_events disable row level security;
alter table public.allowed_users disable row level security;
alter table public.pending_requests disable row level security;
alter table public.businesses disable row level security;
alter table public.business_ratings disable row level security;
alter table public.enquiries disable row level security;
alter table public.chat_rooms disable row level security;
alter table public.messages disable row level security;

-- Original policies on tables that already had RLS on
create policy "Allow authenticated users to manage event favourites" on public.event_favourite_photos
  for all to authenticated using (true) with check (true);
create policy "Allow reading event favourites" on public.event_favourite_photos
  for select to anon, authenticated using (true);
create policy "Allow reading face index" on public.faces
  for select to anon, authenticated using (true);
create policy "Users can update own profile" on public.profiles
  for update using ((auth.uid())::text = id) with check ((auth.uid())::text = id);
create policy "Allow authenticated and service role read" on public.deleted_events_archive
  for select using (true);
create policy "Allow service role full access" on public.deleted_events_archive
  for all using (true) with check (true);
create policy "Allow anon and authenticated read" on public.modal_cost_logs
  for select to anon, authenticated using (true);
create policy "Allow service role full access" on public.modal_cost_logs
  for all using (true) with check (true);
create policy "Allow authenticated admins full access to infra_invoices" on public.infra_invoices
  for all to authenticated
  using (exists (select 1 from public.profiles where profiles.id = (auth.uid())::text and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = (auth.uid())::text and profiles.role = 'admin'));

-- 4. Triggers
drop trigger if exists eb_protect_profile_columns on public.profiles;
drop trigger if exists eb_protect_event_columns on public.events;
create trigger guard_event_public_setting before insert or update of is_public on public.events
  for each row execute function public.guard_event_public_setting();

-- Part 2 functions: the guest-admin visibility check goes; the owner-only switch that was live before comes back
drop function if exists public.can_manage_event_visibility(text);
-- Exact definition that was live before part 2 (pg_get_functiondef, 2026-10-09)
CREATE OR REPLACE FUNCTION public.set_event_public_viewing(event_id text, public_viewing boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE event_row public.events%ROWTYPE;
BEGIN
  SELECT * INTO event_row FROM public.events WHERE id = event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF auth.uid() IS NULL OR NOT (COALESCE(event_row.created_by = auth.uid()::text, false) OR COALESCE(event_row.created_by = auth.jwt()->>'email', false)) THEN
    RAISE EXCEPTION 'Only the event creator can change public viewing' USING ERRCODE = '42501';
  END IF;
  IF event_row.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Change visibility on the parent event'; END IF;
  IF public_viewing IS NULL THEN RAISE EXCEPTION 'Visibility is required'; END IF;
  UPDATE public.events SET is_public = public_viewing WHERE id = event_id;
  RETURN public_viewing;
END $function$;
revoke execute on function public.set_event_public_viewing(text, boolean) from public, anon;
grant execute on function public.set_event_public_viewing(text, boolean) to authenticated;

commit;
