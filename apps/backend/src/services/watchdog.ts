import { getSupabaseAdminClient } from "../supabase.js";
import { cancelLargeFile, getCachedBackblazeAuth } from "../backblaze.js";
import { publishManifestAssemblyTask } from "../qstash.js";
import { flushStaleEventNotifications } from "../uploadNotifications.js";

export interface WatchdogReport {
  timestamp: string;
  recoveredVideos: Array<{ id: string; storageKey: string; attempt: number }>;
  /** Videos left alone because a worker is running them or they are waiting for one (issue #157 switch only). */
  waitingVideos: Array<{ id: string; storageKey: string; reason: string }>;
  failedVideos: Array<{ id: string; storageKey: string; reason: string }>;
  cleanedAbandonedSessions: Array<{ id: string; fileId: string }>;
  errors: string[];
}

/**
 * Issue #157: with VIDEO_WATCHDOG_QUEUE_AWARE=true the watchdog no longer treats a video as stuck just because it
 * was uploaded more than 15 min ago. During a burst, videos wait in Modal's queue (the video workers are capped)
 * for longer than that, and re-sending them made the same video transcode twice and, after 3 rounds, showed it
 * as failed while it was still waiting. Modal (its "queue_aware" switch key) writes transcode_queued_at when it
 * accepts or hands over a job and transcode_heartbeat_at every minute while a worker runs it; the watchdog leaves
 * a video alone while either is recent. Off (the default): exactly the old behaviour.
 */
export function queueAwareWatchdogEnabled(setting = process.env.VIDEO_WATCHDOG_QUEUE_AWARE): boolean {
  return setting?.trim().toLowerCase() === "true";
}

/** A worker writes a heartbeat every 60 s; this long without one means the run stopped. */
export const HEARTBEAT_STALE_MS = 10 * 60 * 1000;
/** A video accepted by Modal may wait this long for a worker before it is treated as lost. */
export const QUEUE_LIMIT_MS = 2 * 60 * 60 * 1000;
export const MAX_TRANSCODE_ATTEMPTS = 3;

export interface StuckVideoState {
  transcode_attempts?: number | null;
  transcode_queued_at?: string | null;
  transcode_heartbeat_at?: string | null;
}

export type StuckVideoDecision =
  | { action: "wait"; reason: string }
  | { action: "resend"; reason: string }
  | { action: "fail"; reason: string };

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** What the queue-aware watchdog does with a video that is still 'processing' 15+ min after upload. */
export function decideStuckVideo(video: StuckVideoState, nowMs: number): StuckVideoDecision {
  const beat = parseTime(video.transcode_heartbeat_at);
  const queued = parseTime(video.transcode_queued_at);
  if (beat !== null && nowMs - beat < HEARTBEAT_STALE_MS) {
    return { action: "wait", reason: "a worker is transcoding it" };
  }
  // Queued after the last heartbeat (or never started): it is in Modal's queue, e.g. after a GPU-to-CPU handover
  if (queued !== null && (beat === null || queued > beat) && nowMs - queued < QUEUE_LIMIT_MS) {
    return { action: "wait", reason: "waiting for a free worker" };
  }
  const why = beat !== null
    ? "its worker stopped sending heartbeats"
    : queued !== null
      ? "it waited for a worker for more than 2 hours"
      : "no worker accepted it";
  if (Number(video.transcode_attempts || 0) >= MAX_TRANSCODE_ATTEMPTS) {
    return { action: "fail", reason: `Transcoding did not finish after ${MAX_TRANSCODE_ATTEMPTS} automated recovery attempts (${why}).` };
  }
  return { action: "resend", reason: why };
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(error && (error.code === "42703" || error.code === "PGRST204" || error.message?.includes("column")));
}

/**
 * Self-Healing Media Watchdog
 * 1. Finds videos stuck in 'processing' > 15 minutes and re-triggers transcoding.
 * 2. Marks videos as 'failed' if they exceed 3 recovery attempts.
 * 3. Aborts Backblaze B2 multipart sessions stuck in 'uploading' > 24 hours.
 * 4. Sends grouped upload pushes still in the outbox after their debounce window (timer lost on restart).
 */
