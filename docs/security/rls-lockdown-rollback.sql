-- Rollback for docs/security/rls-lockdown-draft.sql. Restores the previous (open) access exactly.
-- Keeps the two added columns (guests.user_id, deleted_events_archive.event_created_at); they are harmless.

begin;

-- 7. Anonymous write grants (Supabase defaults)
grant insert, update, delete, truncate on all tables in schema public to anon;

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

-- 3. Functions and view
drop function if exists public.open_gallery(text);
drop function if exists public.get_public_gallery_media(text, int, int);
drop function if exists public.request_gallery_access(text);
drop function if exists public.archive_deleted_event(text, int, int, bigint, text, timestamptz);
drop function if exists public.is_phone_allowed(text);
drop function if exists public.can_manage_event_visibility(text);
-- Restore the original owner-only version that was live before the lockdown
create or replace function public.set_event_public_viewing(event_id text, public_viewing boolean)
returns boolean language plpgsql security definer set search_path to 'public', 'pg_temp' as $f$
declare event_row public.events%rowtype;
begin
  select * into event_row from public.events where id = event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if auth.uid() is null or not (coalesce(event_row.created_by = auth.uid()::text, false) or coalesce(event_row.created_by = auth.jwt()->>'email', false)) then
    raise exception 'Only the event creator can change public viewing' using errcode = '42501';
  end if;
  if event_row.parent_id is not null then raise exception 'Change visibility on the parent event'; end if;
  if public_viewing is null then raise exception 'Visibility is required'; end if;
  update public.events set is_public = public_viewing where id = event_id;
  return public_viewing;
end $f$;
drop view if exists public.profile_cards;

-- 1. Helpers
drop schema if exists eb_private cascade;

commit;
