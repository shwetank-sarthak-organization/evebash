import { Router } from "express";
import { verifySupabaseUser } from "../auth.js";
import { getBearerToken } from "../auth.js";
import { getSupabaseAdminClient } from "../supabase.js";

export const subscriptionRouter = Router();

type PendingProfile = {
  id?: string;
  pending_plan_role?: string | null;
  pending_subscription_duration?: string | null;
  pending_plan_start_date?: string | null;
  pending_plan_end_date?: string | null;
};

/** Today's calendar date in India (plan dates are Indian calendar dates, as in the Vault plan rules). */
export function todayInIndia(now = new Date()) {
  return new Date(now.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

function isTodayOrPast(value?: string | null, now = new Date()) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  return value.slice(0, 10) <= todayInIndia(now);
}

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

/**
 * Applies every scheduled plan change whose start date has arrived. Runs hourly on the server
 * (planChangeScheduler) so app-only users get theirs too; the website still applies the caller's own on load.
 * An update only goes through if the scheduled change is still the one that was read.
 */
export async function applyDuePlanChanges(supabaseAdmin: AdminClient = getSupabaseAdminClient(), now = new Date()) {
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, pending_plan_role, pending_subscription_duration, pending_plan_start_date, pending_plan_end_date")
    .not("pending_plan_role", "is", null)
    .lte("pending_plan_start_date", todayInIndia(now));
  if (error) throw error;

  const failures: Array<{ id: string; error: string }> = [];
  let applied = 0;
  for (const profile of (profiles || []) as PendingProfile[]) {
    if (!profile.id || !profile.pending_plan_role || !isTodayOrPast(profile.pending_plan_start_date, now)) continue;
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(pendingPlanUpdate(profile))
      .eq("id", profile.id)
      .eq("pending_plan_role", profile.pending_plan_role)
      .eq("pending_plan_start_date", profile.pending_plan_start_date as string)
      .select("id");
    if (updateError) {
      failures.push({ id: profile.id, error: updateError.message });
    } else if ((updated || []).length > 0) {
      applied += 1;
    }
  }
  return { checked: profiles?.length || 0, applied, failures };
}

function pendingPlanUpdate(profile: PendingProfile) {
  return {
    role: profile.pending_plan_role,
    role_type: "primary",
    subscription_duration: profile.pending_subscription_duration,
    plan_start_date: profile.pending_plan_start_date,
    plan_end_date: profile.pending_plan_end_date,
    pending_plan_role: null,
    pending_subscription_duration: null,
    pending_plan_start_date: null,
    pending_plan_end_date: null,
  };
}

subscriptionRouter.post("/apply-pending", async (request, response) => {
  try {
    const verification = await verifySupabaseUser(request);
    if (!verification) {
      response.status(401).json({ error: "Your session could not be verified." });
      return;
    }

    const { user, supabaseAdmin } = verification;
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("pending_plan_role, pending_subscription_duration, pending_plan_start_date, pending_plan_end_date")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!profile?.pending_plan_role || !isTodayOrPast(profile.pending_plan_start_date)) {
      response.json({ success: true, applied: false });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(pendingPlanUpdate(profile))
      .eq("id", user.id);

    if (updateError) throw updateError;
    response.json({ success: true, applied: true });
  } catch (error) {
    request.log.error({ error }, "[BackendSubscription] Pending-plan activation failed");
    response.status(500).json({ error: error instanceof Error ? error.message : "Unable to activate pending plan." });
  }
});

subscriptionRouter.post("/apply-due", async (request, response) => {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    response.status(503).json({ error: "CRON_SECRET is not configured." });
    return;
  }
  if (getBearerToken(request) !== cronSecret) {
    response.status(401).json({ error: "Invalid cron authorization." });
    return;
  }

  try {
    const { checked, applied, failures } = await applyDuePlanChanges();
    response.status(failures.length > 0 ? 207 : 200).json({
      success: failures.length === 0,
      checked,
      applied,
      failures,
    });
  } catch (error) {
    request.log.error({ error }, "[BackendSubscriptionCron] Due-plan activation failed");
    response.status(500).json({ error: error instanceof Error ? error.message : "Unable to apply due plans." });
  }
});
