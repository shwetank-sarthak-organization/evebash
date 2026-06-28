import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders,
  });
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function isPaidPlanRole(role: string | null | undefined) {
  const cleanRole = String(role || "free").toLowerCase();
  return cleanRole !== "admin" && cleanRole !== "free" && cleanRole !== "user" && cleanRole !== "freemium";
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeDateOnly(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDateOnly(parsed);
}

function normalizeSubscriptionDuration(value: unknown) {
  const normalized = String(value || "monthly").toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "quarterly" || normalized === "3_month" || normalized === "3_months") return "quarterly";
  if (normalized === "half_yearly" || normalized === "6_month" || normalized === "6_months") return "half_yearly";
  if (normalized === "yearly" || normalized === "annual") return "yearly";
  return "monthly";
}

function addDurationToDate(startDate: string, duration: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return "";

  const monthsByDuration: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    half_yearly: 6,
    yearly: 12,
  };

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + (monthsByDuration[duration] || 1));
  return toDateOnly(end);
}

async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return { error: "Missing authorization token" };
  }

  const supabaseAdmin = getAdminClient();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return { error: "Invalid authorization token" };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, delegated_by")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "Admin profile was not found" };
  }

  const isGlobalAdmin = profile.role === "admin" && !profile.delegated_by;

  if (!isGlobalAdmin) {
    return { error: "Only global super admins can use this endpoint" };
  }

  return { supabaseAdmin, user: userData.user, profile };
}

async function syncAllAuthUsers(supabaseAdmin: ReturnType<typeof getAdminClient>) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;

  let synced = 0;

  for (const authUser of data.users) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) continue;

    const name = authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Wedding User";
    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authUser.id,
        name,
        email: authUser.email || null,
        role: "user",
        role_type: "primary",
        created_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;
    synced++;
  }

  return { count: data.users.length, synced };
}

async function updateUserRole(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>
) {
  const uid = String(payload.uid || "");
  const role = typeof payload.role === "string" ? payload.role : null;
  const delegatedBy = typeof payload.delegatedBy === "string" ? payload.delegatedBy : "";
  const roleType = typeof payload.roleType === "string" ? payload.roleType : "";
  const assignedEvents = Array.isArray(payload.assignedEvents)
    ? payload.assignedEvents.map(String).filter(Boolean)
    : [];

  if (!uid) {
    throw new Error("User id is required");
  }

  const updateData: Record<string, string | null> = {};
  if (role !== null) updateData.role = role;

  if (role !== null) {
    if (isPaidPlanRole(role)) {
      const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
        .from("profiles")
        .select("subscription_duration, plan_start_date")
        .eq("id", uid)
        .maybeSingle();

      if (existingProfileError) throw existingProfileError;

      const startDate = normalizeDateOnly(existingProfile?.plan_start_date) || toDateOnly(new Date());
      const duration = normalizeSubscriptionDuration(existingProfile?.subscription_duration);
      updateData.plan_start_date = startDate;
      updateData.plan_end_date = addDurationToDate(startDate, duration);
    } else {
      updateData.plan_start_date = null;
      updateData.plan_end_date = null;
    }
  }

  if (delegatedBy) {
    updateData.delegated_by = delegatedBy;
    updateData.role_type = roleType || "primary";
  } else {
    updateData.delegated_by = null;
    updateData.role_type = null;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updateData)
    .eq("id", uid);

  if (error) throw error;

  const { error: clearError } = await supabaseAdmin
    .from("profile_assigned_events")
    .delete()
    .eq("profile_id", uid);

  if (clearError) throw clearError;

  if (delegatedBy && roleType === "event" && assignedEvents.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("profile_assigned_events")
      .insert(assignedEvents.map(eventId => ({ profile_id: uid, event_id: eventId })));

    if (insertError) throw insertError;
  }
}

