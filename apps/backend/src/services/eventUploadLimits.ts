import { getSupabaseAdminClient } from "../supabase.js";
import { getStorageContext, type VaultUser } from "../vault/access.js";
import { createSupabaseVaultRepository, type VaultRepository } from "../vault/repository.js";

/**
 * Plan storage for gallery uploads, checked on the server before an upload link is handed out (issue #6).
 * The gallery's owner pays: every upload to a gallery counts towards its owner's plan, whoever uploads it, and it
 * shares one pool with the owner's EB Vault (same rules as Vault: getStorageContext). Uploads pause while the owner's
 * paid plan is expired. Off until EVENT_UPLOAD_LIMITS=true, so it can be switched on (and off) without a deploy.
 */
export function isEventUploadLimitEnabled() {
  return process.env.EVENT_UPLOAD_LIMITS?.trim().toLowerCase() === "true";
}

// Same allowance the website uses for the HLS streaming copies made from a video
export const VIDEO_STORAGE_FACTOR = 1.35;

export type EventUploadDecision =
  | { allowed: true }
  | { allowed: false; code: "storage_full" | "plan_expired"; error: string };

type FindOwner = (eventId: string) => Promise<VaultUser | null>;

/** The profile that owns the gallery (a sub-gallery's main gallery), as id/email/phone; null if unknown. */
export async function findGalleryOwner(eventId: string): Promise<VaultUser | null> {
  const db = getSupabaseAdminClient();
  const { data: event } = await db.from("events").select("id, parent_id, created_by").eq("id", eventId).maybeSingle();
  if (!event) return null;
  let ownerRef = event.created_by as string | null;
  if (event.parent_id) {
    const { data: root } = await db.from("events").select("created_by").eq("id", event.parent_id).maybeSingle();
    ownerRef = (root?.created_by as string | null) || ownerRef;
  }
  if (!ownerRef) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("id, email, phone")
    .eq(ownerRef.includes("@") ? "email" : "id", ownerRef)
    .maybeSingle();
  return profile ? { id: String(profile.id), email: profile.email, phone: profile.phone } : null;
}

const formatGb = (bytes: number) => `${(Math.max(bytes, 0) / (1024 * 1024 * 1024)).toFixed(2)} GB`;

export async function checkEventUpload(
  params: { eventId: string; uploaderId: string; bytes: number; isVideo: boolean },
  deps: { repo?: VaultRepository; findOwner?: FindOwner; now?: Date } = {},
): Promise<EventUploadDecision> {
  const owner = await (deps.findOwner ?? findGalleryOwner)(params.eventId);
  if (!owner) return { allowed: true };

  const context = await getStorageContext(deps.repo ?? createSupabaseVaultRepository(), owner, deps.now);
  if (context.limitBytes === null) return { allowed: true };
  const isOwner = params.uploaderId === owner.id;

  if (context.uploadsBlocked === "plan_expired") {
    return {
      allowed: false,
      code: "plan_expired",
      error: isOwner
        ? "Uploads are paused because your plan has expired. Renew your plan to upload again."
        : "This gallery can't take new uploads right now. Ask the host to renew their plan.",
    };
  }

  const used = context.eventBytes + context.vaultUsedBytes + context.vaultReservedBytes;
  const needed = Math.ceil(Math.max(params.bytes || 0, 0) * (params.isVideo ? VIDEO_STORAGE_FACTOR : 1));
  if (used >= context.limitBytes || used + needed > context.limitBytes) {
    const left = context.limitBytes - used;
    return {
      allowed: false,
      code: "storage_full",
      error: isOwner
        ? left > 0
          ? `This upload needs more storage than your plan has left (${formatGb(left)}). Free up space or upgrade your plan.`
          : "You've reached your plan's storage limit. Free up space or upgrade your plan to upload more."
        : "This gallery is out of storage. Ask the host to free up space or upgrade their plan.",
    };
  }
  return { allowed: true };
}
