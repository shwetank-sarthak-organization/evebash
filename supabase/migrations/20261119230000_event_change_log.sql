-- Todo #27: event change log. Who changed what in an event or sub-gallery, when, and from where; shown in the
-- analytics dashboard (gallery Change log and the Change log tab). Decided 2026-11-19 (Sarthak): Phase 1.
--
-- * public.event_change_log: one row per changed field, plus one row when an event is created or deleted. Rows
--   keep the event id as plain text (no foreign key), so the log outlives a deleted gallery. Values are cut to 500
--   characters. Kept for good for now. Readable by the service role only (the backend serves the dashboard, the
--   same way as content_reports); nobody can write to it except the trigger.
-- * Logged: title, date, description, cover_image, phone_cover_image, template_id (theme), type, category, join_id,
--   is_public, is_hidden, is_sample_gallery, gallery_video_id, created_by, parent_id, vendors, and theme_content one
--   row per block ("theme_content.couple"). Not logged (noisy or automatic): order, sample_gallery_order, cover and
--   phone cover offsets, scale and mode, legacy_id, guest_preview_picture.
-- * Who: the logged-in user (auth.uid()). Backend writes use the service key, so the backend sends the person's id in
--   an x-eb-actor header; it is only trusted from the service role. The role (owner, guest admin, platform admin) is
--   worked out the way can_manage_event does it.
-- * From where: website or app, from the x-client-info header supabase-js already sends ("supabase-js-web/..." or
--   "supabase-js-react-native/..."); backend for the service role; database for SQL editor, migrations and cron.
--   The header and Origin come from the caller, so source is a hint, not proof. The user and role are not.
-- * Nothing existing changes: the triggers only add rows to the new table, and any error while logging is turned
--   into a warning so an event save never fails because of the log.
--
-- Switch off without dropping anything:
--   alter table public.events disable trigger eb_event_change_log_update;
--   alter table public.events disable trigger eb_event_change_log_insert_delete;
-- Rollback:
--   drop trigger if exists eb_event_change_log_update on public.events;
--   drop trigger if exists eb_event_change_log_insert_delete on public.events;
--   drop function if exists eb_private.log_event_change();
--   drop table if exists public.event_change_log;

begin;

create table if not exists public.event_change_log (
  id bigint generated always as identity primary key,
  event_id text not null,
  -- The main event, so a gallery's log also lists its sub-galleries' changes
  root_event_id text not null,
  -- Title when the change was made, so deleted galleries still have a name
  event_title text,
  action text not null check (action in ('created', 'updated', 'deleted')),
  field text,
  old_value text,
  new_value text,
  actor_id text,
  actor_email text,
  actor_role text not null
    check (actor_role in ('owner', 'guest_admin', 'platform_admin', 'other_user', 'backend', 'database')),
  source text not null check (source in ('website', 'app', 'backend', 'database', 'other')),
  -- x-client-info and Origin host as sent, to tell the website from the dashboard or a script
  client text,
  origin text,
  created_at timestamptz not null default now()
);
-- The dashboard pages by id (newest first): one change writes several rows with the same created_at
create index if not exists event_change_log_root_id on public.event_change_log (root_event_id, id desc);
create index if not exists event_change_log_actor_id
  on public.event_change_log (actor_id, id desc) where actor_id is not null;

alter table public.event_change_log enable row level security;
revoke all on public.event_change_log from public, anon, authenticated, service_role;
grant select on public.event_change_log to service_role;

comment on table public.event_change_log is
  'Todo #27: who changed what in an event and when. Written only by eb_private.log_event_change(); read by the backend for the analytics dashboard.';

create or replace function eb_private.log_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields constant text[] := array[
    'title', 'date', 'description', 'cover_image', 'phone_cover_image', 'template_id', 'type', 'category', 'join_id',
    'is_public', 'is_hidden', 'is_sample_gallery', 'gallery_video_id', 'created_by', 'parent_id', 'vendors'
  ];
  v_old jsonb;
  v_new jsonb;
  v_cur jsonb;
  v_claims text := current_setting('request.jwt.claims', true);
  v_headers jsonb;
  v_client text;
  v_origin text;
  v_actor text;
  v_email text;
  v_role text;
  v_source text;
  v_id text;
  v_parent text;
  v_root text;
  v_owner text;
