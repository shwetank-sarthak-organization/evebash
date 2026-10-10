import type { Request, Response } from "express";
import { Router } from "express";
import { getBearerToken, verifySupabaseUser } from "../auth.js";
import { getSupabaseUserClient } from "../supabase.js";

type AdminClient = NonNullable<Awaited<ReturnType<typeof verifySupabaseUser>>>["supabaseAdmin"];

export type ExpoPush = { token: string; title: string; body: string; data: Record<string, unknown> };

export async function sendExpoPush(push: ExpoPush) {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: push.token, sound: "default", title: push.title, body: push.body, data: push.data }),
  });
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
      if (!isGalleryRequestPushEnabled()) return response.json({ success: true, sent: false });

      const { user, supabaseAdmin } = verified;
      const gallery = await findTopLevelGallery(supabaseAdmin, ref);
      if (!gallery) {
        return response.status(404).json({ success: false, error: "Gallery not found." });
      }

      const { data: guest } = await supabaseAdmin
        .from("guests")
        .select("name, status")
        .eq("user_id", user.id)
        .eq("event_id", gallery.id)
        .maybeSingle();
      const owner = gallery.created_by;
      if (guest?.status !== "pending" || !owner || owner === user.id) {
        return response.json({ success: true, sent: false });
      }

      const key = `${user.id}:${gallery.id}`;
      const lastSent = recentRequestPushes.get(key);
      if (lastSent !== undefined && now() - lastSent < GALLERY_REQUEST_PUSH_WINDOW_MS) {
        return response.json({ success: true, sent: false });
      }

      const { data: ownerProfile } = await supabaseAdmin
        .from("profiles")
        .select("push_token, notification_preferences")
        .eq(owner.includes("@") ? "email" : "id", owner)
        .maybeSingle();
      if (!ownerProfile?.push_token || !wantsEventInvites(ownerProfile.notification_preferences)) {
        return response.json({ success: true, sent: false });
      }

      recentRequestPushes.set(key, now());
      await sendPush({
        token: ownerProfile.push_token,
        title: "New access request 🔔",
        body: `${guest.name || "Someone"} is asking to join "${gallery.title || "your event"}".`,
        data: { eventId: gallery.id },
      });
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
      if (!isGalleryApprovalPushEnabled()) return response.json({ success: true, sent: false });

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
      if (!eventId) return response.json({ success: true, sent: false });
      if ((await galleryAccess(request, eventId)) !== "manage") {
        return response.status(403).json({ success: false, error: "Only the gallery's hosts can do this." });
      }

      const status = guest.status;
      if (status !== "approved" && status !== "rejected") return response.json({ success: true, sent: false });

      const key = `${guest.id}:${status}`;
      const lastSent = recentDecisionPushes.get(key);
      if (lastSent !== undefined && now() - lastSent < GALLERY_REQUEST_PUSH_WINDOW_MS) {
        return response.json({ success: true, sent: false });
      }

      const recipient = await findGuestProfile(supabaseAdmin, guest);
      if (!recipient?.push_token || !wantsEventInvites(recipient.notification_preferences)) {
        return response.json({ success: true, sent: false });
      }

      const title = guest.event_title || "the event";
      recentDecisionPushes.set(key, now());
      await sendPush({
        token: recipient.push_token,
        title: status === "approved" ? "Access Approved! ✨" : "Access Request Update",
        body: status === "approved"
          ? `You have been approved to join the event "${title}"!`
          : `Your access request to "${title}" was updated.`,
        data: { eventId },
      });
      return response.json({ success: true, sent: true });
    } catch (error) {
      console.error("[notifications] gallery decision push failed:", error);
      return response.status(500).json({ success: false, error: "Could not send the notification." });
    }
  });

  return notificationsRouter;
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
  const columns = "push_token, notification_preferences";
  if (guest.user_id) {
    const { data } = await supabaseAdmin.from("profiles").select(columns).eq("id", guest.user_id).maybeSingle();
    return data;
  }
  if (guest.phone) {
    const { data } = await supabaseAdmin.from("profiles").select(columns).eq("phone", guest.phone).maybeSingle();
    return data;
  }
  return null;
}

export const notificationsRouter = createNotificationsRouter();
