import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publishModalBatchTask } from "@/lib/qstash";

export const runtime = "edge";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function POST() {
  try {
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

    // 1. Fetch photos that have a preview (resizing is complete) but haven't been sent to Modal
    // Note: This requires a `face_indexed` boolean column on the `photos` table in Supabase.
    // Default value should be FALSE.
    const { data: pendingPhotos, error } = await supabaseAdmin
      .from("photos")
      .select("id, url, thumbnail_url, uploaded_at")
      .not("thumbnail_url", "is", null) // Ensure resizing finished
      .eq("face_indexed", false)
      .eq("media_type", "photo"); // Only process photos, not videos

    if (error) {
      console.error("[Modal Batcher] Error fetching pending photos:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!pendingPhotos || pendingPhotos.length === 0) {
      console.log("[Modal Batcher] No pending photos found. Skipping batch run.");
      return NextResponse.json({ success: true, message: "No pending photos" });
    }

    // Cost Optimization: "Size OR Time" Logic
    const BATCH_SIZE_THRESHOLD = 50;
    const MAX_WAIT_TIME_MS = 5 * 60 * 1000; // 5 minutes

    const now = new Date().getTime();
    const oldestPhoto = pendingPhotos.reduce((oldest, p) => {
      const pTime = new Date(p.uploaded_at).getTime();
      const oldestTime = new Date(oldest.uploaded_at).getTime();
      return pTime < oldestTime ? p : oldest;
    }, pendingPhotos[0]);

    const oldestAgeMs = now - new Date(oldestPhoto.uploaded_at).getTime();

    if (pendingPhotos.length < BATCH_SIZE_THRESHOLD && oldestAgeMs < MAX_WAIT_TIME_MS) {
      console.log(`[Modal Batcher] Only ${pendingPhotos.length} photos ready. Oldest is ${Math.round(oldestAgeMs/1000)}s old. Waiting for ${BATCH_SIZE_THRESHOLD} photos or 5 mins to save Modal costs.`);
      return NextResponse.json({ success: true, message: "Waiting for larger batch to optimize costs" });
    }

    console.log(`[Modal Batcher] Found ${pendingPhotos.length} photos ready for face indexing (Cost Optimization Criteria Met).`);

    // 2. Extract preview URLs (assuming preview URL is determinable or just send thumbnail)
    // In our architecture, previewUrl is `${storageKey}-preview.webp`. 
    // Since we don't store preview_url explicitly, we can construct it from thumbnail_url
    const previewUrls = pendingPhotos.map(p => {
      if (p.thumbnail_url) {
        return p.thumbnail_url.replace("-thumbnail.webp", "-preview.webp");
      }
      return p.url; // Fallback to original if something is weird
    });

    // 3. Publish massive batch to Modal via QStash
    const success = await publishModalBatchTask(previewUrls);

    if (!success) {
      throw new Error("Failed to publish batch to QStash");
    }

    // 4. Mark these photos as `face_indexed = true` so we don't process them again
    // If Modal fails, we rely on QStash's automatic retries for this specific message.
    const photoIds = pendingPhotos.map(p => p.id);
    const { error: updateError } = await supabaseAdmin
      .from("photos")
      .update({ face_indexed: true })
      .in("id", photoIds);

    if (updateError) {
      console.error("[Modal Batcher] Warning: Failed to update face_indexed flag:", updateError);
      // We don't fail the request here, but it means they might be batched again next minute
    }

    console.log(`[Modal Batcher] Successfully batched and dispatched ${previewUrls.length} photos.`);
    return NextResponse.json({ success: true, count: previewUrls.length });
  } catch (error: any) {
    console.error("[Modal Batcher] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
