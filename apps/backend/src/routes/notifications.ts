import type { Request, Response } from "express";
import { Router } from "express";
import { getBearerToken, verifySupabaseUser } from "../auth.js";
import { getSupabaseUserClient } from "../supabase.js";

type AdminClient = NonNullable<Awaited<ReturnType<typeof verifySupabaseUser>>>["supabaseAdmin"];

export type ExpoPush = { token: string; title: string; body: string; data: Record<string, unknown> };

export async function sendExpoPush(push: ExpoPush) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: push.token, sound: "default", title: push.title, body: push.body, data: push.data }),
  });
  // Expo answers 200 even when it refuses a push (for example DeviceNotRegistered), so log its verdict
  const result = (await response.json().catch(() => null)) as
    | { data?: { status?: string; message?: string; details?: { error?: string } }; errors?: unknown }
    | null;
  if (!response.ok || result?.errors || result?.data?.status === "error") {
    console.warn(
      `[notifications] Expo refused "${push.title}" (HTTP ${response.status}):`,
      result?.data?.details?.error || result?.data?.message || JSON.stringify(result?.errors ?? null),
    );
  }
}

/** Kill switch: GALLERY_REQUEST_PUSH=false stops the "new access request" push without a new app build. */
export function isGalleryRequestPushEnabled() {
  return process.env.GALLERY_REQUEST_PUSH?.trim().toLowerCase() !== "false";
}

/** Kill switch: GALLERY_APPROVAL_PUSH=false stops the "access approved / updated" push to guests. */
export function isGalleryApprovalPushEnabled() {
  return process.env.GALLERY_APPROVAL_PUSH?.trim().toLowerCase() !== "false";
}

/** The caller's access to a gallery as the database sees it (open_gallery with the caller's own token). */
export async function openGalleryAccessAsCaller(request: Request, eventId: string): Promise<string | null> {
  const { data, error } = await getSupabaseUserClient(getBearerToken(request)).rpc("open_gallery", { p_ref: eventId });
  if (error) throw error;
  return (data as { access?: string } | null)?.access ?? null;
}

// People may ask again (for example after a rejection), so a repeat for the same request within this window
// isn't pushed to the owner again.
export const GALLERY_REQUEST_PUSH_WINDOW_MS = 10 * 60 * 1000;

/** Owners turn these off with the "Event invites" notification setting (or all pushes with `push: false`). */
function wantsEventInvites(preferences: unknown) {
  let prefs = preferences;
  if (typeof prefs === "string") {
    try {
      prefs = JSON.parse(prefs);
    } catch {
      prefs = null;
    }
  }
  const settings = (prefs && typeof prefs === "object" ? prefs : {}) as Record<string, unknown>;
  return settings.push !== false && settings.eventInvites !== false;
}

/**
 * A profile's push token and notification settings. Reads "*" because profiles has no notification_preferences
 * column yet (the apps can't save the setting), and naming a missing column fails the whole lookup, which silently
 * dropped every push. With "*" the settings count when the column exists, and as on (the apps' default) when not.
 */
async function findPushProfile(supabaseAdmin: AdminClient, column: "id" | "email" | "phone", value: string) {
  const { data, error } = await supabaseAdmin.from("profiles").select("*").eq(column, value).maybeSingle();
  if (error) console.warn(`[notifications] profile lookup by ${column} failed:`, error.message);
  return data as { push_token?: string | null; notification_preferences?: unknown } | null;
}

function logNotSent(route: string, reason: string, details: Record<string, unknown>) {
  console.log(`[notifications] ${route} push not sent: ${reason}`, JSON.stringify(details));
}

/** Old guest row ids start with the guest's phone or email, which stay out of the logs. */
const loggableGuestId = (guestId: string) => (guestId.startsWith("u_") ? guestId : "(old row)");

/** Same lookup as the database's resolve_event (id, then join code, then legacy id), then up to the top-level gallery. */
async function findTopLevelGallery(supabaseAdmin: AdminClient, ref: string) {
  const columns = "id, parent_id, created_by, title";
  let gallery: { id: string; parent_id: string | null; created_by: string | null; title: string | null } | null = null;
  for (const column of ["id", "join_id", "legacy_id"]) {
    const { data } = await supabaseAdmin.from("events").select(columns).eq(column, ref).maybeSingle();
    if (data) {
      gallery = data;
      break;
    }
  }
  if (gallery?.parent_id) {
    const { data: parent } = await supabaseAdmin.from("events").select(columns).eq("id", gallery.parent_id).maybeSingle();
    if (parent) gallery = parent;
  }
  return gallery;
}

