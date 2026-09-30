-- Event owner's "new video" push is sent once the video is processed (Modal callback), not at upload.
-- Modal can run the same video more than once (QStash retries, watchdog recovery), so the backend claims
-- this column atomically before sending to guarantee at most one push per video.
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS owner_notified_at TIMESTAMPTZ;
