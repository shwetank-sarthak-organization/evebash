import type { Request, Response } from "express";
import { Router } from "express";
import { getAdminClient } from "../adminAuth.js";
import { verifySupabaseUser } from "../auth.js";
import { galleryFromLegacyGuestId, notifyGuestRequestDenied, openGalleryAccessAsCaller } from "./notifications.js";
import { checkGalleryManageAccess, describeUploaders, MAX_UPLOADER_IDS } from "./uploaders.js";

/**
 * These routes used to trust a "requester" name sent in the request body, so anyone could claim to be a super
 * admin and approve themselves into any gallery, make themselves an admin or remove guests. They now need a real
 * login, and the database decides (open_gallery = "manage": owner, guest admin or platform admin).
 * Kill switch: GUEST_ROUTES_REQUIRE_LOGIN=false goes back to the old body-based check.
 */
export function isGuestRouteLoginRequired() {
  return process.env.GUEST_ROUTES_REQUIRE_LOGIN?.trim().toLowerCase() !== "false";
}

type GuestRouteAccess = "allowed" | "login" | "forbidden";

const SUPER_ADMIN_EMAILS = [
  "code4sarthak@gmail.com",
  "shwetank.chauhan17@gmail.com",
];

// Old check, used only when the kill switch is off
/** The database refuses (SQLSTATE EBA01) to take Admin Access from someone who has an album role; its message says why. */
function albumRoleBlocked(response: Response, error: any) {
  if (error?.code !== "EBA01") return false;
  response.status(409).json({ success: false, code: "album_role_assigned", error: error.message });
  return true;
}

async function canManageGuestLog(logId: string, requester: { uid?: string; email?: string }) {
  if (!requester.uid && !requester.email) return false;
  const requesterEmail = (requester.email || "").toLowerCase().trim();
  if (requesterEmail && SUPER_ADMIN_EMAILS.includes(requesterEmail)) {
    return true;
  }

  const supabaseAdmin = getAdminClient();
  const { data: log, error } = await supabaseAdmin
    .from("guests")
    .select("parent_event_owner_id, event_id, parent_event_id")
    .eq("id", logId)
    .maybeSingle();

  if (error || !log) return false;

  let ownerId = log.parent_event_owner_id;
  const linkedEventIds = [log.parent_event_id, log.event_id].filter(Boolean) as string[];

  if (!ownerId && linkedEventIds.length > 0) {
    const { data: ownerEvent } = await supabaseAdmin
      .from("events")
      .select("created_by")
      .in("id", linkedEventIds)
      .limit(1)
      .maybeSingle();

    ownerId = ownerEvent?.created_by;
  }

  if (!ownerId && linkedEventIds.length === 0) return false;
  if (ownerId === requester.uid || ownerId === requester.email) return true;

  if (requester.uid) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, delegated_by, role_type")
      .eq("id", requester.uid)
      .maybeSingle();

    if (profile) {
      const isGlobalAdmin = profile.role === "admin" && !profile.delegated_by;
      const isDelegatedPrimary = !!ownerId && profile.delegated_by === ownerId && profile.role_type === "primary";
      if (isGlobalAdmin || isDelegatedPrimary) return true;
    }

    if (linkedEventIds.length > 0) {
      const { data: assignedEvents } = await supabaseAdmin
        .from("profile_assigned_events")
        .select("event_id")
        .eq("profile_id", requester.uid)
        .in("event_id", linkedEventIds);

      if ((assignedEvents || []).length > 0) return true;
    }
  }

  return false;
}

/** Whether the signed-in caller manages the gallery this guest row belongs to. */
export async function checkGuestRouteAccessAsCaller(
  request: Request,
  logId: string,
  verifyUser = verifySupabaseUser,
  galleryAccess = openGalleryAccessAsCaller,
): Promise<GuestRouteAccess> {
  const verified = await verifyUser(request);
  if (!verified) return "login";
  const { data: guest } = await verified.supabaseAdmin
    .from("guests")
    .select("id, event_id")
    .eq("id", logId)
    .maybeSingle();
  if (!guest) return "forbidden";
  const eventId = guest.event_id || (await galleryFromLegacyGuestId(verified.supabaseAdmin, guest.id));
  if (!eventId) return "forbidden";
  return (await galleryAccess(request, eventId)) === "manage" ? "allowed" : "forbidden";
}

