-- Add face_count column to photos table to track detected faces per photo
ALTER TABLE photos ADD COLUMN IF NOT EXISTS face_count integer DEFAULT 0;

-- Update face_count and face_indexed for photos that have entries in the faces table
UPDATE photos p
SET face_count = sub.cnt,
    face_indexed = TRUE
FROM (
    SELECT image_id, COUNT(*) as cnt
    FROM faces
    GROUP BY image_id
) sub
WHERE p.id = sub.image_id;

-- For all photos without entries in faces table, ensure face_count is 0
UPDATE photos
SET face_count = 0
WHERE face_count IS NULL;