/**
 * Tells a gallery's owner that someone asked to join. The apps call this right after request_gallery_access
 * returns "pending"; the push is sent from here because the owner's push token isn't readable to guests once RLS is
 * on. It is only sent for a real pending request by the signed-in caller (rows made by request_gallery_access).
 */
export function createNotificationsRouter(
  verifyUser = verifySupabaseUser,
  sendPush = sendExpoPush,
  now = () => Date.now(),
  galleryAccess = openGalleryAccessAsCaller,
) {
  const notificationsRouter = Router();
  const recentRequestPushes = new Map<string, number>();
  const recentDecisionPushes = new Map<string, number>();

  notificationsRouter.post("/gallery-request", async (request: Request, response: Response) => {
    try {
      const verified = await verifyUser(request);
      if (!verified) {
        return response.status(401).json({ success: false, error: "Authentication required." });
      }

      const ref = typeof request.body?.ref === "string" ? request.body.ref.trim() : "";
      if (!ref) {
        return response.status(400).json({ success: false, error: "ref is required." });
      }
      const { user, supabaseAdmin } = verified;
      const notSent = (reason: string, details: Record<string, unknown> = {}) => {
        logNotSent("gallery-request", reason, { caller: user.id, ref, ...details });
        return response.json({ success: true, sent: false });
      };
      if (!isGalleryRequestPushEnabled()) return notSent("GALLERY_REQUEST_PUSH is false");

      const gallery = await findTopLevelGallery(supabaseAdmin, ref);
      if (!gallery) {
        logNotSent("gallery-request", "gallery not found", { caller: user.id, ref });
        return response.status(404).json({ success: false, error: "Gallery not found." });
      }

      const { data: guest, error: guestError } = await supabaseAdmin
        .from("guests")
        .select("name, status")
        .eq("user_id", user.id)
        .eq("event_id", gallery.id)
        .maybeSingle();
      const owner = gallery.created_by;
      if (guest?.status !== "pending") {
        return notSent("no pending request", { gallery: gallery.id, status: guest?.status ?? null, error: guestError?.message });
      }
      if (!owner) return notSent("gallery has no owner", { gallery: gallery.id });
      if (owner === user.id) return notSent("caller owns the gallery", { gallery: gallery.id });

      const key = `${user.id}:${gallery.id}`;
      const lastSent = recentRequestPushes.get(key);
      if (lastSent !== undefined && now() - lastSent < GALLERY_REQUEST_PUSH_WINDOW_MS) {
        return notSent("already sent in the last 10 minutes", { gallery: gallery.id });
      }

      const ownerProfile = await findPushProfile(supabaseAdmin, owner.includes("@") ? "email" : "id", owner);
      if (!ownerProfile?.push_token) {
        return notSent(ownerProfile ? "owner has no push token" : "owner profile not found", { gallery: gallery.id });
      }
      if (!wantsEventInvites(ownerProfile.notification_preferences)) {
        return notSent("owner turned off Event invites", { gallery: gallery.id });
      }

      recentRequestPushes.set(key, now());
      await sendPush({
        token: ownerProfile.push_token,
        title: "New access request 🔔",
        body: `${guest.name || "Someone"} is asking to join "${gallery.title || "your event"}".`,
        data: { eventId: gallery.id },
      });
      console.log("[notifications] gallery-request push sent", JSON.stringify({ caller: user.id, gallery: gallery.id }));
      return response.json({ success: true, sent: true });
    } catch (error) {
      console.error("[notifications] gallery request push failed:", error);
      return response.status(500).json({ success: false, error: "Could not send the notification." });
    }
  });

  /**
   * Tells a guest their access request was approved (or turned down). The website and the app call this right after
   * the host changes the guest's status. Sent from here because browsers can't call Expo (CORS) and the guest's push
   * token isn't readable to the host once RLS is on. Only someone who manages the gallery can trigger it, and the
   * message follows the guest row's real status in the database, not the request body.
   */
  notificationsRouter.post("/gallery-decision", async (request: Request, response: Response) => {
    try {
      const verified = await verifyUser(request);
      if (!verified) {
        return response.status(401).json({ success: false, error: "Authentication required." });
      }

      const guestId = typeof request.body?.guestId === "string" ? request.body.guestId.trim() : "";
      if (!guestId) {
        return response.status(400).json({ success: false, error: "guestId is required." });
      }
      const notSent = (reason: string, details: Record<string, unknown> = {}) => {
        logNotSent("gallery-decision", reason, { guestId: loggableGuestId(guestId), ...details });
        return response.json({ success: true, sent: false });
      };
      if (!isGalleryApprovalPushEnabled()) return notSent("GALLERY_APPROVAL_PUSH is false");

      const { supabaseAdmin } = verified;
      const { data: guest } = await supabaseAdmin
        .from("guests")
        .select("id, event_id, user_id, phone, status, event_title")
        .eq("id", guestId)
        .maybeSingle();
      if (!guest) {
        return response.status(404).json({ success: false, error: "Request not found." });
      }

      const eventId = guest.event_id || (await galleryFromLegacyGuestId(supabaseAdmin, guest.id));
      if (!eventId) return notSent("request has no gallery");
      if ((await galleryAccess(request, eventId)) !== "manage") {
        return response.status(403).json({ success: false, error: "Only the gallery's hosts can do this." });
      }

      const status = guest.status;
      if (status !== "approved" && status !== "rejected") return notSent("request is not approved or rejected", { status });

      const key = `${guest.id}:${status}`;
      const lastSent = recentDecisionPushes.get(key);
      if (lastSent !== undefined && now() - lastSent < GALLERY_REQUEST_PUSH_WINDOW_MS) {
        return notSent("already sent in the last 10 minutes", { status });
      }

      const recipient = await findGuestProfile(supabaseAdmin, guest);
      if (!recipient?.push_token) return notSent(recipient ? "guest has no push token" : "guest profile not found");
      if (!wantsEventInvites(recipient.notification_preferences)) return notSent("guest turned off Event invites");

      const title = guest.event_title || "the event";
      recentDecisionPushes.set(key, now());
      await sendPush({
        token: recipient.push_token,
        title: status === "approved" ? "Access Approved! ✨" : DENIED_PUSH_TITLE,
        body: status === "approved"
          ? `You have been approved to join the event "${title}"!`
          : deniedPushBody(title),
        data: { eventId },
      });
      console.log("[notifications] gallery-decision push sent", JSON.stringify({ guestId: loggableGuestId(guestId), eventId, status }));
      return response.json({ success: true, sent: true });
    } catch (error) {
      console.error("[notifications] gallery decision push failed:", error);
      return response.status(500).json({ success: false, error: "Could not send the notification." });
    }
  });

  return notificationsRouter;
}

