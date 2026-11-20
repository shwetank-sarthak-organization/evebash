-- Run against a disposable migrated database. All test records are rolled back.
begin;
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b2'), ('00000000-0000-0000-0000-0000000000c3');
insert into public.profiles (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Reporter'), ('00000000-0000-0000-0000-0000000000b2', 'Uploader'),
  ('00000000-0000-0000-0000-0000000000c3', 'Outsider');
insert into public.events (id, title) values ('evt-report-test', 'Report test');
insert into public.photos (id, event_id, user_id, storage_key, url) values ('photo-report-test', 'evt-report-test', '00000000-0000-0000-0000-0000000000b2', 'events/evt-report-test/photos/report-test.jpg', 'https://media-staging.evebash.com/events/evt-report-test/photos/report-test.jpg');
insert into public.comments (id, photo_id, user_id, text)
  values ('11111111-1111-1111-1111-111111111111', 'photo-report-test', '00000000-0000-0000-0000-0000000000b2', 'mean comment');
insert into public.chat_rooms (id, client_uid, vendor_uid)
  values ('room-report-test', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2');
insert into public.messages (id, room_id, sender_id, text)
  values ('22222222-2222-2222-2222-222222222222', 'room-report-test', '00000000-0000-0000-0000-0000000000b2', 'spam link');

-- Anonymous: no function, no table
set local role anon;
do $$ begin
  begin
    perform public.file_content_report('media', 'photo-report-test', 'spam');
    raise exception 'Expected anon to be denied';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
declare result jsonb;
begin
  result := public.file_content_report('media', 'photo-report-test', 'sexual', '  looks bad  ', 'android');
  if (result->>'duplicate')::boolean then raise exception 'First report marked duplicate'; end if;
  result := public.file_content_report('media', 'photo-report-test', 'spam');
  if not (result->>'duplicate')::boolean then raise exception 'Second open report not deduplicated'; end if;
  perform public.file_content_report('comment', '11111111-1111-1111-1111-111111111111', 'harassment');
  perform public.file_content_report('chat_message', '22222222-2222-2222-2222-222222222222', 'spam', null, 'ios');
  perform public.file_content_report('user', '00000000-0000-0000-0000-0000000000b2', 'harassment');

  begin
    perform public.file_content_report('media', 'missing-photo', 'spam');
    raise exception 'Expected missing item rejection';
  exception when raise_exception then
    if sqlerrm <> 'This item no longer exists' then raise; end if;
  end;
  begin
    perform public.file_content_report('user', '00000000-0000-0000-0000-0000000000a1', 'spam');
    raise exception 'Expected self-report rejection';
  exception when raise_exception then
    if sqlerrm not like 'You can''t report your own%' then raise; end if;
  end;
  begin
    perform public.file_content_report('media', 'photo-report-test', 'boring');
    raise exception 'Expected bad reason rejection';
  exception when raise_exception then
    if sqlerrm <> 'Choose a reason for the report' then raise; end if;
  end;
  begin
    perform public.file_content_report('event', 'evt-report-test', 'spam');
    raise exception 'Expected bad type rejection';
  exception when raise_exception then
    if sqlerrm <> 'Invalid report type' then raise; end if;
  end;
  begin
    perform public.file_content_report('comment', '11111111-1111-1111-1111-111111111111', 'other', repeat('x', 1001));
    raise exception 'Expected long note rejection';
  exception when raise_exception then
    if sqlerrm not like 'Keep the note%' then raise; end if;
  end;
  -- No direct reads or writes
  begin
    perform 1 from public.content_reports;
    raise exception 'Expected direct read to be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.content_reports (target_type, target_id, reason) values ('media', 'x', 'spam');
    raise exception 'Expected direct insert to be denied';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Someone outside the chat can't report its messages
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', true);
do $$ begin
  begin
    perform public.file_content_report('chat_message', '22222222-2222-2222-2222-222222222222', 'spam');
    raise exception 'Expected outsider chat report rejection';
  exception when raise_exception then
    if sqlerrm <> 'This item no longer exists' then raise; end if;
  end;
end $$;
reset role;

-- What was stored (as the service role would see it)
do $$
declare r record;
begin
  select * into r from public.content_reports where target_type = 'media';
  if r.event_id <> 'evt-report-test' or r.reported_user_id <> '00000000-0000-0000-0000-0000000000b2'
     or r.note <> 'looks bad' or r.platform <> 'android' or r.status <> 'open' or r.reason <> 'sexual' then
    raise exception 'Media report stored wrong: %', row_to_json(r);
  end if;
  select * into r from public.content_reports where target_type = 'comment';
  if r.target_snapshot <> 'mean comment' or r.event_id <> 'evt-report-test' then raise exception 'Comment snapshot missing'; end if;
  select * into r from public.content_reports where target_type = 'chat_message';
  if r.target_snapshot <> 'spam link' or r.reported_user_id <> '00000000-0000-0000-0000-0000000000b2' then
    raise exception 'Chat snapshot missing';
  end if;
  if (select count(*) from public.content_reports) <> 4 then raise exception 'Expected 4 reports'; end if;

  -- Reporting again after a review files a new report
  update public.content_reports set status = 'dismissed' where target_type = 'media';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
do $$
declare result jsonb; i int;
begin
  result := public.file_content_report('media', 'photo-report-test', 'violence');
  if (result->>'duplicate')::boolean then raise exception 'Report after review was deduplicated'; end if;
  -- Rate limit: 20 an hour. 5 filed so far (the duplicate inserted nothing); dismiss the open user report
  -- before each new one so they aren't deduplicated
  for i in 1..15 loop
    reset role;
    update public.content_reports set status = 'dismissed' where target_type = 'user' and status = 'open';
    set local role authenticated;
    perform public.file_content_report('user', '00000000-0000-0000-0000-0000000000b2', 'spam');
  end loop;
  begin
    perform public.file_content_report('user', '00000000-0000-0000-0000-0000000000c3', 'spam');
    raise exception 'Expected rate limit';
  exception when raise_exception then
    if sqlerrm not like 'You''ve sent a lot of reports%' then raise; end if;
  end;
end $$;
reset role;

rollback;
