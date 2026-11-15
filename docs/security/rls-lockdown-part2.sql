-- RLS lockdown part 2 (issue #21), rebuilt 2026-11-15 from sections 4-7 of rls-lockdown-draft.sql.
-- NOT APPLIED until it passes the dry run (rls-lockdown-part2-tests.sql) on staging and Shwetank says go.
--
-- Why rebuilt: about 25 migrations landed after the draft (hidden sub-galleries/photos, gallery video, theme content,
-- album proofing, ownership transfer, guest upload/comment switches, Find You consent, EB Vault, job queues). The
-- draft's sections 1-3 hold OLD copies of open_gallery / get_public_gallery_media / the eb_private helpers, so running
-- the whole draft would undo those (for example hidden photos would show to logged-out visitors again). This file
-- therefore creates no helpers and touches no gallery function: it only uses the eb_private helpers already deployed
-- (part 1, applied 2026-10-09 and updated by later migrations).
--
-- What it does:
--   A. Adds can_manage_event_visibility (called by the host page and the app, missing today) and makes
--      set_event_public_viewing allow guest admins (same rules as the draft).
--   B. Protected columns: role/plan/delegation on profiles; owner, visibility and sample flags on events.
--   C. Row level security on the 12 open tables, and tighter rules on faces, favourites, cost logs, archive,
--      invoices, pricing plans, contact messages and vendor leads. Hidden sub-galleries and hidden photos are
--      readable only by the gallery's managers (owner, guest admins, platform admins).
--   D. Backend/Modal-only functions (job queue, face index, photo creation, cleanup) can no longer be called with the
--      public key, logged in or not. They were callable by anyone before (security definer).
--   E. The public key gets no writes anywhere, and no reads on internal queue tables.
-- The backend and Modal use the service role, which bypasses RLS and keeps every grant, so they are unaffected.
--
-- Undo: rls-lockdown-part2-rollback.sql (updated with this file). NEVER rls-lockdown-rollback.sql.

begin;

-- ════════════════════════════════════════════════════════════════════════════════
-- A. Visibility switch for the owner and guest admins
-- ════════════════════════════════════════════════════════════════════════════════
create or replace function public.can_manage_event_visibility(p_event_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event_id and e.parent_id is null)
     and eb_private.can_manage_event(p_event_id)
$$;

create or replace function public.set_event_public_viewing(event_id text, public_viewing boolean) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare event_row public.events%rowtype;
begin
  select * into event_row from public.events e where e.id = event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if event_row.parent_id is not null then raise exception 'Change visibility on the parent event'; end if;
  if not public.can_manage_event_visibility(event_id) then
    raise exception 'Only the event owner and event admins can change public viewing' using errcode = '42501';
  end if;
  if public_viewing is null then raise exception 'Visibility is required'; end if;
  update public.events e set is_public = public_viewing where e.id = event_id;
  return public_viewing;
end $$;

revoke execute on function public.can_manage_event_visibility(text) from public, anon;
revoke execute on function public.set_event_public_viewing(text, boolean) from public, anon;
grant execute on function public.can_manage_event_visibility(text) to authenticated;
grant execute on function public.set_event_public_viewing(text, boolean) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- B. Protected columns
-- ════════════════════════════════════════════════════════════════════════════════
-- Role (which is also the plan), delegation and plan dates change only through the server or a platform admin.
-- A new profile always starts as a plain user.
create or replace function eb_private.protect_profile_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if eb_private.is_trusted_session() or eb_private.is_platform_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'user'; new.role_type := null; new.delegated_by := null;
    new.subscription_duration := null; new.plan_start_date := null; new.plan_end_date := null;
    new.pending_plan_role := null; new.pending_subscription_duration := null;
    new.pending_plan_start_date := null; new.pending_plan_end_date := null;
    return new;
  end if;
  -- Keep the stored values instead of refusing the save: the website's and app's profile save (createUserProfile)
  -- sends role and role_type every time, and failing it blocked creating events (found in the 2026-11-15 staging test)
  new.role := old.role; new.role_type := old.role_type; new.delegated_by := old.delegated_by;
  new.subscription_duration := old.subscription_duration;
  new.plan_start_date := old.plan_start_date; new.plan_end_date := old.plan_end_date;
  new.pending_plan_role := old.pending_plan_role; new.pending_subscription_duration := old.pending_subscription_duration;
  new.pending_plan_start_date := old.pending_plan_start_date; new.pending_plan_end_date := old.pending_plan_end_date;
  return new;
end $$;
drop trigger if exists eb_protect_profile_columns on public.profiles;
create trigger eb_protect_profile_columns before insert or update on public.profiles
  for each row execute function eb_private.protect_profile_columns();

-- Owner can't change (ownership transfer runs on the server); owner and guest admins may change is_public; only the
-- owner may create a gallery that starts public; sub-galleries inherit visibility; the Home gallery can't be hidden;
-- sample-gallery flags only by platform admins.
create or replace function eb_private.protect_event_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if eb_private.is_trusted_session() or eb_private.is_platform_admin() then return new; end if;
  if tg_op = 'INSERT' then
    -- A sub-gallery belongs to the family's owner, whoever adds it (the website and app send the person logged in,
    -- e.g. a guest admin). The insert policy then checks that the caller manages the parent.
    if new.parent_id is not null then
      new.created_by := eb_private.event_creator(eb_private.root_event_id(new.parent_id));
    end if;
    if new.is_public and (new.created_by is distinct from auth.uid()::text) then
      raise exception 'Only the event owner can create a public event' using errcode = '42501';
    end if;
    if new.is_public and new.parent_id is not null then
      raise exception 'Sub-galleries inherit public viewing from their parent event';
    end if;
    if coalesce(new.is_sample_gallery, false) then
      raise exception 'Sample galleries are managed by EveBash admins' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'A gallery''s owner cannot be changed' using errcode = '42501';
  end if;
  if new.is_public is distinct from old.is_public then
    if new.parent_id is not null then raise exception 'Sub-galleries inherit public viewing from their parent event'; end if;
    if not public.can_manage_event_visibility(old.id) then
      raise exception 'Only the event owner and event admins can change public viewing' using errcode = '42501';
    end if;
  end if;
  if coalesce(new.is_hidden, false) and new.parent_id is null then
    raise exception 'The Home gallery can''t be hidden from guests';
  end if;
  if new.is_sample_gallery is distinct from old.is_sample_gallery or new.sample_gallery_order is distinct from old.sample_gallery_order then
    raise exception 'Sample galleries are managed by EveBash admins' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists eb_protect_event_columns on public.events;
