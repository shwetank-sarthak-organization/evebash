import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

function formatSupabaseError(error: unknown) {
  if (error && typeof error === "object") {
    const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string };
    return {
      message: supabaseError.message,
      details: supabaseError.details,
      hint: supabaseError.hint,
      code: supabaseError.code,
    };
  }
  return error;
}

async function verifySupabaseUser(accessToken: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
  });

  if (!response.ok) return null;

  const user = await response.json().catch(() => null);
  return user?.id ? { id: user.id } : null;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!accessToken) {
      return jsonResponse({ error: "Missing authorization token" }, 401);
    }

    const user = await verifySupabaseUser(accessToken);
    if (!user) {
      return jsonResponse({ error: "Invalid authorization token" }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const imageId = typeof body.image_id === "string" ? body.image_id : "";
    const eventId = typeof body.event_id === "string" ? body.event_id : "";
    const imageUrl = typeof body.image_url === "string" ? body.image_url : "";
    const descriptor: unknown[] = Array.isArray(body.descriptor) ? body.descriptor : [];

    if (!imageId || !eventId || !imageUrl || descriptor.length === 0) {
      return jsonResponse({ error: "Missing required face index fields" }, 400);
    }

    if (!descriptor.every((value: unknown) => typeof value === "number" && Number.isFinite(value))) {
      return jsonResponse({ error: "Invalid face descriptor" }, 400);
    }

    const normalizedDescriptor = descriptor as number[];

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

    const { data: photo, error: photoError } = await supabaseAdmin
      .from("photos")
      .select("id, event_id, user_id")
      .eq("id", imageId)
      .maybeSingle();

    if (photoError) throw photoError;
    if (!photo || photo.event_id !== eventId) {
      return jsonResponse({ error: "Photo not found for this event" }, 404);
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, created_by")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event) {
      return jsonResponse({ error: "Event not found" }, 404);
    }

    if (event.created_by !== user.id && photo.user_id !== user.id) {
      return jsonResponse({ error: "You are not allowed to index faces for this photo" }, 403);
    }

    const { error: insertError } = await supabaseAdmin.from("faces").insert({
      image_id: imageId,
      descriptor: normalizedDescriptor,
      event_id: eventId,
      image_url: imageUrl,
      width: Number(body.width) || 0,
      height: Number(body.height) || 0,
    });

    if (insertError) {
      const formatted = formatSupabaseError(insertError) as { message?: string; code?: string };
      if (formatted?.code === "42P01" || formatted?.code === "PGRST205") {
        return jsonResponse({ error: "Face index table is not ready yet. Apply the Supabase migration for faces." }, 503);
      }
      throw insertError;
    }

    return jsonResponse({ success: true });
  } catch (error) {
    const formatted = formatSupabaseError(error);
    console.error("[FaceIndex] Save failed:", formatted);
    const message = error instanceof Error
      ? error.message
      : formatted && typeof formatted === "object" && "message" in formatted
        ? String(formatted.message || "")
        : "";
    return jsonResponse({ error: message || "Failed to save face index" }, 500);
  }
}
