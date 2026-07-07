import { Buffer } from "buffer";

export type BackblazeAuth = {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl?: string;
};

export type BackblazeUploadUrl = {
  uploadUrl: string;
  authorizationToken: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

let authPromise: Promise<BackblazeAuth> | null = null;
let tokenExpiresAt = 0;

export async function getCachedBackblazeAuth(): Promise<BackblazeAuth> {
  // Check if cached promise is still valid (tokens are valid for 24 hours)
  if (authPromise && Date.now() < tokenExpiresAt) {
    return authPromise;
  }

  // Set new expiration time (23 hours from now)
  tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;

  authPromise = (async () => {
    try {
      const keyId = requireEnv("B2_KEY_ID");
      const applicationKey = requireEnv("B2_APPLICATION_KEY");
      const credentials = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");

      console.log("[B2 Auth] Authenticating with Backblaze API...");
      const response = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Backblaze authorization failed with status ${response.status}`);
      }

      const data = await response.json();
      return {
        authorizationToken: data.authorizationToken,
        apiUrl: data.apiInfo.storageApi.apiUrl,
        downloadUrl: data.apiInfo.storageApi.downloadUrl,
      };
    } catch (err) {
      // Reset on failure so the next upload request can retry
      authPromise = null;
      tokenExpiresAt = 0;
      throw err;
    }
  })();

  return authPromise;
}

let cachedUploadUrlPromise: Promise<BackblazeUploadUrl> | null = null;
let uploadUrlExpiresAt = 0;

export async function getUploadUrl(auth: BackblazeAuth): Promise<BackblazeUploadUrl> {
  const bucketId = requireEnv("B2_BUCKET_ID");
  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId }),
  });

  if (!response.ok) {
    throw new Error(`Backblaze upload URL request failed with status ${response.status}`);
  }

  return response.json();
}

export async function getCachedUploadUrl(auth: BackblazeAuth, forceRefresh = false): Promise<BackblazeUploadUrl> {
  if (forceRefresh) {
    cachedUploadUrlPromise = null;
    uploadUrlExpiresAt = 0;
  }

  if (cachedUploadUrlPromise && Date.now() < uploadUrlExpiresAt) {
    return cachedUploadUrlPromise;
  }

  // Cache for 10 minutes (standard batch duration)
  uploadUrlExpiresAt = Date.now() + 10 * 60 * 1000;

  cachedUploadUrlPromise = (async () => {
    try {
      return await getUploadUrl(auth);
    } catch (err) {
      cachedUploadUrlPromise = null;
      uploadUrlExpiresAt = 0;
      throw err;
    }
  })();

  return cachedUploadUrlPromise;
}
