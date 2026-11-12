import { getSupabaseAdminClient } from "../supabase.js";
import { getStorageContext, ownerIdentifiers, type VaultUser } from "../vault/access.js";
import { getPlanEventLimit } from "../vault/lifecycle.js";
import { createSupabaseVaultRepository, type VaultRepository } from "../vault/repository.js";

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

export type TransferBlock = "plan_expired" | "needs_space" | "no_event_slot";

export type ReceiverCapacity = {
  canAccept: boolean;
  block: TransferBlock | null;
  /** Bytes the event counts for. */
  neededBytes: number;
  /** Bytes free on the receiver's plan; null = unlimited (platform admin). */
  freeBytes: number | null;
};

async function countOwnEvents(admin: AdminClient, user: VaultUser) {
  const { count, error } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .in("created_by", ownerIdentifiers(user))
    .eq("type", "main");
  if (error) throw error;
  return count ?? 0;
}

/**
 * Whether a user can take on an event of this size: an active plan, enough free space (events plus EB Vault, the same
 * sum the storage meter and upload limits use) and a free event slot. Checked when a request is made, shown to the
 * receiver, and checked again when they accept.
 */
export async function checkReceiverCapacity(
  user: VaultUser,
  neededBytes: number,
  deps: { repo?: VaultRepository; countEvents?: (user: VaultUser) => Promise<number>; now?: Date } = {},
): Promise<ReceiverCapacity> {
  const context = await getStorageContext(deps.repo ?? createSupabaseVaultRepository(), user, deps.now);
  const freeBytes = context.limitBytes === null
    ? null
    : Math.max(context.limitBytes - context.eventBytes - context.vaultUsedBytes - context.vaultReservedBytes, 0);
  const result = (block: TransferBlock | null): ReceiverCapacity => ({ canAccept: block === null, block, neededBytes, freeBytes });

  if (context.lifecycle.state !== "active") return result("plan_expired");
  if (freeBytes !== null && neededBytes > freeBytes) return result("needs_space");

  const eventLimit = getPlanEventLimit(context.lifecycle.role);
  if (eventLimit !== null) {
    const ownEvents = await (deps.countEvents ?? ((target) => countOwnEvents(getSupabaseAdminClient(), target)))(user);
    if (ownEvents >= eventLimit) return result("no_event_slot");
  }
  return result(null);
}

/** The top-level event a gallery belongs to (a sub-gallery may point at its parent's legacy id). */
export async function findRootEvent(admin: AdminClient, eventId: string) {
  const columns = "id, title, parent_id, legacy_id, created_by, type";
  const { data: gallery, error } = await admin.from("events").select(columns).eq("id", eventId).maybeSingle();
  if (error) throw error;
  if (!gallery) return null;
  if (!gallery.parent_id) return gallery;
  for (const column of ["id", "legacy_id"]) {
    const { data: parent, error: parentError } = await admin.from("events").select(columns).eq(column, gallery.parent_id).maybeSingle();
    if (parentError) throw parentError;
    if (parent) return parent;
  }
  return gallery;
}

/**
 * Uploads pause while an event is waiting to change hands, so it can't outgrow the space that was checked. If the
 * check fails (for example before the migration is applied), uploads carry on.
 */
export async function isEventTransferPending(eventId: string, getAdmin: () => AdminClient = getSupabaseAdminClient) {
  try {
    const admin = getAdmin();
    const root = await findRootEvent(admin, eventId);
    if (!root) return false;
    const { data, error } = await admin
      .from("event_transfers")
      .select("id, expires_at")
      .eq("event_id", root.id)
      .eq("status", "pending")
      .maybeSingle();
    if (error) throw error;
    return !!data && new Date(data.expires_at).getTime() > Date.now();
  } catch (error) {
    console.warn("[EventTransfers] Could not check for a pending transfer; allowing the upload:", error);
    return false;
  }
}
