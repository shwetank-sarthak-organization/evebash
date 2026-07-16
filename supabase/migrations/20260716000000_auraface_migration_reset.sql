-- ============================================================
-- AuraFace Migration: Reset database for 512-dim AuraFace vectors
-- Run this in Supabase SQL Editor ONCE before re-triggering indexing.
-- ============================================================

-- Step 1: Clear old FaceNet embeddings (they were 512-dim, but generated
-- by a different model, so they are mathematically incompatible with AuraFace).
DELETE FROM faces;

-- Step 2: Reset face_indexed flag so all photos get sent to Modal 
-- to be indexed by the new AuraFace model.
UPDATE photos
SET face_indexed = FALSE
WHERE media_type = 'photo';

-- Verify counts
SELECT 
    (SELECT COUNT(*) FROM faces) AS faces_count,
    (SELECT COUNT(*) FROM photos WHERE face_indexed = FALSE AND media_type = 'photo') AS pending_photos_count;
