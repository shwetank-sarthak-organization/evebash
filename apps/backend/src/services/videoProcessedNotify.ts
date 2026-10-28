import { getSupabaseAdminClient } from "../supabase.js";
import { isVideoReadyPushEnabled, sendOwnerUploadNotification } from "../uploadNotifications.js";

/**
 * With VIDEO_READY_PUSH on, sends the event owner's "new video" push once a video is processed, at most once per
 * video (the row's owner_notified_at is claimed first). Used by /internal/video-processed (Modal) and by the
 * RunPod worker's /complete. Moved here unchanged from the /internal/video-processed route.
 */
export async function notifyVideoProcessed(photoId: string): Promise<{ skipped?: string; notified?: boolean }> {
  if (!isVideoReadyPushEnabled()) return { skipped: "disabled" };

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: photo, error } = await supabaseAdmin
    .from("photos")
    .select("id, event_id, user_id, status, media_type, resource_type")
    .eq("id", photoId)
    .maybeSingle();
  if (error) throw error;

  const isVideo = photo?.media_type === "video" || photo?.resource_type === "video";
  if (!photo || !isVideo || photo.status !== "processed") return { skipped: "not_a_processed_video" };

  // Claim the row first: Modal can report the same video more than once (QStash retries, watchdog recovery)
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("photos")
    .update({ owner_notified_at: new Date().toISOString() })
    .eq("id", photoId)
    .is("owner_notified_at", null)
    .select("id");
  if (claimError) throw claimError;
  if (!claimed || claimed.length === 0) return { skipped: "already_notified" };

  setTimeout(() => {
    sendOwnerUploadNotification(photo.event_id, photo.user_id, "🎥 New video uploaded", "Someone added a video to your event", { eventId: photo.event_id })
      .catch((err) => console.error("[VideoProcessedNotify] Background task failed:", err));
  }, 0);
  return { notified: true };
}
