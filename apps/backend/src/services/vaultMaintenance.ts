import { vaultConfig } from "../vault/config.js";
import type { VaultRepository } from "../vault/repository.js";
import type { VaultStorage } from "../vault/storage.js";

const BATCH = 200;

/** Removes stored files that no Vault item references any more (after permanent delete or account deletion). */
export async function deletePendingObjects(repo: VaultRepository, storage: VaultStorage) {
  let deleted = 0;
  for (const object of await repo.listDeletableObjects(BATCH)) {
    if (object.bucket !== storage.bucket) continue;
    await storage.deleteObject(object.objectKey);
    await repo.deleteObjectRow(object.id);
    deleted += 1;
  }
  return deleted;
}

/** Cancels uploads that were started but never finished, releasing their reserved storage. */
export async function releaseExpiredUploads(repo: VaultRepository, storage: VaultStorage) {
  let released = 0;
  for (const { id } of await repo.listExpiredUploads(BATCH)) {
    const upload = await repo.releaseUpload(null, id, "expired");
    if (!upload) continue;
    if (upload.multipartUploadId) await storage.abortMultipartUpload(upload.objectKey, upload.multipartUploadId).catch(() => null);
    await storage.deleteObject(upload.objectKey).catch(() => null);
    released += 1;
  }
  return released;
}

export async function runVaultMaintenance(repo: VaultRepository, storage: VaultStorage) {
  const expiredUploads = await releaseExpiredUploads(repo, storage);
  const purgedTrash = await repo.purgeExpiredTrash(vaultConfig.trashRetentionDays, 500);
  const deletedObjects = await deletePendingObjects(repo, storage);
  return { expiredUploads, purgedTrash, deletedObjects };
}

/** Hourly, like the media watchdog. VAULT_MAINTENANCE_ENABLED=false turns it off. */
export function startVaultMaintenanceScheduler(run: () => Promise<unknown>, setting = process.env.VAULT_MAINTENANCE_ENABLED): () => void {
  if (setting?.trim().toLowerCase() === "false") {
    console.log("[VaultMaintenance] Disabled (VAULT_MAINTENANCE_ENABLED=false)");
    return () => {};
  }
  const tick = (context: string) => run()
    .then((result) => console.log(`[VaultMaintenance] ${context} run`, result))
    .catch((error) => console.error(`[VaultMaintenance] ${context} run failed:`, error));
  const interval = setInterval(() => void tick("Scheduled"), 60 * 60 * 1000);
  const startup = setTimeout(() => void tick("Startup"), 60 * 1000);
  return () => {
    clearInterval(interval);
    clearTimeout(startup);
  };
}
