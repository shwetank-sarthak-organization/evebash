import { getSupabaseAdminClient } from "./supabase.js";

// Grouped upload pushes wait for this long after the last upload (see debounceEventNotification in routes/media.ts).
export const EVENT_NOTIFICATION_DEBOUNCE_MS = 2 * 60 * 1000;

/** When on, a video's "new video" push is sent once Modal has processed it instead of at upload. */
export function isVideoReadyPushEnabled() {
  return process.env.VIDEO_READY_PUSH?.trim().toLowerCase() === "true";
}

export async function sendOwnerUploadNotification(
  eventId: string,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  if (!eventId || !userId || userId === "anonymous") return;

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("created_by, title")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event?.created_by || event.created_by === userId) return;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("push_token, notification_preferences")
    .eq("id", event.created_by)
    .maybeSingle();

  if (profileError || !profile?.push_token) return;
  const preferences = profile.notification_preferences as Record<string, unknown> | null;
  if (preferences?.push === false || preferences?.event_activity === false) return;

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: profile.push_token,
      sound: "default",
      title,
      body,
      data,
    }),
  });
}

/** Sends an event's grouped upload push from the outbox. */
export async function flushEventNotificationOutbox(eventId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  try {
    // Deleting with RETURNING claims the row, so the in-memory timer and the watchdog can never both send it
    const { data: claimed, error } = await supabaseAdmin
      .from("event_notifications_outbox")
      .delete()
      .eq("event_id", eventId)
      .select("*");

    if (error || !claimed || claimed.length === 0) return;

    const outboxItem = claimed[0];
    const count = outboxItem.unsent_count || 1;

    console.log(`[MobileOutbox] Flushing debounced notification for event ${eventId} (${count} photos)`);
    await sendOwnerUploadNotification(
      eventId,
      outboxItem.uploader_user_id,
      "📸 New photos uploaded",
      `Someone added ${count} new photos to your event`,
      { eventId }
    );
  } catch (err) {
    console.error(`[MobileOutbox] Error flushing notification for event ${eventId}:`, err);
  }
}

/**
 * Sends grouped pushes whose in-memory timer was lost (e.g. the backend restarted within the debounce window).
 * Rows are only picked up well after their timer would have fired, so a live timer normally sends first.
 */
export async function flushStaleEventNotifications(): Promise<number> {
  const supabaseAdmin = getSupabaseAdminClient();
  const cutoff = new Date(Date.now() - EVENT_NOTIFICATION_DEBOUNCE_MS - 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("event_notifications_outbox")
    .select("event_id")
    .lt("last_unsent_at", cutoff)
    .limit(50);
  if (error) throw error;

  for (const row of data || []) {
    await flushEventNotificationOutbox(row.event_id);
  }
  return (data || []).length;
}