export async function runMediaWatchdog(): Promise<WatchdogReport> {
  const supabase = getSupabaseAdminClient();
  const report: WatchdogReport = {
    timestamp: new Date().toISOString(),
    recoveredVideos: [],
    waitingVideos: [],
    failedVideos: [],
    cleanedAbandonedSessions: [],
    errors: [],
  };

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Recover Stuck 'processing' Videos ──────────────────────────────────
  try {
    const baseColumns = "id, storage_key, event_id, transcode_attempts, uploaded_at, user_id, size, duration";
    const selectStuck = (columns: string, limit: number) => supabase
      .from("photos")
      .select(columns)
      .eq("resource_type", "video")
      .eq("status", "processing")
      .lt("uploaded_at", fifteenMinutesAgo)
      .gt("uploaded_at", sixHoursAgo)
      .order("uploaded_at", { ascending: true })
      .limit(limit);

    let queueAware = queueAwareWatchdogEnabled();
    // Queue-aware: more rows, so a burst of waiting videos can't hide a lost one behind them
    let { data: stuckVideos, error: queryError } = queueAware
      ? await selectStuck(`${baseColumns}, transcode_queued_at, transcode_heartbeat_at`, 200)
      : await selectStuck(baseColumns, 20);
    if (queueAware && isMissingColumnError(queryError)) {
      // Migration 20261027000000_video_transcode_heartbeat.sql not applied yet: behave as before
      report.errors.push(`Queue-aware watchdog needs the transcode heartbeat columns; using the old rule: ${queryError?.message}`);
      queueAware = false;
      ({ data: stuckVideos, error: queryError } = await selectStuck(baseColumns, 20));
    }

    if (queryError) {
      report.errors.push(`Failed to query stuck videos: ${queryError.message}`);
    } else if (stuckVideos && stuckVideos.length > 0) {
      console.log(`[Watchdog] Found ${stuckVideos.length} video(s) stuck in 'processing'`);

      const nowMs = Date.now();
      for (const video of stuckVideos as any[]) {
        const attempts = Number(video.transcode_attempts || 0);
        const decision = queueAware ? decideStuckVideo(video, nowMs) : null;

        if (decision?.action === "wait") {
          report.waitingVideos.push({ id: video.id, storageKey: video.storage_key, reason: decision.reason });
          continue;
        }

        if (decision ? decision.action === "fail" : attempts >= 3) {
          // Exceeded retry budget — mark failed so it stops retrying indefinitely
          const failureReason = decision?.reason || "Transcoding timed out after 3 automated recovery attempts.";
          await supabase
            .from("photos")
            .update({
              status: "failed",
              processing_error: failureReason,
            })
            .eq("id", video.id);

          report.failedVideos.push({
            id: video.id,
            storageKey: video.storage_key,
            reason: failureReason,
          });
          console.warn(`[Watchdog] Video ${video.id} marked as 'failed' (attempts exceeded)`);
        } else {
          // Re-enqueue transcode job with QStash
          const nextAttempt = attempts + 1;
          await supabase
            .from("photos")
            .update({ transcode_attempts: nextAttempt })
            .eq("id", video.id);

          await publishManifestAssemblyTask({
            id: video.id,
            photo_id: video.id,
            storage_key: video.storage_key,
            event_id: video.event_id,
            user_id: video.user_id,
            duration: Number(video.duration || 0),
            fileSize: Number(video.size || 0),
          }).catch((err: any) => {
            console.error(`[Watchdog] Failed to publish transcode task for ${video.id}:`, err);
            report.errors.push(`QStash publish failed for ${video.id}: ${err?.message || err}`);
          });

          report.recoveredVideos.push({
            id: video.id,
            storageKey: video.storage_key,
            attempt: nextAttempt,
          });
          console.log(`[Watchdog] Re-enqueued transcode for ${video.id} (attempt #${nextAttempt})${decision ? `: ${decision.reason}` : ""}`);
        }
      }
      if (report.waitingVideos.length > 0) {
        console.log(`[Watchdog] Left ${report.waitingVideos.length} video(s) alone: running or waiting for a worker`);
      }
    }
  } catch (err: any) {
    report.errors.push(`Stuck videos recovery failed: ${err?.message || err}`);
  }

  // ── 2. Clean Up Abandoned 'uploading' Sessions > 24 Hours ─────────────────
  try {
    const { data: abandonedSessions, error: sessionQueryError } = await supabase
      .from("photos")
      .select("id, b2_file_id, storage_key")
      .eq("status", "uploading")
      .not("b2_file_id", "is", null)
      .lt("uploaded_at", twentyFourHoursAgo)
      .limit(20);

    if (sessionQueryError) {
      report.errors.push(`Failed to query abandoned sessions: ${sessionQueryError.message}`);
    } else if (abandonedSessions && abandonedSessions.length > 0) {
      console.log(`[Watchdog] Cleaning up ${abandonedSessions.length} abandoned B2 upload session(s)`);
      const auth = await getCachedBackblazeAuth();

      for (const session of abandonedSessions) {
        if (session.b2_file_id) {
          await cancelLargeFile(auth, session.b2_file_id).catch(() => {});
        }
        await supabase.from("photos").delete().eq("id", session.id);

        report.cleanedAbandonedSessions.push({
          id: session.id,
          fileId: session.b2_file_id || "none",
        });
        console.log(`[Watchdog] Aborted B2 session & removed row for: ${session.id}`);
      }
    }
  } catch (err: any) {
    report.errors.push(`Abandoned session cleanup failed: ${err?.message || err}`);
  }

  // ── 3. Send Grouped Upload Pushes Whose In-Memory Timer Was Lost (restart) ─
  try {
    const flushed = await flushStaleEventNotifications();
    if (flushed > 0) {
      console.log(`[Watchdog] Sent ${flushed} pending upload notification(s) left in the outbox`);
    }
  } catch (err: any) {
    report.errors.push(`Pending upload notifications flush failed: ${err?.message || err}`);
  }

  return report;
}
