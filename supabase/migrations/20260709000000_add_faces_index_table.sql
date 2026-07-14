CREATE TABLE IF NOT EXISTS faces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id text NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    descriptor double precision[] NOT NULL,
    event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    width integer NOT NULL DEFAULT 0,
    height integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faces_image_id_idx
    ON faces(image_id);

CREATE INDEX IF NOT EXISTS faces_event_id_idx
    ON faces(event_id);

ALTER TABLE faces ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON faces TO anon, authenticated;

DROP POLICY IF EXISTS "Allow reading face index" ON faces;
CREATE POLICY "Allow reading face index"
ON faces
FOR SELECT
TO anon, authenticated
USING (true);
