-- ============================================================
-- FaceNet Migration: Clear old dlib 128-dim face embeddings
-- Run this in Supabase SQL Editor ONCE before re-triggering indexing.
--
-- Why: dlib produced 128-dim vectors. FaceNet produces 512-dim vectors.
-- The two are incompatible — old rows will be automatically skipped
-- by the new matching code (len != 512 check), but they waste storage
-- and clutter the faces table. Deleting them is cleaner.
--
-- The photos.face_indexed flag is also reset to FALSE so every photo
-- gets re-sent to Modal for FaceNet re-indexing on the next batch trigger.
-- ============================================================

-- Step 1: Delete all existing face embeddings (old dlib 128-dim vectors)
DELETE FROM faces;

-- Step 2: Reset face_indexed flag on all photos so they get re-indexed
-- by FaceNet on the next batch trigger
UPDATE photos
SET face_indexed = FALSE
WHERE media_type = 'photo';

-- Verify
SELECT
    (SELECT COUNT(*) FROM faces)   AS faces_remaining,
    (SELECT COUNT(*) FROM photos WHERE face_indexed = FALSE AND media_type = 'photo') AS photos_pending_reindex;