const DENIED_PUSH_TITLE = "Access request not approved";
const deniedPushBody = (title: string) => `The host didn't approve your request to join "${title}". You can ask again later.`;

export type DeniedGuest = { id: string; event_id?: string | null; user_id?: string | null; phone?: string | null; event_title?: string | null };

/**
 * Tells someone their request to join was turned down. Called by the permissions "deny-request" route before it
 * erases the request (the push needs the row). Best effort: returns whether a push went out.
 */
export async function notifyGuestRequestDenied(supabaseAdmin: AdminClient, guest: DeniedGuest, sendPush = sendExpoPush) {
  if (!isGalleryApprovalPushEnabled()) return false;
  const recipient = await findGuestProfile(supabaseAdmin, guest);
  if (!recipient?.push_token || !wantsEventInvites(recipient.notification_preferences)) {
    const reason = !recipient ? "guest profile not found" : !recipient.push_token ? "guest has no push token" : "guest turned off Event invites";
    logNotSent("deny-request", reason, { guestId: loggableGuestId(guest.id) });
    return false;
  }
  const eventId = guest.event_id || (await galleryFromLegacyGuestId(supabaseAdmin, guest.id));
  await sendPush({
    token: recipient.push_token,
    title: DENIED_PUSH_TITLE,
    body: deniedPushBody(guest.event_title || "the event"),
    data: eventId ? { eventId } : {},
  });
  return true;
}

/** Old guest rows have no event_id; their id is "<phone or email>_<gallery id>", and gallery ids may contain "_". */
export async function galleryFromLegacyGuestId(supabaseAdmin: AdminClient, guestId: string) {
  for (let at = guestId.indexOf("_"); at !== -1; at = guestId.indexOf("_", at + 1)) {
    const candidate = guestId.slice(at + 1);
    const { data } = await supabaseAdmin.from("events").select("id").eq("id", candidate).maybeSingle();
    if (data) return candidate;
  }
  return null;
}

/** New guest rows carry the guest's user id; older ones only a phone number. */
async function findGuestProfile(
  supabaseAdmin: AdminClient,
  guest: { user_id?: string | null; phone?: string | null },
) {
  if (guest.user_id) return findPushProfile(supabaseAdmin, "id", guest.user_id);
  if (guest.phone) return findPushProfile(supabaseAdmin, "phone", guest.phone);
  return null;
}

export const notificationsRouter = createNotificationsRouter();
