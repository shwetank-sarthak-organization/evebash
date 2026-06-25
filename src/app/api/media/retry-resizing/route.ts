import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";

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

async function authorizeBackblaze(): Promise<BackblazeAuth> {
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
  const backblazeAuth = await authorizeBackblaze();
  const uploadUrlData = await getUploadUrl(backblazeAuth);

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

export async function GET(request: NextRequest) {
  try {
    // 1. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");

    // 2. Query photos that are missing thumbnail_url
    // Ignore extremely recent uploads (less than 1 minute old) to prevent race conditions during upload
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    const { data: photos, error: fetchError } = await supabaseAdmin
      .from("photos")
      .select("id, url, storage_key, uploaded_at")
      .is("thumbnail_url", null)
      .lt("uploaded_at", oneMinuteAgo)
      .limit(20);

    if (fetchError) throw fetchError;

    if (!photos || photos.length === 0) {
      return NextResponse.json({ message: "No failed or pending resizes found.", processed: 0 });
    }

    console.log(`[Sweeper] Found ${photos.length} photos requiring thumbnail repair.`);

    let processedCount = 0;
    const errors: any[] = [];

    for (const photo of photos) {
      const storageKey = photo.storage_key;
      const thumbnailKey = `${storageKey}-thumbnail.webp`;
      const previewKey = `${storageKey}-preview.webp`;
      const thumbnailUrl = `https://${mediaDomain}/${thumbnailKey}`;

      try {
        // A. Check if the thumbnail already exists in B2 (maybe DB update failed initially)
        const checkResponse = await fetch(thumbnailUrl, { method: "HEAD" });
        if (checkResponse.ok) {
          console.log(`[Sweeper] Thumbnail already exists in B2 for key ${storageKey}. Updating DB only.`);
          const { error: dbError } = await supabaseAdmin
            .from("photos")
            .update({ thumbnail_url: thumbnailUrl })
            .eq("id", photo.id);
          if (dbError) throw dbError;
          processedCount++;
          continue;
        }

        // B. Thumbnail does not exist. We need to download original and regenerate
        console.log(`[Sweeper] Thumbnail missing for ${storageKey}. Downloading original from: ${photo.url}`);
        const downloadResponse = await fetch(photo.url);
        if (!downloadResponse.ok) {
          throw new Error(`Failed to download original photo from ${photo.url} (status: ${downloadResponse.status})`);
        }

        const arrayBuffer = await downloadResponse.arrayBuffer();
        const bufferBytes = Buffer.from(arrayBuffer);

        // Resize
        console.log(`[Sweeper] Resizing image: ${storageKey}`);
        const thumbnailBuffer = await sharp(bufferBytes)
          .resize({ width: 400, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();

        const previewBuffer = await sharp(bufferBytes)
          .resize({ width: 900, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();

        // Upload
        console.log(`[Sweeper] Uploading generated assets to B2...`);
        await uploadBufferToB2(thumbnailBuffer, thumbnailKey, "image/webp");
        await uploadBufferToB2(previewBuffer, previewKey, "image/webp");

        // Update DB
        const { error: dbError } = await supabaseAdmin
          .from("photos")
          .update({ thumbnail_url: thumbnailUrl })
          .eq("id", photo.id);

        if (dbError) throw dbError;
        processedCount++;
        console.log(`[Sweeper] Successfully repaired photo id: ${photo.id}`);
      } catch (err: any) {
        console.error(`[Sweeper] Failed to repair photo id ${photo.id}:`, err);
        errors.push({ id: photo.id, error: err.message || String(err) });
      }
    }

    return NextResponse.json({
      message: "Resizing sweep completed.",
      processed: processedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[Sweeper] Global sweeper error:", error);
    return NextResponse.json({ error: error.message || "Sweeper failed" }, { status: 500 });
  }
}
