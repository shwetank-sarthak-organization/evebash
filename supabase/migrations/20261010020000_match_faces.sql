-- Find You: compare the selfie inside the database and return only the matching photos.
-- Modal used to download every face descriptor of the searched galleries (about 18 MB and 6.5 s for 1,751
-- faces) and compare them in Python. This does the same cosine-similarity check (the descriptors are
-- L2-normalised, so the inner product is the cosine similarity) with pgvector, casting the existing
-- float8[] column on the fly: no new column, backfill or change to how faces are saved.
-- Returns {"compared": <faces checked>, "matches": [{image_id, image_url, width, height, sim}, ...]},
-- one entry per photo (its best face), best match first.
-- Only the service role (Modal) may call it: with the anon or user key it would let anyone search any gallery.

create or replace function public.match_faces(p_event_ids text[], p_embedding float8[], p_threshold float8 default 0.40)
returns jsonb
language sql stable
set search_path = ''
as $$
  with probe as (
    select p_embedding::public.vector(512) as v
  ),
  scored as (
    select f.image_id, f.image_url, f.width, f.height,
           -(f.descriptor::public.vector(512) operator(public.<#>) probe.v) as sim
      from public.faces f, probe
     where f.event_id = any(p_event_ids)
       and array_length(f.descriptor, 1) = 512
  ),
  best as (
    select distinct on (image_id) image_id, image_url, width, height, sim
      from scored
     where sim >= p_threshold
     order by image_id, sim desc
  )
  select jsonb_build_object(
    'compared', (select count(*) from scored),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
               'image_id', image_id, 'image_url', image_url, 'width', width, 'height', height, 'sim', sim)
             order by sim desc)
        from best), '[]'::jsonb)
  );
$$;

revoke all on function public.match_faces(text[], float8[], float8) from public, anon, authenticated;
grant execute on function public.match_faces(text[], float8[], float8) to service_role;
