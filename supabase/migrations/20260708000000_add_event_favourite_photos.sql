CREATE TABLE IF NOT EXISTS event_favourite_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    photo_id text NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    marked_by text REFERENCES profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (event_id, photo_id)
);

CREATE INDEX IF NOT EXISTS event_favourite_photos_event_id_idx
    ON event_favourite_photos(event_id);

CREATE INDEX IF NOT EXISTS event_favourite_photos_photo_id_idx
    ON event_favourite_photos(photo_id);

GRANT SELECT ON event_favourite_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON event_favourite_photos TO authenticated;
