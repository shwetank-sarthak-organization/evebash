-- Faces: store the 512 face numbers as halfvec(512) (2 bytes each) instead of float8[] (8 bytes each, issue #100).
-- Measured 2026-10-22 on 32,122 faces: the table goes from 115 MB to 51 MB (1,032 instead of 2,735 bytes per
-- face). vector(512) would only save 15% (98 MB): it is still too big to fit in the row. Find You gave the same
-- results: 300 real faces searched against their own galleries, 75,403 photo checks, 6,532 matches either way,
-- largest score change 0.00009 against the 0.40 threshold.
-- Also changes, in the same transaction, the two functions that use the column:
--   replace_photo_faces (the photo workers save faces through it) and match_faces (Find You).
-- Inserts through the REST API (website saveFace, backend findYou.ts) keep sending a JSON array of numbers,
-- which PostgREST turns into halfvec. Reads through the REST API now get the text "[0.1,0.2,...]" instead of a
-- JSON array; the only reader (Modal's Find You fallback) already handles that.
-- Rollback: docs/database/faces-halfvec-rollback.sql

alter table public.faces
  alter column descriptor type public.halfvec(512)
  using descriptor::public.vector(512)::public.halfvec(512);

create or replace function public.replace_photo_faces(p_photo_id text, p_token text, p_asset_version integer, p_faces jsonb)
 returns boolean
 language plpgsql
 security definer
as $function$
DECLARE
    v_photo_exists INT;
BEGIN
    -- Lock row and verify token & asset_version
    SELECT 1 INTO v_photo_exists
    FROM public.photos
    WHERE id = p_photo_id
      AND face_processing_token = p_token
      AND asset_version = p_asset_version
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Delete old faces for this image
    DELETE FROM public.faces WHERE image_id = p_photo_id;

    -- Insert new faces if any
    IF p_faces IS NOT NULL AND jsonb_array_length(p_faces) > 0 THEN
        INSERT INTO public.faces (
            event_id, image_id, image_url, width, height, descriptor
        )
        SELECT
            f->>'event_id',
            p_photo_id,
            f->>'image_url',
            COALESCE((f->>'width')::INT, 0),
            COALESCE((f->>'height')::INT, 0),
            (f->'descriptor')::text::public.halfvec(512)
        FROM jsonb_array_elements(p_faces) AS f;
    END IF;

    -- Update photos
    UPDATE public.photos
    SET
        face_status = 'indexed',
        face_indexed = TRUE,
        face_processing_token = NULL,
        face_lease_until = NULL
    WHERE id = p_photo_id;

    -- Mark face_index outbox row as published
    UPDATE public.processing_outbox
    SET status = 'published', published_at = now(), updated_at = now()
    WHERE photo_id = p_photo_id
      AND job_type = 'face_index'
      AND asset_version = p_asset_version;

    RETURN TRUE;
END;
$function$;

-- Same inputs and output as before; the selfie is turned into halfvec once, and the stored faces need no cast
create or replace function public.match_faces(p_event_ids text[], p_embedding float8[], p_threshold float8 default 0.40)
returns jsonb
language sql stable
set search_path = ''
as $$
  with probe as (
    select p_embedding::public.vector(512)::public.halfvec(512) as v
  ),
  scored as (
    select f.image_id, f.image_url, f.width, f.height,
           -(f.descriptor operator(public.<#>) probe.v) as sim
      from public.faces f, probe
     where f.event_id = any(p_event_ids)
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