create trigger eb_protect_event_columns before insert or update on public.events
  for each row execute function eb_private.protect_event_columns();
-- Retire the owner-only trigger from 20260925000000_add_event_public_viewing.sql: its checks are in
-- protect_event_columns above, and it would block guest admins (and the server) from changing visibility.
drop trigger if exists guard_event_public_setting on public.events;

-- ════════════════════════════════════════════════════════════════════════════════
-- C. Row level security
-- ════════════════════════════════════════════════════════════════════════════════
-- Anonymous visitors get no direct table access; they use open_gallery / get_public_gallery_media.

-- Hidden from guests (20261019000000): a hidden photo, or anything in a hidden sub-gallery, is for managers only
create or replace function eb_private.is_hidden_from_guests(p_event_id text, p_photo_hidden boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_photo_hidden, false)
      or exists (select 1 from public.events e
                  where e.id = p_event_id and e.parent_id is not null and coalesce(e.is_hidden, false))
$$;
revoke execute on function eb_private.is_hidden_from_guests(text, boolean) from public;
grant execute on function eb_private.is_hidden_from_guests(text, boolean) to anon, authenticated;

-- events
alter table public.events enable row level security;
-- The creator and the parent's members are checked on the row itself too: the website and app create events with an
-- upsert, which checks the NEW row against this policy before viewable_event_ids() can see it (2026-11-15 staging test)
create policy events_select on public.events for select to authenticated
  using ((id in (select eb_private.viewable_event_ids())
          or parent_id in (select eb_private.viewable_event_ids())
          or created_by = auth.uid()::text or created_by = (auth.jwt() ->> 'email'))
         and (not coalesce(is_hidden, false) or parent_id is null or eb_private.can_manage_event(coalesce(parent_id, id))));
-- Top-level gallery: created by the caller for themselves. Sub-gallery: only by someone who manages the parent (owner
-- or guest admin), and owned by the parent's owner like the rest of the family (2026-11-15 staging test: guest admins
-- couldn't add one, and anyone could add one to someone else's gallery).
create or replace function eb_private.event_creator(p_event_id text) returns text
language sql stable security definer set search_path = '' as $$
  select e.created_by from public.events e where e.id = p_event_id
$$;
revoke execute on function eb_private.event_creator(text) from public;
grant execute on function eb_private.event_creator(text) to authenticated;
create policy events_insert on public.events for insert to authenticated
  with check (eb_private.is_platform_admin()
              or (parent_id is null and created_by = auth.uid()::text)
              or (parent_id is not null and eb_private.can_manage_event(parent_id)
                  and created_by = eb_private.event_creator(parent_id)));
