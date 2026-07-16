import { NextRequest, NextResponse } from "next/server";
import { getCachedBackblazeAuth, BackblazeAuth } from "@/lib/backblaze";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";
// Allow long execution for large images
export const maxDuration = 120;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

// Global in-memory semaphore to limit concurrent image processing (Sharp resizing).
// Setting limit to 3 keeps Railway CPU cool, prevents OOM spikes, and provides smooth, sequential execution.
let activeResizes = 0;
const MAX_CONCURRENT_RESIZES = 3;
const queue: (() => void)[] = [];

async function acquireLock() {
  if (activeResizes < MAX_CONCURRENT_RESIZES) {
    activeResizes++;
    return;
  }
  return new Promise<void>((resolve) => {
    queue.push(resolve);
  });
}

function releaseLock() {
  activeResizes--;
  const next = queue.shift();
  if (next) {
    activeResizes++;
    next();
  }
}

// Ensure QStash signature verification for security in production
export async function POST(request: NextRequest) {
  let hasLock = false;
  let currentStorageKey = "unknown";
  
  try {
    const body = await request.json().catch(() => ({}));
    const { storageKey } = body;
    currentStorageKey = storageKey || "unknown";

    if (!storageKey) {
      return NextResponse.json({ error: "Missing storageKey" }, { status: 400 });
    }

    console.log(`[Process Thumbnail] Queued background job for: ${storageKey} (Queue size: ${queue.length}, Active: ${activeResizes})`);
    
    // Acquire lock (blocks if activeResizes >= 3)
    await acquireLock();
    hasLock = true;
    console.log(`[Process Thumbnail] Acquired lock for: ${storageKey} (Active: ${activeResizes})`);

    const supabaseAdmin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const backblazeAuth = await getCachedBackblazeAuth();
    const bucketId = requireEnv("B2_BUCKET_ID");
    const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");

    // 1. Download the original high-res image from B2
    const encodedStorageKey = storageKey.split('/').map(encodeURIComponent).join('/');
    const downloadUrl = `${backblazeAuth.downloadUrl}/file/${requireEnv("B2_BUCKET_NAME")}/${encodedStorageKey}`;
    console.log(`[Process Thumbnail] Downloading from B2: ${downloadUrl}`);
    
    const downloadResponse = await fetch(downloadUrl, {
      headers: { Authorization: backblazeAuth.authorizationToken }
    });

    if (!downloadResponse.ok) {
      throw new Error(`Failed to download from B2: ${downloadResponse.status} ${downloadResponse.statusText}`);
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    const bufferBytes = Buffer.from(arrayBuffer);

    console.log(`[Process Thumbnail] Successfully downloaded ${bufferBytes.length} bytes for ${storageKey}. Starting sharp processing...`);

    // 2. Extract original dimensions for the DB (using .rotate() first to apply EXIF orientation swap)
    const metadata = await sharp(bufferBytes).rotate().metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    // 3. Generate Thumbnail and Preview buffers
    const thumbnailBuffer = await sharp(bufferBytes)
      .rotate()
      .resize({ width: 400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const previewBuffer = await sharp(bufferBytes)
      .rotate()
      .resize({ width: 3000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    // 4. Upload BOTH thumbnail and preview to B2 atomically.
    // If either upload fails, we throw an error → QStash will automatically retry the whole job.
    // We never update the DB unless both files are safely in B2.
    const thumbnailKey = `${storageKey}-thumbnail.webp`;
    const previewKey = `${storageKey}-preview.webp`;
    const thumbnailUrl = `https://${mediaDomain}/${thumbnailKey}`;
    const previewUrl = `https://${mediaDomain}/${previewKey}`;

    async function uploadBufferToB2(buffer: Buffer, key: string, contentType: string) {
      // Re-fetch upload URL because they expire quickly
      const uploadUrlResponse = await fetch(`${backblazeAuth.apiUrl}/b2api/v3/b2_get_upload_url`, {
        method: "POST",
        headers: { Authorization: backblazeAuth.authorizationToken },
        body: JSON.stringify({ bucketId }),
      });
      if (!uploadUrlResponse.ok) throw new Error("Failed to get B2 upload URL");
      const uploadUrlData = await uploadUrlResponse.json();

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
        throw new Error(`B2 upload failed for key ${key}`);
      }
      return (await uploadResponse.json()).fileId;
    }

    console.log(`[Process Thumbnail] Uploading thumbnail to B2...`);
    await uploadBufferToB2(thumbnailBuffer, thumbnailKey, "image/webp");

    console.log(`[Process Thumbnail] Uploading preview to B2...`);
    try {
      await uploadBufferToB2(previewBuffer, previewKey, "image/webp");
    } catch (previewErr) {
      // Preview upload failed — do NOT save anything to DB.
      // Return 500 so QStash retries the entire job (thumbnail will just be overwritten on retry).
      console.error(`[Process Thumbnail] Preview upload failed for ${storageKey}. Aborting DB update. QStash will retry.`, previewErr);
      throw previewErr;
    }

    // Both uploads succeeded — now it is safe to update the DB.
    // 5. Update Database Record with both URLs
    let updated = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const { data, error: dbError } = await supabaseAdmin
        .from("photos")
        .update({ 
          thumbnail_url: thumbnailUrl,
          width: originalWidth,
          height: originalHeight
        })
        .eq("storage_key", storageKey)
        .select();

      if (dbError) throw dbError;

      if (data && data.length > 0) {
        console.log(`[Process Thumbnail] Successfully updated database record in attempt ${attempt}`);
        updated = true;
        break;
      }
      if (attempt < 4) {
        console.log(`[Process Thumbnail] Row not found yet, sleeping 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!updated) {
      console.warn(`[Process Thumbnail] Database row not found matching storage_key "${storageKey}".`);
      return NextResponse.json({ error: "Database row not found" }, { status: 404 });
    }

    console.log(`[Process Thumbnail] Job finished successfully for ${storageKey}`);
    return NextResponse.json({ success: true, thumbnailUrl, previewUrl });

  } catch (error: unknown) {
    console.error("[Process Thumbnail] Failed:", error);
    const errMessage = error instanceof Error ? error.message : "Processing failed";
    // Returning 500 causes QStash to automatically retry this job
    return NextResponse.json({ error: errMessage }, { status: 500 });
  } finally {
    if (hasLock) {
      releaseLock();
      console.log(`[Process Thumbnail] Released lock for: ${currentStorageKey} (Active: ${activeResizes})`);
    }
  }
}
