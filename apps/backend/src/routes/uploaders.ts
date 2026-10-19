import type { Request } from "express";
import { verifySupabaseUser } from "../auth.js";
import { openGalleryAccessAsCaller } from "./notifications.js";

type AdminClient = NonNullable<Awaited<ReturnType<typeof verifySupabaseUser>>>["supabaseAdmin"];

export type UploaderRole = "owner" | "admin" | "guest" | "former_guest" | "deleted" | "anonymous";
export type Uploader = { userId: string; name: string; role: UploaderRole };

export const MAX_UPLOADER_IDS = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether the signed-in caller manages this gallery (owner, guest admin or platform admin), as the database sees it. */
export async function checkGalleryManageAccess(
  request: Request,
  eventId: string,
  verifyUser = verifySupabaseUser,
  galleryAccess = openGalleryAccessAsCaller,
): Promise<"allowed" | "login" | "forbidden"> {
  const verified = await verifyUser(request);
  if (!verified) return "login";
  return (await galleryAccess(request, eventId)) === "manage" ? "allowed" : "forbidden";
}

/**
 * Names and roles of the people who uploaded media to a gallery, for the host's "Uploaded by" filter. Roles are
 * relative to the top-level event: its owner, approved guests with admin, approved guests, people who are no longer
 * members (former guests), accounts that no longer exist, and anonymous uploads.
 */
export async function describeUploaders(supabaseAdmin: AdminClient, eventId: string, userIds: string[]): Promise<Uploader[] | null> {
  const columns = "id, parent_id, legacy_id, created_by";
  const { data: gallery } = await supabaseAdmin.from("events").select(columns).eq("id", eventId).maybeSingle();
  if (!gallery) return null;
  let root = gallery;
  if (gallery.parent_id) {
    for (const column of ["id", "legacy_id"]) {
      const { data } = await supabaseAdmin.from("events").select(columns).eq(column, gallery.parent_id).maybeSingle();
      if (data) {
        root = data;
        break;
      }
    }
  }

  const accountIds = userIds.filter((id) => UUID.test(id));
  const [{ data: profiles }, { data: guests }] = await Promise.all([
    accountIds.length > 0
      ? supabaseAdmin.from("profiles").select("id, name, email").in("id", accountIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null }[] }),
    accountIds.length > 0
      ? supabaseAdmin.from("guests").select("user_id, status, can_admin")
        .in("event_id", [root.id, root.legacy_id].filter(Boolean) as string[])
        .in("user_id", accountIds)
      : Promise.resolve({ data: [] as { user_id: string; status: string; can_admin: boolean | null }[] }),
  ]);
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const membership = new Map<string, "admin" | "guest">();
  for (const guest of guests || []) {
    if (guest.status !== "approved") continue;
    if (guest.can_admin) membership.set(guest.user_id, "admin");
    else if (!membership.has(guest.user_id)) membership.set(guest.user_id, "guest");
  }

  return userIds.map((userId): Uploader => {
    if (userId === "anonymous") return { userId, name: "Anonymous", role: "anonymous" };
    const profile = profileById.get(userId);
    const isOwner = root.created_by === userId || (!!profile?.email && root.created_by === profile.email);
    const name = profile?.name?.trim() || profile?.email?.split("@")[0] || (profile ? "Guest" : "Deleted user");
    if (isOwner) return { userId, name, role: "owner" };
    if (!profile) return { userId, name, role: "deleted" };
    return { userId, name, role: membership.get(userId) ?? "former_guest" };
  });
}
