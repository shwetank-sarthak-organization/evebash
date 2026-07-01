import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCachedBackblazeAuth, BackblazeAuth } from "@/lib/backblaze";

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

function getB2KeyFromUrl(value: string, bucketName: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    let path = decodeURIComponent(url.pathname).replace(/^\/+/, "");

    const filePrefix = `file/${bucketName}/`;
    if (path.startsWith(filePrefix)) {
      path = path.slice(filePrefix.length);
    }

    return path.replace(/^\/+/, "");
  } catch {
    return trimmed.replace(/^\/+/, "");
  }
}

async function deleteB2File(auth: BackblazeAuth, bucketId: string, key: string) {
  if (!key) return true;

  try {
    const listResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId,
        startFileName: key,
        maxFileCount: 1,
        prefix: key,
      }),
    });

    if (!listResponse.ok) return false;

    const listData = await listResponse.json();
    const file = listData.files?.find((item: { fileName: string; fileId?: string }) => item.fileName === key);
    if (!file?.fileId) return true;

    const deleteResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: key,
        fileId: file.fileId,
      }),
    });

    return deleteResponse.ok;
  } catch (error) {
    console.warn(`[ProfileImageDelete] Could not delete B2 file ${key}:`, error);
    return false;
  }
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
      return jsonResponse({ error: "Invalid authorization token" }, 401);
    }

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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("profile_image")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const profileImage = String(profile?.profile_image || "");
    let deletedFiles = 0;

    if (profileImage) {
      const bucketId = requireEnv("B2_BUCKET_ID");
      const bucketName = process.env.B2_BUCKET_NAME?.trim() || "EveBash";
      const storageKey = getB2KeyFromUrl(profileImage, bucketName);

      if (storageKey.startsWith(`profiles/${user.id}/`)) {
        const auth = await getCachedBackblazeAuth();
        const keys = [storageKey, `${storageKey}-thumbnail.webp`, `${storageKey}-preview.webp`];

        for (const key of keys) {
          const deleted = await deleteB2File(auth, bucketId, key);
          if (deleted) deletedFiles += 1;
        }
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ profile_image: null })
      .eq("id", user.id);

    if (updateError) throw updateError;

    return jsonResponse({ success: true, deletedFiles });
  } catch (error: unknown) {
    console.error("[ProfileImageDelete] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Profile image deletion failed" }, 500);
  }
}
