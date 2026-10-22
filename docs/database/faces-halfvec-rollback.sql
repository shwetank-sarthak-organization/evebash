-- Rollback for supabase/migrations/20261022010000_faces_halfvec.sql (issue #100): faces.descriptor back to
-- float8[] and both functions back to their previous versions (copied from 20260928000000 and 20261010020000).
-- Faces saved while the column was halfvec keep halfvec precision (Find You results were identical in testing).
-- Run as one transaction.

begin;

alter table public.faces
  alter column descriptor type double precision[]
  using descriptor::public.vector(512)::real[]::double precision[];

CREATE OR REPLACE FUNCTION public.replace_photo_faces(
    p_photo_id TEXT,
    p_token TEXT,
    p_asset_version INT,
    p_faces JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
            ARRAY(SELECT jsonb_array_elements_text(f->'descriptor')::DOUBLE PRECISION)
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
$$;

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

commit;
