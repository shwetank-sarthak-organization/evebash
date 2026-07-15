-- ============================================================
-- SQL Migration: Alter descriptor column for 512 dimensions
-- Run this in Supabase SQL Editor to resolve the 'expected 128 dimensions' error.
-- ============================================================

-- 1. Identify and drop any check constraints on the descriptor column
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'faces'::regclass 
          AND contype = 'c' 
    LOOP
        EXECUTE 'ALTER TABLE faces DROP CONSTRAINT ' || quote_ident(r.conname);
        RAISE NOTICE 'Dropped constraint %', r.conname;
    END LOOP;
END $$;

-- 2. Alter the descriptor column to double precision[] without size limits
-- (In case it was cast as a fixed-length or customized array type)
ALTER TABLE faces 
  ALTER COLUMN descriptor TYPE double precision[];

-- 3. Reset the photo indexing status so they get processed again
UPDATE photos
SET face_indexed = FALSE
WHERE media_type = 'photo';

-- 4. Verify table schema column type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'faces' AND column_name = 'descriptor';