export function createPermissionsRouter(
  checkAccess = checkGuestRouteAccessAsCaller,
  getAdmin = getAdminClient,
  notifyDenied: (supabaseAdmin: ReturnType<typeof getAdminClient>, guest: Parameters<typeof notifyGuestRequestDenied>[1]) => Promise<boolean> =
    (supabaseAdmin, guest) => notifyGuestRequestDenied(supabaseAdmin as never, guest),
  checkGalleryAccess: (request: Request, eventId: string) => Promise<GuestRouteAccess> = (request, eventId) => checkGalleryManageAccess(request, eventId),
) {
  const permissionsRouter = Router();

  const authorize = async (request: Request, logId: string, requester: unknown): Promise<GuestRouteAccess> => {
    if (isGuestRouteLoginRequired()) return checkAccess(request, logId);
    if (!requester || typeof requester !== "object") return "forbidden";
    return (await canManageGuestLog(logId, requester as { uid?: string; email?: string })) ? "allowed" : "forbidden";
  };
  const denied = (access: GuestRouteAccess) => access === "login"
    ? { status: 401, body: { success: false, error: "Please log in again." } }
    : { status: 403, body: { success: false, error: "Forbidden: You do not have permission." } };

  permissionsRouter.post("/update-guest-status", async (request, response) => {
    try {
      const { logId, status, requester } = request.body || {};
      if (!logId || !status) {
        return response.status(400).json({ error: "Missing logId or status" });
      }
      if (!["pending", "approved", "rejected"].includes(status)) {
        return response.status(400).json({ error: "Invalid status" });
      }

      const access = await authorize(request, logId, requester);
      if (access !== "allowed") {
        const { status: code, body } = denied(access);
        return response.status(code).json(body);
      }

      const supabaseAdmin = getAdmin();
      const { error } = await supabaseAdmin
        .from("guests")
        .update({ status })
        .eq("id", logId);

      if (error) throw error;
      return response.json({ success: true });
    } catch (error: any) {
      if (albumRoleBlocked(response, error)) return;
      console.error("[BackendPermissions] Error in update-guest-status:", error);
      return response.status(500).json({ success: false, error: error.message });
    }
  });

  permissionsRouter.post("/delete-guest", async (request, response) => {
    try {
      const { logId, requester } = request.body || {};
      if (!logId) {
        return response.status(400).json({ error: "Missing logId" });
      }

      const access = await authorize(request, logId, requester);
      if (access !== "allowed") {
        const { status: code, body } = denied(access);
        return response.status(code).json(body);
      }

      const supabaseAdmin = getAdmin();
      const { error } = await supabaseAdmin
        .from("guests")
        .delete()
        .eq("id", logId);

      if (error) throw error;
      return response.json({ success: true });
    } catch (error: any) {
      if (albumRoleBlocked(response, error)) return;
      console.error("[BackendPermissions] Error in delete-guest:", error);
      return response.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Deny a join request: tell the person (push), then erase the request, so nothing is kept and they can ask again.
   * Members already approved are removed with "delete-guest" instead.
   */
  permissionsRouter.post("/deny-request", async (request, response) => {
    try {
      const { logId, requester } = request.body || {};
      if (!logId) {
        return response.status(400).json({ error: "Missing logId" });
      }

      const access = await authorize(request, logId, requester);
      if (access !== "allowed") {
        const { status: code, body } = denied(access);
        return response.status(code).json(body);
      }

      const supabaseAdmin = getAdmin();
      const { data: guest, error: readError } = await supabaseAdmin
        .from("guests")
        .select("id, event_id, user_id, phone, status, event_title")
        .eq("id", logId)
        .maybeSingle();
      if (readError) throw readError;
      if (!guest) {
        return response.status(404).json({ success: false, error: "This request no longer exists." });
      }
      if (guest.status === "approved") {
        return response.status(409).json({ success: false, error: "This person is already a member. Remove them from the Members list instead." });
      }

      // The push is built from the request, so it goes out before the request is erased. A failed push never
      // blocks the denial.
      let notified = false;
      try {
        notified = await notifyDenied(supabaseAdmin, guest);
      } catch (pushError) {
        console.error("[BackendPermissions] Deny push failed:", pushError);
      }

      const { error } = await supabaseAdmin
        .from("guests")
        .delete()
        .eq("id", logId);
      if (error) throw error;
      return response.json({ success: true, notified });
    } catch (error: any) {
      console.error("[BackendPermissions] Error in deny-request:", error);
      return response.status(500).json({ success: false, error: error.message });
    }
  });

  /** Names and roles of a gallery's uploaders, for the host's "Uploaded by" filter. Gallery managers only. */
  permissionsRouter.post("/uploaders", async (request, response) => {
    try {
      const { eventId, userIds } = request.body || {};
      if (typeof eventId !== "string" || !eventId || !Array.isArray(userIds)) {
        return response.status(400).json({ success: false, error: "Missing eventId or userIds" });
      }
      const ids = Array.from(new Set(userIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200)));
      if (ids.length > MAX_UPLOADER_IDS) {
        return response.status(400).json({ success: false, error: "Too many uploaders" });
      }

      const access = await checkGalleryAccess(request, eventId);
      if (access !== "allowed") {
        const { status: code, body } = denied(access);
        return response.status(code).json(body);
      }

      const uploaders = await describeUploaders(getAdmin() as never, eventId, ids);
      if (!uploaders) {
        return response.status(404).json({ success: false, error: "Gallery not found." });
      }
      return response.json({ success: true, uploaders });
    } catch (error: any) {
      console.error("[BackendPermissions] Error in uploaders:", error);
      return response.status(500).json({ success: false, error: error.message });
    }
  });

  permissionsRouter.post("/update-guest-permissions", async (request, response) => {
    try {
      const { logId, permissions, requester } = request.body || {};
      if (!logId || !permissions) {
        return response.status(400).json({ error: "Missing logId or permissions" });
      }

      const access = await authorize(request, logId, requester);
      if (access !== "allowed") {
        const { status: code, body } = denied(access);
        return response.status(code).json(body);
      }

      const updateData: Record<string, boolean> = {};
      if (typeof permissions.canAdmin === "boolean") updateData.can_admin = permissions.canAdmin;
      if (typeof permissions.canUpload === "boolean") updateData.can_upload = permissions.canUpload;
      if (typeof permissions.canComment === "boolean") updateData.can_comment = permissions.canComment;

      const supabaseAdmin = getAdmin();
      const { error } = await supabaseAdmin
        .from("guests")
        .update(updateData)
        .eq("id", logId);

      if (error) throw error;
      return response.json({ success: true });
    } catch (error: any) {
      if (albumRoleBlocked(response, error)) return;
      console.error("[BackendPermissions] Error in update-guest-permissions:", error);
      return response.status(500).json({ success: false, error: error.message });
    }
  });

  return permissionsRouter;
}

export const permissionsRouter = createPermissionsRouter();
