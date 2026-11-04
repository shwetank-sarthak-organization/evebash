-- Run against a disposable migrated database (needs 20261022010000 and 20261104000000). All records are rolled back.
-- Covers: what an event counts for, that a transfer moves the whole event in one step, and who can't complete it.
begin;
-- A owns tr-root (tr-sub, and tr-legacy linked by legacy id). B is the new owner and already an approved guest.
-- C is a guest. A sub-gallery made by admin D stays in the family and moves too.
insert into public.events (id, parent_id, legacy_id, created_by, title, type) values
  ('tr-root', null, 'tr-old-root', 'user-a', 'Wedding', 'main'),
  ('tr-sub', 'tr-root', null, 'user-d', 'Baraat', 'sub'),
  ('tr-legacy', 'tr-old-root', null, 'user-a', 'Haldi', 'sub'),
  ('tr-other', null, null, 'user-a', 'Other event', 'main');
insert into public.profiles (id, name, phone) values ('user-a', 'Asha', '123') on conflict (id) do nothing;
insert into public.photos (id, event_id, size, overhead_size) values
  ('tr-p1', 'tr-root', 100, 10), ('tr-p2', 'tr-sub', 200, 0), ('tr-p3', 'tr-legacy', 300, 30), ('tr-p4', 'tr-other', 999, 0);
insert into public.guests (id, event_id, status, can_admin, user_id, parent_event_owner_id) values
  ('tr-g-b', 'tr-root', 'approved', false, 'user-b', 'user-a'),
  ('tr-g-c', 'tr-root', 'approved', false, 'user-c', 'user-a');

do $$
declare
  v_ok uuid;
  v_wrong uuid;
  v_expired uuid;
  v_size bigint := public.event_transfer_size_bytes('tr-root');
  r record;
begin
  -- The whole event, sub-galleries and legacy-linked ones included, and nothing from the owner's other events
  if v_size <> 640 then raise exception 'Expected 640 bytes, got %', v_size; end if;

  insert into public.event_transfers (event_id, from_user_id, requested_by, to_user_id, expires_at)
    values ('tr-other', 'user-a', 'user-a', 'user-b', now() - interval '1 minute') returning id into v_expired;
  begin
    perform public.complete_event_transfer(v_expired, 'user-b');
    raise exception 'An old request completed';
  exception when others then
    if sqlerrm not like '%expired%' then raise; end if;
  end;

  insert into public.event_transfers (event_id, from_user_id, requested_by, to_user_id)
    values ('tr-root', 'user-a', 'user-a', 'user-b') returning id into v_ok;

  -- Only one open request per event
  begin
    insert into public.event_transfers (event_id, from_user_id, requested_by, to_user_id)
      values ('tr-root', 'user-a', 'user-a', 'user-c') returning id into v_wrong;
    raise exception 'A second open request was allowed';
  exception when unique_violation then null;
  end;

  -- Someone else can't take it
  begin
    perform public.complete_event_transfer(v_ok, 'user-c');
    raise exception 'The wrong person completed a transfer';
  exception when others then
    if sqlerrm not like '%someone else%' then raise; end if;
  end;

  perform public.complete_event_transfer(v_ok, 'user-b');

  -- Every gallery of the event moved, and the owner's other event didn't
  for r in select id, created_by from public.events where id in ('tr-root', 'tr-sub', 'tr-legacy') loop
    if r.created_by <> 'user-b' then raise exception '% still belongs to %', r.id, r.created_by; end if;
  end loop;
  if (select created_by from public.events where id = 'tr-other') <> 'user-a' then raise exception 'Another event moved'; end if;

  -- The new owner is no longer a guest; other guests stay, pointing at the new owner
  if exists (select 1 from public.guests where user_id = 'user-b' and event_id = 'tr-root') then raise exception 'New owner still a guest'; end if;
  if (select parent_event_owner_id from public.guests where id = 'tr-g-c') <> 'user-b' then raise exception 'Guest row kept the old owner'; end if;

  -- The old owner stays as an approved admin
  if not exists (select 1 from public.guests where user_id = 'user-a' and event_id = 'tr-root'
                   and status = 'approved' and can_admin and can_upload and can_comment) then
    raise exception 'Old owner was not kept as an admin';
  end if;

  if (select status from public.event_transfers where id = v_ok) <> 'accepted' then raise exception 'Transfer not marked accepted'; end if;

  -- Can't be completed twice
  begin
    perform public.complete_event_transfer(v_ok, 'user-b');
    raise exception 'A transfer completed twice';
  exception when others then
    if sqlerrm not like '%no longer open%' then raise; end if;
  end;

  -- Clients can't touch it: no anon/authenticated access to the table or the functions
  if has_table_privilege('authenticated', 'public.event_transfers', 'select') then raise exception 'Clients can read transfers'; end if;
  if has_function_privilege('authenticated', 'public.complete_event_transfer(uuid, text)', 'execute') then raise exception 'Clients can complete transfers'; end if;
end $$;
rollback;
