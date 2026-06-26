import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds — prevent Vercel timeout on large images


type BackblazeAuth = {
  authorizationToken: string;
  apiUrl: string;
};

type BackblazeUploadUrl = {
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

// Memory cache for Backblaze authorization token
let cachedAuth: { token: string; apiUrl: string; expiresAt: number } | null = null;

async function getCachedBackblazeAuth(): Promise<BackblazeAuth> {
  // Check cache (tokens are valid for 24 hours, cache for 23 hours)
  if (cachedAuth && Date.now() < cachedAuth.expiresAt) {
    return {
      authorizationToken: cachedAuth.token,
      apiUrl: cachedAuth.apiUrl,
    };
  }

  const keyId = requireEnv("B2_KEY_ID");
  const applicationKey = requireEnv("B2_APPLICATION_KEY");
  const credentials = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");

  const response = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Backblaze authorization failed with ${response.status}`);
  }

  const data = await response.json();
  cachedAuth = {
    token: data.authorizationToken,
    apiUrl: data.apiInfo.storageApi.apiUrl,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  };

  return {
    authorizationToken: data.authorizationToken,
    apiUrl: data.apiInfo.storageApi.apiUrl,
  };
}

async function getUploadUrl(auth: BackblazeAuth): Promise<BackblazeUploadUrl> {
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
    throw new Error(`Backblaze upload URL request failed with ${response.status}`);
  }

  return response.json();
}

async function uploadBufferToB2(buffer: Buffer, key: string, contentType: string) {
  const auth = await getCachedBackblazeAuth();
  const uploadUrlData = await getUploadUrl(auth);

  const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: uploadUrlData.authorizationToken,
      "Content-Type": contentType,
      "X-Bz-File-Name": encodeURIComponent(key),
      "X-Bz-Content-Sha1": "do_not_verify",
    },
    body: buffer as any,
  });

  if (!uploadResponse.ok) {
    throw new Error(`B2 upload failed for key ${key} with status ${uploadResponse.status}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // No auth check needed — this endpoint is only reachable via QStash.
    // QStash requires your secret QSTASH_TOKEN to publish messages, so
    // only QStash can trigger this worker.

    // 2. Parse request payload
    const body = await request.json().catch(() => ({}));
    const { storageKey } = body;

    if (!storageKey) {
      return NextResponse.json({ error: "Missing storageKey in payload" }, { status: 400 });
    }

    console.log(`[Resize Worker] Processing image resizing for: ${storageKey}`);

    // 3. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const originalUrl = `https://${mediaDomain}/${storageKey}`;

    // 4. Download original file from B2
    console.log(`[Resize Worker] Downloading original file: ${originalUrl}`);
    const downloadResponse = await fetch(originalUrl);
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download original image from ${originalUrl} (status: ${downloadResponse.status})`);
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    const bufferBytes = Buffer.from(arrayBuffer);

    // 5. Generate resized WebP buffers
    console.log(`[Resize Worker] Resizing and converting to WebP...`);
    const thumbnailBuffer = await sharp(bufferBytes)
      .resize({ width: 400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const previewBuffer = await sharp(bufferBytes)
      .resize({ width: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    // 6. Upload generated buffers to B2
    const thumbnailKey = `${storageKey}-thumbnail.webp`;
    const previewKey = `${storageKey}-preview.webp`;
    const thumbnailUrl = `https://${mediaDomain}/${thumbnailKey}`;

    console.log(`[Resize Worker] Uploading generated assets to B2...`);
    await uploadBufferToB2(thumbnailBuffer, thumbnailKey, "image/webp");
    await uploadBufferToB2(previewBuffer, previewKey, "image/webp");

    // 7. Update database record — match by storage_key, not a derived ID
    console.log(`[Resize Worker] Updating database record for storage_key: ${storageKey}`);

    const { error: dbError } = await supabaseAdmin
      .from("photos")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("storage_key", storageKey);

    if (dbError) {
      throw dbError;
    }

    console.log(`[Resize Worker] Successfully finished resizing for key: ${storageKey}`);
    return NextResponse.json({ success: true, message: "Image resized successfully", thumbnailUrl });
  } catch (error: any) {
    console.error("[Resize Worker] Resizing process failed:", error);
    return NextResponse.json({ error: error.message || "Resizing failed" }, { status: 500 });
  }
}
