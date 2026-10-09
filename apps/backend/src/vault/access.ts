import { vaultConfig } from "./config.js";
import { getPlanLifecycle, maxFileBytesFor, type PlanLifecycle } from "./lifecycle.js";
import type { VaultRepository } from "./repository.js";

export type VaultUser = { id: string; email?: string | null; phone?: string | null };

export type StorageContext = {
  lifecycle: PlanLifecycle;
  /** Plan-wide limit shared by events and Vault; null = unlimited. */
  limitBytes: number | null;
  eventBytes: number;
  vaultUsedBytes: number;
  vaultReservedBytes: number;
  maxFileBytes: number;
  uploadsBlocked: null | "plan_expired" | "storage_full";
  /** Set only while a paid plan is expired: Vault items inside the retained oldest 1 GB. */
  retainedItemIds: Set<string> | null;
};

/** Event media rows are keyed by user id, email or phone, depending on how they were uploaded. */
export function ownerIdentifiers(user: VaultUser) {
  return [user.id, user.email, user.phone].filter((value): value is string => Boolean(value));
}

export async function getStorageContext(repo: VaultRepository, user: VaultUser, now = new Date()): Promise<StorageContext> {
  const identifiers = ownerIdentifiers(user);
  const [profile, eventBytes, account] = await Promise.all([
    repo.getProfile(user.id),
    repo.getEventStorageBytes(identifiers),
    repo.getAccount(user.id),
  ]);
  const lifecycle = getPlanLifecycle({ role: profile.role, planEndDate: profile.planEndDate, now });
  const limitBytes = lifecycle.planBytes;
  const total = eventBytes + account.usedBytes + account.reservedBytes;

  const retainedItemIds = lifecycle.state === "active"
    ? null
    : await repo.getRetainedItemIds(user.id, identifiers, vaultConfig.expiredRetainedBytes);

  return {
    lifecycle,
    limitBytes,
    eventBytes,
    vaultUsedBytes: account.usedBytes,
    vaultReservedBytes: account.reservedBytes,
    maxFileBytes: maxFileBytesFor(lifecycle),
    uploadsBlocked: lifecycle.state !== "active"
      ? "plan_expired"
      : limitBytes !== null && total >= limitBytes ? "storage_full" : null,
    retainedItemIds,
  };
}

/**
 * During grace everything stays reachable (items outside the retained 1 GB are only flagged).
 * From day 7 those items are hidden: not listed, previewed or downloadable until the plan is renewed.
 */
export function isItemHidden(context: StorageContext, itemId: string) {
  if (!context.retainedItemIds) return false;
  if (context.lifecycle.state === "grace") return false;
  return !context.retainedItemIds.has(itemId);
}

export function isItemAtRisk(context: StorageContext, itemId: string) {
  return context.retainedItemIds !== null && !context.retainedItemIds.has(itemId);
}
