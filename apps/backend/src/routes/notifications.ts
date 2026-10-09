import type { Request, Response } from "express";
import { Router } from "express";
import { verifySupabaseUser } from "../auth.js";

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
) {
  const notificationsRouter = Router();
  const recentRequestPushes = new Map<string, number>();

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

  return notificationsRouter;
}

export const notificationsRouter = createNotificationsRouter();
