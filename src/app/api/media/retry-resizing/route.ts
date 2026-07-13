import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { getCachedBackblazeAuth, getUploadUrl } from "@/lib/backblaze";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

async function uploadBufferToB2(buffer: Buffer, key: string, contentType: string) {
  const backblazeAuth = await getCachedBackblazeAuth();
  const uploadUrlData = await getUploadUrl(backblazeAuth);

  const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: uploadUrlData.authorizationToken,
      "Content-Type": contentType,
      "X-Bz-File-Name": encodeURIComponent(key),
      "X-Bz-Content-Sha1": "do_not_verify",
      "Content-Length": String(buffer.length),
    },
    body: buffer as unknown as BodyInit,
  });

  if (!uploadResponse.ok) {
    throw new Error(`B2 upload failed for key ${key} with status ${uploadResponse.status}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    // 0. Optional CRON_SECRET authorization check
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const urlSecret = request.nextUrl.searchParams.get("secret");
      if (
        authHeader !== `Bearer ${cronSecret}` &&
        urlSecret !== cronSecret
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 1. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");

    // 2. Query photos that are missing thumbnail_url
    const key = request.nextUrl.searchParams.get("key");
    let photos;
    let fetchError;

    if (key) {
      // If a specific storage key is requested, fetch only that photo (skip age filter)
      const { data, error } = await supabaseAdmin
        .from("photos")
        .select("id, url, storage_key, uploaded_at")
        .eq("storage_key", key)
        .limit(1);
      photos = data;
      fetchError = error;
    } else {
      // Otherwise, sweep photos missing thumbnail_url
      // Ignore extremely recent uploads (less than 1 minute old) to prevent race conditions during upload
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      const { data, error } = await supabaseAdmin
        .from("photos")
        .select("id, url, storage_key, uploaded_at")
        .is("thumbnail_url", null)
        .lt("uploaded_at", oneMinuteAgo)
        .limit(20);
      photos = data;
      fetchError = error;
    }

    if (fetchError) throw fetchError;

    if (!photos || photos.length === 0) {
      return NextResponse.json({ message: "No failed or pending resizes found.", processed: 0 });
    }

    console.log(`[Sweeper] Found ${photos.length} photos requiring thumbnail repair.`);

    let processedCount = 0;
    const errors: { id: string; error: string }[] = [];

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
        console.log(`[Sweeper] Thumbnail missing for ${storageKey}. Downloading original from B2 file API...`);
        const backblazeAuth = await getCachedBackblazeAuth();
        const downloadUrl = `${backblazeAuth.downloadUrl}/file/${requireEnv("B2_BUCKET_NAME")}/${storageKey}`;
        const downloadResponse = await fetch(downloadUrl, {
          headers: { Authorization: backblazeAuth.authorizationToken }
        });
        if (!downloadResponse.ok) {
          if (downloadResponse.status === 404) {
            console.warn(`[Sweeper] Original file missing from B2 (404). Deleting ghost database record for: ${photo.id}`);
            await supabaseAdmin.from("photos").delete().eq("id", photo.id);
            continue;
          }
          throw new Error(`Failed to download original photo from B2: ${downloadResponse.status} ${downloadResponse.statusText}`);
        }

        const arrayBuffer = await downloadResponse.arrayBuffer();
        const bufferBytes = Buffer.from(arrayBuffer);

        // Resize
        console.log(`[Sweeper] Resizing image: ${storageKey}`);
        const thumbnailBuffer = await sharp(bufferBytes)
          .rotate()
          .resize({ width: 400, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();

        const previewBuffer = await sharp(bufferBytes)
          .rotate()
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
      } catch (err: unknown) {
        console.error(`[Sweeper] Failed to repair photo id ${photo.id}:`, err);
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push({ id: photo.id, error: errMsg });
      }
    }

    return NextResponse.json({
      message: "Resizing sweep completed.",
      processed: processedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error("[Sweeper] Global sweeper error:", error);
    const errMessage = error instanceof Error ? error.message : "Sweeper failed";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
