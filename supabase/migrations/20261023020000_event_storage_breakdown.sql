-- Event storage by kind (2026-10-23), for the profile's Storage card: tapping "Event Storage" lists photos, videos,
-- album designs and voice notes separately. Counts exactly what vault_event_storage_bytes counts (the four parts add
-- up to it), and leaves that function untouched. Backend only (service role), like vault_event_storage_bytes.
begin;

create or replace function public.vault_event_storage_breakdown(p_identifiers text[])
returns table (photos bigint, videos bigint, album_designs bigint, voice_notes bigint)
language sql
stable
set search_path = ''
as $$
  with media as (
    select coalesce(p.size, 0) + coalesce(p.overhead_size, 0) as bytes,
           (p.media_type = 'video' or p.resource_type = 'video') as is_video
      from public.photos p
      join public.events e on e.id = p.event_id
      left join public.events root on root.id = e.parent_id
     where coalesce(root.created_by, e.created_by) = any(p_identifiers)
  )
  select
    (select coalesce(sum(bytes), 0) from media where is_video is not true)::bigint,
    (select coalesce(sum(bytes), 0) from media where is_video)::bigint,
    (select coalesce(sum(coalesce(v.bytes, 0)), 0)
       from public.album_proof_page_versions v
       join public.album_proof_pages pg on pg.id = v.page_id
       join public.album_proofs a on a.id = pg.album_id
       join public.events e on e.id = a.event_id
       left join public.events root on root.id = e.parent_id
      where coalesce(root.created_by, e.created_by) = any(p_identifiers))::bigint,
    (select coalesce(sum(coalesce(c.voice_bytes, 0)), 0)
       from public.album_proof_comments c
       join public.album_proof_pages pg on pg.id = c.page_id
       join public.album_proofs a on a.id = pg.album_id
       join public.events e on e.id = a.event_id
       left join public.events root on root.id = e.parent_id
      where coalesce(root.created_by, e.created_by) = any(p_identifiers))::bigint;
$$;

revoke all on function public.vault_event_storage_breakdown(text[]) from public, anon, authenticated;
grant execute on function public.vault_event_storage_breakdown(text[]) to service_role;

notify pgrst, 'reload schema';
commit;