create policy events_update on public.events for update to authenticated
  using (eb_private.can_manage_event(id)) with check (eb_private.can_manage_event(id));
create policy events_delete on public.events for delete to authenticated
  using (eb_private.is_event_owner(id) or eb_private.is_platform_admin());

-- photos (uploads are written by the backend with the service role)
alter table public.photos enable row level security;
create policy photos_select on public.photos for select to authenticated
  using (event_id in (select eb_private.viewable_event_ids())
         and (case when eb_private.is_hidden_from_guests(event_id, is_hidden)
                   then eb_private.can_manage_event(event_id) else true end));
create policy photos_insert on public.photos for insert to authenticated
  with check (eb_private.can_manage_event(event_id));
create policy photos_update on public.photos for update to authenticated
  using (eb_private.can_manage_event(event_id)) with check (eb_private.can_manage_event(event_id));
create policy photos_delete on public.photos for delete to authenticated
  using (eb_private.can_manage_event(event_id));

-- guests (gallery membership and access requests; inserts only through request_gallery_access / open_gallery)
alter table public.guests enable row level security;
create policy guests_select on public.guests for select to authenticated
  using (user_id = auth.uid()::text or eb_private.can_manage_event(event_id));
create policy guests_update on public.guests for update to authenticated
  using (eb_private.can_manage_event(event_id)) with check (eb_private.can_manage_event(event_id));
create policy guests_delete on public.guests for delete to authenticated
  using (user_id = auth.uid()::text or eb_private.can_manage_event(event_id));

-- likes
alter table public.likes enable row level security;
create policy likes_select on public.likes for select to authenticated
  using (eb_private.photo_event_id(photo_id) in (select eb_private.viewable_event_ids()));
create policy likes_insert on public.likes for insert to authenticated
  with check (user_id = auth.uid()::text
              and eb_private.photo_event_id(photo_id) in (select eb_private.viewable_event_ids()));
create policy likes_delete on public.likes for delete to authenticated
  using (user_id = auth.uid()::text or eb_private.can_manage_event(eb_private.photo_event_id(photo_id)));

-- comments
alter table public.comments enable row level security;
create policy comments_select on public.comments for select to authenticated
  using (eb_private.photo_event_id(photo_id) in (select eb_private.viewable_event_ids()));
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid()::text and eb_private.can_comment_on_photo(photo_id));
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid()::text or eb_private.can_manage_event(eb_private.photo_event_id(photo_id)));

-- event_favourite_photos (host's picks): replaces "any logged-in user can change any gallery's favourites"
drop policy if exists "Allow authenticated users to manage event favourites" on public.event_favourite_photos;
drop policy if exists "Allow reading event favourites" on public.event_favourite_photos;
create policy favourites_select on public.event_favourite_photos for select to authenticated
  using (event_id in (select eb_private.viewable_event_ids()));
create policy favourites_insert on public.event_favourite_photos for insert to authenticated
  with check (eb_private.can_manage_event(event_id));
create policy favourites_delete on public.event_favourite_photos for delete to authenticated
  using (eb_private.can_manage_event(event_id));

-- faces: replaces "anyone can read every face scan". Find You runs on the backend; clients only delete.
drop policy if exists "Allow reading face index" on public.faces;
create policy faces_delete on public.faces for delete to authenticated
  using (eb_private.can_manage_event(event_id));

-- profiles (others' names and pictures come from the profile_cards view)
alter table public.profiles enable row level security;
drop policy if exists "Users can update own profile" on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid()::text or eb_private.is_platform_admin());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid()::text);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()::text or eb_private.is_platform_admin())
  with check (id = auth.uid()::text or eb_private.is_platform_admin());
create policy profiles_delete on public.profiles for delete to authenticated
  using (id = auth.uid()::text or eb_private.is_platform_admin());

-- profile_assigned_events (hidden manager feature, not used): platform admins only, for the dashboard's cleanup
alter table public.profile_assigned_events enable row level security;
create policy assigned_admin on public.profile_assigned_events for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());

-- deleted_events_archive / modal_cost_logs: platform admins (dashboard); writes by the server,
-- archive_deleted_event(), or a platform admin
drop policy if exists "Allow authenticated and service role read" on public.deleted_events_archive;
drop policy if exists "Allow service role full access" on public.deleted_events_archive;
create policy archive_admin on public.deleted_events_archive for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());
drop policy if exists "Allow anon and authenticated read" on public.modal_cost_logs;
drop policy if exists "Allow service role full access" on public.modal_cost_logs;
create policy cost_logs_admin on public.modal_cost_logs for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());

