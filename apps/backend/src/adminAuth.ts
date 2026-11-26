import type { Request } from "express";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

// actorId: the person the backend acts for. Sent as x-eb-actor so the event change log (todo #27,
// supabase/migrations/20261119230000_event_change_log.sql) can name them; the database only trusts it from the service key.
export function getAdminClient(actorId?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase admin credentials are not configured");
  }
  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      ...(actorId ? { global: { headers: { "x-eb-actor": actorId } } } : {}),
    },
  );
}

export async function verifySuperAdmin(request: Request) {
  const authHeader = request.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return { error: "Missing authorization token" } as const;
  }

  const supabaseAdmin = getAdminClient();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return { error: "Invalid authorization token" } as const;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, delegated_by")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "Admin profile was not found" } as const;
  }

  if (profile.role !== "admin" || profile.delegated_by) {
    return { error: "Only global super admins can use this endpoint" } as const;
  }

  // Dashboard actions write as this admin, so their gallery changes show who made them
  return { supabaseAdmin: getAdminClient(userData.user.id), user: userData.user, profile };
}

export function adminAuthStatus(error?: string) {
  return error === "Invalid authorization token" || error === "Missing authorization token"
    ? 401
    : 403;
}
