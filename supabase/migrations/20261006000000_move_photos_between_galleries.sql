-- Move photos and videos between galleries of the same event.
-- Likes, comments and Primary Gallery favourites are keyed by photo id, so they move with the photo.
-- Face rows carry their own event_id for Find You, so they are re-pointed in the same transaction.
begin;

create or replace function public.move_photos_to_gallery(p_photo_ids text[], p_target_event_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  target_row public.events%rowtype;
  root_id text;
  foreign_count integer;
  busy_count integer;
  moved_count integer;
  next_order integer;
begin
  if p_photo_ids is null or cardinality(p_photo_ids) = 0 then return 0; end if;
  if cardinality(p_photo_ids) > 2000 then raise exception 'Move at most 2000 items at a time'; end if;

  select * into target_row from public.events e where e.id::text = p_target_event_id;
  if not found then raise exception 'Target gallery not found'; end if;

  -- Sub-galleries point at their main event by id or legacy id.
  if target_row.parent_id is null then
    root_id := target_row.id::text;
  else
    select e.id::text into root_id from public.events e
    where e.parent_id is null and (e.id::text = target_row.parent_id::text or e.legacy_id::text = target_row.parent_id::text)
    limit 1;
    if root_id is null then raise exception 'Target gallery has no main event'; end if;
  end if;

  if not public.can_manage_event_visibility(root_id) then
    raise exception 'Only the event owner and event admins can move media' using errcode = '42501';
  end if;

  -- Every photo must already belong to this event (its main gallery or one of its sub-galleries).
  select count(*) into foreign_count
  from unnest(p_photo_ids) as requested(id)
  left join public.photos p on p.id::text = requested.id
  left join public.events e on e.id::text = p.event_id::text
  left join public.events root on root.id::text = root_id
  where p.id is null
     or not (
       e.id::text = root_id
       or e.parent_id::text = root_id
       or (root.legacy_id is not null and e.parent_id::text = root.legacy_id::text)
     );
  if foreign_count > 0 then
    raise exception 'Media can only be moved between galleries of the same event' using errcode = '42501';
  end if;

  -- Avoid racing the face pipeline while it is writing this photo's face rows.
  select count(*) into busy_count from public.photos p
  where p.id::text = any(p_photo_ids) and (p.face_status = 'indexing' or p.media_status = 'processing');
  if busy_count > 0 then
    raise exception 'Some media is still processing. Try again in a minute.' using errcode = '55006';
  end if;

  select coalesce(max(p."order"), -1) + 1 into next_order
  from public.photos p where p.event_id::text = target_row.id::text;

  with moving as (
    select p.id, row_number() over (order by p."order" nulls last, p.uploaded_at) - 1 as position
    from public.photos p
    where p.id::text = any(p_photo_ids) and p.event_id::text <> target_row.id::text
  )
  update public.photos p
  set event_id = target_row.id, "order" = next_order + moving.position
  from moving where p.id = moving.id;
  get diagnostics moved_count = row_count;

  update public.faces f set event_id = target_row.id
  where f.image_id::text = any(p_photo_ids) and f.event_id::text <> target_row.id::text;

  return moved_count;
end $$;

revoke all on function public.move_photos_to_gallery(text[], text) from public, anon;
grant execute on function public.move_photos_to_gallery(text[], text) to authenticated;

-- The face indexer copies event_id from its queued job payload. If a photo was moved after the job
-- was queued, that value is stale, so face rows always take the photo's current gallery instead.
create or replace function public.faces_follow_photo_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select p.event_id into new.event_id from public.photos p where p.id::text = new.image_id::text;
  return new;
end $$;

drop trigger if exists faces_follow_photo_event on public.faces;
create trigger faces_follow_photo_event
  before insert on public.faces
  for each row execute function public.faces_follow_photo_event();

notify pgrst, 'reload schema';
commit;