-- infra_invoices, contact_messages, vendor_leads: their admin checks let delegate admins in; platform admins only.
-- Contact and vendor forms are saved by the backend (service role).
drop policy if exists "Allow authenticated admins full access to infra_invoices" on public.infra_invoices;
create policy infra_invoices_admin on public.infra_invoices for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());
drop policy if exists "Admins can view contact messages" on public.contact_messages;
drop policy if exists "Admins can update contact messages" on public.contact_messages;
create policy contact_messages_admin on public.contact_messages for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());
drop policy if exists "Admins can view vendor leads" on public.vendor_leads;
drop policy if exists "Admins can update vendor leads" on public.vendor_leads;
create policy vendor_leads_admin on public.vendor_leads for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());

-- payments: "service role full access" was granted to every role (it relies on a check inside); service role
-- bypasses RLS anyway, so drop it. Users keep reading their own payments; platform admins read all (dashboard).
drop policy if exists "Allow service role full access to payments" on public.payments;
drop policy if exists "Users can view their own payments" on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (user_id = auth.uid()::text or eb_private.is_platform_admin());

-- pricing_plans: public read stays; dashboard writes need a platform admin
create policy pricing_plans_admin on public.pricing_plans for all to authenticated
  using (eb_private.is_platform_admin()) with check (eb_private.is_platform_admin());

-- Phase 2 business features (vendor listings, ratings, enquiries, client-vendor chat): logged-in users only for now.
alter table public.businesses enable row level security;
create policy businesses_select on public.businesses for select to authenticated using (true);
create policy businesses_insert on public.businesses for insert to authenticated
  with check (created_by = auth.uid()::text);
create policy businesses_update on public.businesses for update to authenticated
  using (created_by = auth.uid()::text or eb_private.is_platform_admin())
  with check (created_by = auth.uid()::text or eb_private.is_platform_admin());
-- (the app's view counter edits other people's businesses and fails silently; move it to a function in Phase 2)
create policy businesses_delete on public.businesses for delete to authenticated
  using (created_by = auth.uid()::text or eb_private.is_platform_admin());

alter table public.business_ratings enable row level security;
create policy ratings_select on public.business_ratings for select to authenticated using (true);
create policy ratings_write on public.business_ratings for all to authenticated
  using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

alter table public.enquiries enable row level security;
create policy enquiries_select on public.enquiries for select to authenticated
  using (user_id = auth.uid()::text or vendor_owner_id = auth.uid()::text or eb_private.is_platform_admin());
create policy enquiries_insert on public.enquiries for insert to authenticated
  with check (user_id = auth.uid()::text);

alter table public.chat_rooms enable row level security;
create policy chat_rooms_participants on public.chat_rooms for all to authenticated
  using (client_uid = auth.uid()::text or vendor_uid = auth.uid()::text)
  with check (client_uid = auth.uid()::text or vendor_uid = auth.uid()::text);

alter table public.messages enable row level security;
create policy messages_select on public.messages for select to authenticated
  using (exists (select 1 from public.chat_rooms r where r.id = room_id
                 and (r.client_uid = auth.uid()::text or r.vendor_uid = auth.uid()::text)));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid()::text and exists (
    select 1 from public.chat_rooms r where r.id = room_id
       and (r.client_uid = auth.uid()::text or r.vendor_uid = auth.uid()::text)));

-- ════════════════════════════════════════════════════════════════════════════════
-- D. Backend and Modal functions: service role only
-- ════════════════════════════════════════════════════════════════════════════════
-- Security definer functions run past RLS, and Postgres/Supabase grant EXECUTE on new functions to everyone, so each
-- of these could be called with only the public key (claim or finish jobs, create photo rows, rewrite face scans).
-- The trigger functions don't need EXECUTE to fire.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('claim_face_job', 'claim_media_job', 'claim_outbox_batch', 'complete_media_job',
                         'create_photo_with_media_job', 'replace_photo_faces', 'cleanup_stale_upload_intents',
                         'faces_follow_photo_event', 'guard_event_public_setting')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════════
-- E. Public key: no writes anywhere; no access to internal queue tables
-- ════════════════════════════════════════════════════════════════════════════════
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke all on public.processing_outbox, public.upload_intents, public.event_notifications_outbox
  from anon, authenticated;

commit;
