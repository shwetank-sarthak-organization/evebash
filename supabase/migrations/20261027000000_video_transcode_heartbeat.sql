-- Issue #157: lets the backend watchdog tell a video that is waiting for a worker, or being transcoded, from one
-- whose job was lost. Written by Modal only while the "queue_aware" key of the video switch is on; read by the
-- watchdog only with VIDEO_WATCHDOG_QUEUE_AWARE=true. Both columns stay NULL otherwise, and nothing else reads them.

-- When Modal accepted the video's transcode job, or handed it to another worker (GPU -> 16-core)
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS transcode_queued_at timestamptz;

-- Set when a worker starts the transcode and every minute while it runs
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS transcode_heartbeat_at timestamptz;
