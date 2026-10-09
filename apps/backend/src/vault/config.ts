// EB Vault settings. Plan storage itself comes from the pricing plans (events and Vault share it);
// everything Vault-specific that you may want to tune lives here.
const MB = 1024 * 1024;
const GB = 1024 * MB;

export const vaultConfig = {
  /** Largest single file a user may upload, by plan type. */
  maxFileBytes: { free: 200 * MB, paid: 5 * GB },
  /** Days an item stays in Trash before it is permanently deleted. */
  trashRetentionDays: 30,
  /** Unfinished uploads are cancelled and their reserved space released after this long. */
  uploadExpiryHours: 24,
  /** Files larger than this upload in parts, straight from the browser to storage. */
  multipartThresholdBytes: 64 * MB,
  minPartBytes: 16 * MB,
  maxParts: 10_000,
  /** Lifetime of signed upload, view and download links. */
  uploadLinkTtlSeconds: 60 * 60,
  downloadLinkTtlSeconds: 5 * 60,
  /** Plan expiry lifecycle, counted from the plan's end date (shared with event media). */
  graceDays: 7,
  deletionAfterDays: 30,
  expiredRetainedBytes: 1 * GB,
  /** Types the browser may display inline. Anything else is always served as a download. */
  inlineMimeTypes: new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "application/pdf",
    "text/plain",
    "text/csv",
  ]),
  pageSize: 500,
  searchLimit: 100,
  recentLimit: 100,
};

export type VaultBucketSettings = {
  bucket: string;
  endpoint: string;
  region: string;
  keyId: string;
  applicationKey: string;
};

/** The private Vault bucket. Separate from the event-media bucket and its public media proxy. */
export function getVaultBucketSettings(env: NodeJS.ProcessEnv = process.env): VaultBucketSettings | null {
  const bucket = env.VAULT_B2_BUCKET?.trim();
  const endpoint = env.VAULT_B2_S3_ENDPOINT?.trim();
  const region = env.VAULT_B2_REGION?.trim();
  const keyId = env.VAULT_B2_KEY_ID?.trim();
  const applicationKey = env.VAULT_B2_APPLICATION_KEY?.trim();
  if (!bucket || !endpoint || !region || !keyId || !applicationKey) return null;
  return {
    bucket,
    endpoint: endpoint.startsWith("http") ? endpoint : `https://${endpoint}`,
    region,
    keyId,
    applicationKey,
  };
}

/** Vault stays off unless explicitly enabled and the bucket is configured. */
export function isVaultEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.VAULT_ENABLED?.trim().toLowerCase() === "true" && getVaultBucketSettings(env) !== null;
}
