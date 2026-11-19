-- Reports of objectionable content and users (Google Play User Generated Content policy).
-- Logged-in users file reports only through file_content_report(); there is no direct client access.
-- The backend (service role) lists and reviews them for the analytics dashboard's Reports tab.
-- Rollback: drop function public.file_content_report(text, text, text, text, text); drop table public.content_reports;
begin;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  -- Kept when the reporter deletes their account, so the report and any action taken stay on record
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('media', 'comment', 'chat_message', 'business', 'user')),
  target_id text not null,
  event_id text,
  reported_user_id text,
  -- Comment / message text or business / user name when reported, so the evidence survives a deletion
  target_snapshot text,
  reason text not null check (reason in (
    'sexual', 'child_safety', 'harassment', 'hate', 'violence', 'spam', 'privacy', 'other'
  )),
  note text check (note is null or length(note) <= 1000),
  platform text check (platform is null or platform in ('web', 'android', 'ios')),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  admin_note text check (admin_note is null or length(admin_note) <= 2000),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One open report per reporter and item; reporting again after a review files a new one
create unique index if not exists content_reports_open_per_reporter
  on public.content_reports (reporter_id, target_type, target_id) where status = 'open';
create index if not exists content_reports_status_created on public.content_reports (status, created_at desc);
create index if not exists content_reports_target on public.content_reports (target_type, target_id);
create index if not exists content_reports_reporter_created on public.content_reports (reporter_id, created_at desc);

alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
grant all on public.content_reports to service_role;

create or replace function public.file_content_report(
  p_target_type text, p_target_id text, p_reason text, p_note text default null, p_platform text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_target_id text := trim(coalesce(p_target_id, ''));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_event_id text;
  v_user_id text;
  v_snapshot text;
  v_found boolean := false;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Please log in to report content'; end if;
  if p_target_type is null or p_target_type not in ('media', 'comment', 'chat_message', 'business', 'user') then
    raise exception 'Invalid report type';
  end if;
  if v_target_id = '' or length(v_target_id) > 200 then raise exception 'Invalid item'; end if;
  if p_reason is null or p_reason not in ('sexual', 'child_safety', 'harassment', 'hate', 'violence', 'spam', 'privacy', 'other') then
    raise exception 'Choose a reason for the report';
  end if;
  if v_note is not null and length(v_note) > 1000 then raise exception 'Keep the note under 1000 characters'; end if;
  if p_platform is not null and p_platform not in ('web', 'android', 'ios') then raise exception 'Invalid platform'; end if;

  if p_target_type = 'media' then
    select true, p.event_id, p.user_id into v_found, v_event_id, v_user_id
    from public.photos p where p.id::text = v_target_id;
  elsif p_target_type = 'comment' then
    select true, p.event_id, c.user_id, left(c.text, 2000) into v_found, v_event_id, v_user_id, v_snapshot
    from public.comments c left join public.photos p on p.id::text = c.photo_id::text
    where c.id::text = v_target_id;
  elsif p_target_type = 'chat_message' then
    -- Only the two people in the chat can report its messages
    select true, m.sender_id, left(m.text, 2000) into v_found, v_user_id, v_snapshot
    from public.messages m join public.chat_rooms r on r.id::text = m.room_id::text
    where m.id::text = v_target_id
      and (r.client_uid = v_uid::text or r.vendor_uid = v_uid::text);
  elsif p_target_type = 'business' then
    select true, b.created_by, left(b.name, 200) into v_found, v_user_id, v_snapshot
    from public.businesses b where b.id::text = v_target_id;
  else
    select true, pr.id::text, left(pr.name, 200) into v_found, v_user_id, v_snapshot
    from public.profiles pr where pr.id::text = v_target_id;
  end if;
  if not coalesce(v_found, false) then raise exception 'This item no longer exists'; end if;
  if v_user_id is not null and v_user_id = v_uid::text then raise exception 'You can''t report your own content'; end if;

  -- Rate limit: 20 reports an hour per account
  if (select count(*) from public.content_reports cr
      where cr.reporter_id = v_uid and cr.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You''ve sent a lot of reports. Please try again in an hour.';
  end if;

  insert into public.content_reports
    (reporter_id, target_type, target_id, event_id, reported_user_id, target_snapshot, reason, note, platform)
  values (v_uid, p_target_type, v_target_id, v_event_id, v_user_id, v_snapshot, p_reason, v_note, p_platform)
  on conflict (reporter_id, target_type, target_id) where status = 'open' do nothing
  returning id into v_id;

  -- Already reported and still open: keep the first report and say it's on file
  return jsonb_build_object('id', v_id, 'duplicate', v_id is null);
end;
$$;

revoke all on function public.file_content_report(text, text, text, text, text) from public, anon;
grant execute on function public.file_content_report(text, text, text, text, text) to authenticated;

-- Refresh the API schema after creating/replacing the RPCs.
notify pgrst, 'reload schema';
commit;
