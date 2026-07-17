import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Force dynamic execution since we fetch real-time DB counts
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase configuration env variables.");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId parameter" }, { status: 400 });
    }

    // 1. Get total number of photos for the event
    const { count: totalPhotos, error: totalErr } = await supabaseAdmin
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("media_type", "photo");

    if (totalErr) throw totalErr;

    // 2. Get count of photos that are fully indexed
    const { count: indexedPhotos, error: indexedErr } = await supabaseAdmin
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("media_type", "photo")
      .eq("face_indexed", true);

    if (indexedErr) throw indexedErr;

    const total = totalPhotos || 0;
    const indexed = indexedPhotos || 0;
    const pending = Math.max(0, total - indexed);
    const percentComplete = total > 0 ? Math.round((indexed / total) * 100) : 0;
    const status = (total > 0 && pending === 0) ? "complete" : "processing";

    return NextResponse.json({
      total,
      indexed,
      pending,
      percentComplete,
      status
    });

  } catch (err: any) {
    console.error("[IndexingStatus API] Error fetching progress:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