async function updateUserDuration(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>
) {
  const uid = String(payload.uid || "");
  const duration = normalizeSubscriptionDuration(payload.duration);
  const allowedDurations = new Set(["monthly", "quarterly", "half_yearly", "yearly"]);

  if (!uid) {
    throw new Error("User id is required");
  }

  if (!allowedDurations.has(duration)) {
    throw new Error("A valid duration is required");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, plan_start_date")
    .eq("id", uid)
    .maybeSingle();

  if (profileError) throw profileError;

  const updateData: Record<string, string> = { subscription_duration: duration };

  if (isPaidPlanRole(profile?.role)) {
    const startDate = normalizeDateOnly(profile?.plan_start_date) || toDateOnly(new Date());
    updateData.plan_start_date = startDate;
    updateData.plan_end_date = addDurationToDate(startDate, duration);
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updateData)
    .eq("id", uid);

  if (error) throw error;
}

async function updateUserPlanDates(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>
) {
  const uid = String(payload.uid || "");
  const planStartDate = normalizeDateOnly(payload.planStartDate);
  let planEndDate = normalizeDateOnly(payload.planEndDate);

  if (!uid) {
    throw new Error("User id is required");
  }

  if (payload.recalculateEndDate === true && planStartDate) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("subscription_duration")
      .eq("id", uid)
      .maybeSingle();

    if (profileError) throw profileError;
    planEndDate = addDurationToDate(planStartDate, normalizeSubscriptionDuration(profile?.subscription_duration));
  }

  if (!planStartDate || !planEndDate) {
    throw new Error("Valid plan start and end dates are required");
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      plan_start_date: planStartDate,
      plan_end_date: planEndDate,
    })
    .eq("id", uid);

  if (error) throw error;
}

async function deleteUser(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>
) {
  const uid = String(payload.uid || "");
  if (!uid) {
    throw new Error("User id is required");
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(uid);
  if (authError) {
    console.warn("[admin/control] Auth deletion warning:", authError.message);
  }

  const { error: assignmentsError } = await supabaseAdmin
    .from("profile_assigned_events")
    .delete()
    .eq("profile_id", uid);

  if (assignmentsError) throw assignmentsError;

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", uid);

  if (profileError) throw profileError;
}

async function deleteEventTree(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  eventId: string
) {
  const { data: children, error: childrenError } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("parent_id", eventId);

  if (childrenError) throw childrenError;

  for (const child of children || []) {
    await deleteEventTree(supabaseAdmin, child.id);
  }

  const { error: photosError } = await supabaseAdmin
    .from("photos")
    .delete()
    .eq("event_id", eventId);

  if (photosError) throw photosError;

  const { error: assignmentsError } = await supabaseAdmin
    .from("profile_assigned_events")
    .delete()
    .eq("event_id", eventId);

  if (assignmentsError) throw assignmentsError;

  const { error: guestsError } = await supabaseAdmin
    .from("guests")
    .delete()
    .or(`event_id.eq.${eventId},parent_event_id.eq.${eventId}`);

  if (guestsError) throw guestsError;

  const { error: eventError } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("id", eventId);

  if (eventError) throw eventError;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    const verification = await verifySuperAdmin(request);
    if ("error" in verification) {
      const status = verification.error === "Invalid authorization token" || verification.error === "Missing authorization token"
        ? 401
        : 403;
      return jsonResponse({ success: false, error: verification.error }, status);
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    const payload = (body.payload || {}) as Record<string, unknown>;
    const { supabaseAdmin } = verification;

    switch (action) {
      case "syncUsers": {
        const result = await syncAllAuthUsers(supabaseAdmin);
        return jsonResponse({ success: true, ...result });
      }
      case "updateUserRole": {
        await updateUserRole(supabaseAdmin, payload);
        return jsonResponse({ success: true });
      }
      case "updateUserDuration": {
        await updateUserDuration(supabaseAdmin, payload);
        return jsonResponse({ success: true });
      }
      case "updateUserPlanDates": {
        await updateUserPlanDates(supabaseAdmin, payload);
        return jsonResponse({ success: true });
      }
      case "deleteUser": {
        await deleteUser(supabaseAdmin, payload);
        return jsonResponse({ success: true });
      }
      case "deleteEvent": {
        const eventId = String(payload.eventId || "");
        if (!eventId) throw new Error("Event id is required");
        await deleteEventTree(supabaseAdmin, eventId);
        return jsonResponse({ success: true });
      }
      case "deleteGuest": {
        const guestId = String(payload.guestId || "");
        if (!guestId) throw new Error("Guest id is required");
        const { error } = await supabaseAdmin.from("guests").delete().eq("id", guestId);
        if (error) throw error;
        return jsonResponse({ success: true });
      }
      default:
        return jsonResponse({ success: false, error: "Unsupported admin action" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin action failed";
    console.error("[admin/control]", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
}