begin
  begin
    if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
    if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
    -- Rights are judged on the row as it was (a transfer changes created_by)
    v_cur := coalesce(v_old, v_new);
    v_id := v_cur ->> 'id';
    v_parent := nullif(v_cur ->> 'parent_id', '');
    v_root := coalesce(v_parent, v_id);

    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
    v_client := nullif(left(v_headers ->> 'x-client-info', 100), '');
    v_origin := nullif(left(regexp_replace(coalesce(v_headers ->> 'origin', ''), '^https?://', ''), 100), '');

    if v_claims is null or v_claims = '' then
      v_role := 'database';
      v_source := 'database';
    elsif coalesce(auth.role(), '') = 'service_role' then
      v_source := 'backend';
      v_actor := nullif(left(v_headers ->> 'x-eb-actor', 100), '');
      if v_actor is null then v_role := 'backend'; end if;
    else
      v_actor := auth.uid()::text;
      v_email := auth.jwt() ->> 'email';
      v_source := case
        when v_client like 'supabase-js-web/%' then 'website'
        when v_client like 'supabase-js-react-native/%' then 'app'
        else 'other'
      end;
    end if;

    if v_role is null then
      if v_parent is null then
        v_owner := v_cur ->> 'created_by';
      else
        select e.created_by into v_owner from public.events e where e.id = v_parent;
      end if;
      v_role := case
        when v_actor is null then 'other_user'
        when v_owner is not null and (v_owner = v_actor or v_owner = v_email) then 'owner'
        when exists (
          select 1 from public.profiles p where p.id = v_actor and p.role = 'admin' and p.delegated_by is null
        ) then 'platform_admin'
        when exists (
          select 1 from public.guests g
           where g.user_id = v_actor and g.status = 'approved' and coalesce(g.can_admin, false)
             and g.event_id in (v_id, v_root)
        ) then 'guest_admin'
        else 'other_user'
      end;
    end if;

    if tg_op = 'UPDATE' then
      insert into public.event_change_log
        (event_id, root_event_id, event_title, action, field, old_value, new_value,
         actor_id, actor_email, actor_role, source, client, origin)
      select v_id, v_root, left(v_new ->> 'title', 200), 'updated', f.field, left(f.old_value, 500), left(f.new_value, 500),
             v_actor, v_email, v_role, v_source, v_client, v_origin
        from (
          select x as field, v_old ->> x as old_value, v_new ->> x as new_value
            from unnest(v_fields) as x
           where (v_old -> x) is distinct from (v_new -> x)
          union all
          -- One row per theme content block (couple, ...), not the whole JSON
          select 'theme_content.' || k, v_old -> 'theme_content' ->> k, v_new -> 'theme_content' ->> k
            from jsonb_object_keys(
                   coalesce(v_old -> 'theme_content', '{}'::jsonb) || coalesce(v_new -> 'theme_content', '{}'::jsonb)
                 ) as k
           where (v_old -> 'theme_content' -> k) is distinct from (v_new -> 'theme_content' -> k)
        ) f;
    else
      insert into public.event_change_log
        (event_id, root_event_id, event_title, action, actor_id, actor_email, actor_role, source, client, origin)
      values
        (v_id, v_root, left(v_cur ->> 'title', 200), case tg_op when 'INSERT' then 'created' else 'deleted' end,
         v_actor, v_email, v_role, v_source, v_client, v_origin);
    end if;
  exception when others then
    -- The log must never stop a gallery from saving
    raise warning 'event_change_log: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;

revoke all on function eb_private.log_event_change() from public, anon, authenticated;

drop trigger if exists eb_event_change_log_update on public.events;
create trigger eb_event_change_log_update
  after update on public.events
  for each row
  -- Same list as v_fields plus theme_content, so reorders and cover drags don't even call the function
  when ((old.title, old.date, old.description, old.cover_image, old.phone_cover_image, old.template_id, old.type,
         old.category, old.join_id, old.is_public, old.is_hidden, old.is_sample_gallery, old.gallery_video_id,
         old.created_by, old.parent_id, old.vendors, old.theme_content)
        is distinct from
        (new.title, new.date, new.description, new.cover_image, new.phone_cover_image, new.template_id, new.type,
         new.category, new.join_id, new.is_public, new.is_hidden, new.is_sample_gallery, new.gallery_video_id,
         new.created_by, new.parent_id, new.vendors, new.theme_content))
  execute function eb_private.log_event_change();

drop trigger if exists eb_event_change_log_insert_delete on public.events;
create trigger eb_event_change_log_insert_delete
  after insert or delete on public.events
  for each row
  execute function eb_private.log_event_change();

notify pgrst, 'reload schema';
commit;
