-- Storage per event (2026-11-05, todo #25), for the profile's Storage card: lists each top-level event with what it
-- counts, sub-galleries included. Counts exactly what vault_event_storage_bytes counts (the rows add up to it, and
-- that function stays untouched). Events with nothing in them are listed at 0. Backend only (service role).
-- Rollback: drop function public.vault_event_storage_by_event(text[]).
begin;

create or replace function public.vault_event_storage_by_event(p_identifiers text[])
returns table (event_id text, title text, bytes bigint)
language sql
stable
set search_path = ''
as $$
  with galleries as (
    -- The same rule as vault_event_storage_bytes decides which galleries count. A sub-gallery still linked by its
    -- parent's legacy id is listed under that parent.
    select e.id as gallery_id,
           coalesce(root.id, (select l.id from public.events l where l.legacy_id = e.parent_id limit 1), e.id) as event_id
      from public.events e
      left join public.events root on root.id = e.parent_id
     where coalesce(root.created_by, e.created_by) = any(p_identifiers)
  ),
  sizes as (
    select p.event_id as gallery_id, coalesce(p.size, 0) + coalesce(p.overhead_size, 0) as bytes
      from public.photos p
     where p.event_id in (select gallery_id from galleries)
    union all
    select a.event_id, coalesce(v.bytes, 0)
      from public.album_proof_page_versions v
      join public.album_proof_pages pg on pg.id = v.page_id
      join public.album_proofs a on a.id = pg.album_id
     where a.event_id in (select gallery_id from galleries)
    union all
    select a.event_id, coalesce(c.voice_bytes, 0)
      from public.album_proof_comments c
      join public.album_proof_pages pg on pg.id = c.page_id
      join public.album_proofs a on a.id = pg.album_id
     where a.event_id in (select gallery_id from galleries)
  )
  select g.event_id, top.title, coalesce(sum(s.bytes), 0)::bigint
    from galleries g
    join public.events top on top.id = g.event_id
    left join sizes s on s.gallery_id = g.gallery_id
   group by g.event_id, top.title
   order by 3 desc, top.title;
$$;

revoke all on function public.vault_event_storage_by_event(text[]) from public, anon, authenticated;
grant execute on function public.vault_event_storage_by_event(text[]) to service_role;

notify pgrst, 'reload schema';
commit;
