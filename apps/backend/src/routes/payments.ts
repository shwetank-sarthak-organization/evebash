import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import Razorpay from "razorpay";
import { verifySupabaseUser } from "../auth.js";
import { getSupabaseAdminClient } from "../supabase.js";

export const paymentsRouter = Router();

export type RazorpayBillingDuration = "monthly" | "threeMonths" | "sixMonths" | "yearly";

const DURATION_TO_MONTHS: Record<RazorpayBillingDuration, number> = {
  monthly: 1,
  threeMonths: 3,
  sixMonths: 6,
  yearly: 12,
};

const DURATION_TO_PROFILE_VALUE: Record<RazorpayBillingDuration, string> = {
  monthly: "monthly",
  threeMonths: "quarterly",
  sixMonths: "half_yearly",
  yearly: "yearly",
};

const GB = 1024 * 1024 * 1024;

function getPlanStorageBytes(role?: string): number {
  switch (role?.toLowerCase()) {
    case "admin":
      return Infinity;
    case "ultimate":
      return 1024 * GB;
    case "elite":
      return 500 * GB;
    case "pro":
      return 200 * GB;
    case "premium":
      return 100 * GB;
    case "standard":
      return 50 * GB;
    case "basic":
      return 25 * GB;
    case "starter":
      return 10 * GB;
    case "free":
    case "freemium":
    default:
      return 1 * GB;
  }
}

type PricingPlanPaymentRow = {
  id: string;
  name: string;
  monthly_price: number | string;
  three_month_price: number | string;
  six_month_price: number | string;
  discounted_yearly_price: number | string;
  active: boolean;
};

function normalizeBillingDuration(value: unknown): RazorpayBillingDuration | null {
  if (value === "monthly" || value === "threeMonths" || value === "sixMonths" || value === "yearly") {
    return value;
  }
  return null;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapPaymentPlan(row: PricingPlanPaymentRow) {
  return {
    id: row.id,
    name: row.name,
    monthlyPrice: toNumber(row.monthly_price),
    threeMonthPrice: toNumber(row.three_month_price),
    sixMonthPrice: toNumber(row.six_month_price),
    discountedYearlyPrice: toNumber(row.discounted_yearly_price),
    active: Boolean(row.active),
  };
}

function getPricingPlanAmount(
  plan: ReturnType<typeof mapPaymentPlan>,
  duration: RazorpayBillingDuration,
): number {
  if (duration === "monthly") return plan.monthlyPrice;
  if (duration === "threeMonths") return plan.threeMonthPrice;
  if (duration === "sixMonths") return plan.sixMonthPrice;
  return plan.discountedYearlyPrice;
}

function getBillingDurationLabel(duration: RazorpayBillingDuration): string {
  if (duration === "monthly") return "Monthly";
  if (duration === "threeMonths") return "3 Months";
  if (duration === "sixMonths") return "6 Months";
  return "Yearly";
}

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isCurrentPlanActive(planEndDate?: string | null): boolean {
  const endDate = parseDateOnly(planEndDate);
  if (!endDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return endDate >= today;
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdminClient>;

type PaidPlanInput = {
  userId: string;
  planId: string;
  duration: RazorpayBillingDuration;
  orderId: string;
  paymentId: string;
  amountInPaise: number;
  currency: string;
  source: "verify-payment" | "webhook";
};

type ProfilePlanRow = {
  role?: string | null;
  subscription_duration?: string | null;
  plan_start_date?: string | null;
  plan_end_date?: string | null;
  pending_plan_role?: string | null;
  pending_subscription_duration?: string | null;
  pending_plan_start_date?: string | null;
  pending_plan_end_date?: string | null;
};

const PROFILE_PLAN_COLUMNS =
  "role, subscription_duration, plan_start_date, plan_end_date, pending_plan_role, pending_subscription_duration, pending_plan_start_date, pending_plan_end_date";

// What the pricing page shows once a payment is in: the plan now, or the plan queued after it
function describePlan(profile: ProfilePlanRow | null, planId: string, alreadyApplied: boolean) {
  if (profile?.pending_plan_role === planId && profile.role !== planId) {
    return {
      change_type: "downgrade_scheduled" as const,
      already_applied: alreadyApplied,
      plan_id: profile.role || "free",
      pending_plan_role: profile.pending_plan_role,
      pending_subscription_duration: profile.pending_subscription_duration ?? null,
      pending_plan_start_date: profile.pending_plan_start_date ?? null,
      pending_plan_end_date: profile.pending_plan_end_date ?? null,
    };
  }
  return {
    change_type: "immediate" as const,
    already_applied: alreadyApplied,
    plan_id: profile?.role || planId,
    subscription_duration: profile?.subscription_duration ?? null,
    plan_start_date: profile?.plan_start_date ?? null,
    plan_end_date: profile?.plan_end_date ?? null,
  };
}

async function loadProfilePlan(supabaseAdmin: SupabaseAdmin, userId: string): Promise<ProfilePlanRow | null> {
  const { data, error } = await supabaseAdmin.from("profiles").select(PROFILE_PLAN_COLUMNS).eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message || "Could not load the current plan.");
  return (data as ProfilePlanRow | null) ?? null;
}

// Switches a paid plan on, exactly once per Razorpay payment. Both verify-payment (the buyer's page) and the
// Razorpay webhook call it, often within seconds of each other. The payments row is written first and is the
// claim: a unique index on captured razorpay_payment_id (migration 20261124120000) makes the second caller fail
// with 23505, and that caller just reports the plan the first one set. If the profile update fails, the claim is
// removed so a retry (Razorpay retries webhooks) can do it again.
export async function applyPaidPlan(supabaseAdmin: SupabaseAdmin, input: PaidPlanInput, now = new Date()) {
  const { userId, planId, duration, orderId, paymentId } = input;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("razorpay_payment_id", paymentId)
    .eq("status", "captured")
    .limit(1);
  if (existingError) throw new Error(existingError.message || "Could not check earlier payments.");
  if (existing && existing.length > 0) {
    return describePlan(await loadProfilePlan(supabaseAdmin, userId), planId, true);
  }

  const currentProfile = await loadProfilePlan(supabaseAdmin, userId);
  const currentRole = currentProfile?.role || "free";
  const subscriptionDuration = DURATION_TO_PROFILE_VALUE[duration];
  const isDowngrade =
    currentRole.toLowerCase() !== "admin" &&
    isCurrentPlanActive(currentProfile?.plan_end_date) &&
    getPlanStorageBytes(planId) < getPlanStorageBytes(currentRole);

  let profileUpdate: Record<string, unknown>;
  if (isDowngrade) {
    const currentEndDate = parseDateOnly(currentProfile?.plan_end_date) || now;
    const pendingStartDate = addDays(currentEndDate, 1);
    profileUpdate = {
      pending_plan_role: planId,
      pending_subscription_duration: subscriptionDuration,
      pending_plan_start_date: toDateOnly(pendingStartDate),
      pending_plan_end_date: toDateOnly(addMonths(pendingStartDate, DURATION_TO_MONTHS[duration])),
    };
  } else {
    profileUpdate = {
      role: planId,
      role_type: "primary",
      subscription_duration: subscriptionDuration,
      plan_start_date: toDateOnly(now),
      plan_end_date: toDateOnly(addMonths(now, DURATION_TO_MONTHS[duration])),
      pending_plan_role: null,
      pending_subscription_duration: null,
      pending_plan_start_date: null,
      pending_plan_end_date: null,
    };
  }

  const via = input.source === "webhook" ? " (Razorpay webhook)" : "";
  const { data: claim, error: claimError } = await supabaseAdmin
    .from("payments")
    .insert({
      user_id: userId,
      amount: input.amountInPaise / 100,
      currency: input.currency || "INR",
      status: "captured",
      plan_id: planId,
      billing_duration: subscriptionDuration,
      payment_gateway: "razorpay",
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      notes: (isDowngrade ? "Scheduled downgrade to " : "Immediate plan activation: ") + planId + via,
    })
    .select("id")
    .single();

  if (claimError) {
    if ((claimError as { code?: string }).code === "23505") {
      return describePlan(await loadProfilePlan(supabaseAdmin, userId), planId, true);
    }
    throw new Error(claimError.message || "Could not record the payment.");
  }

  const { error: updateError } = await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", userId);
  if (updateError) {
    await supabaseAdmin.from("payments").delete().eq("id", (claim as { id: string }).id);
    throw new Error(updateError.message || "Payment verified, but plan activation failed.");
  }

  return describePlan({ ...currentProfile, ...(profileUpdate as ProfilePlanRow) }, planId, false);
}

type RazorpayOrderLike = { amount?: number | string; currency?: string; notes?: unknown };

type WebhookDeps = {
  secret: string | undefined;
  supabaseAdmin: () => SupabaseAdmin;
  fetchOrder: (orderId: string) => Promise<RazorpayOrderLike>;
  log?: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void };
};

// Razorpay webhook (payment.captured / order.paid). Answers 2xx for anything it doesn't need to act on, so
// Razorpay stops retrying; 5xx only when switching the plan on failed and a retry could help.
export async function handleRazorpayWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  deps: WebhookDeps,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!deps.secret) return { status: 503, body: { error: "Webhook secret is not configured." } };

  const expected = crypto.createHmac("sha256", deps.secret).update(rawBody).digest("hex");
  if (!signature || !safeCompare(expected, signature)) {
    return { status: 400, body: { error: "Invalid webhook signature." } };
  }

  let event: { event?: string; payload?: { payment?: { entity?: Record<string, unknown> } } };
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return { status: 400, body: { error: "Invalid JSON." } };
  }

  if (event.event !== "payment.captured" && event.event !== "order.paid") {
    return { status: 200, body: { ignored: true, reason: "event not handled" } };
  }

  const payment = event.payload?.payment?.entity || {};
  const paymentId = typeof payment.id === "string" ? payment.id : "";
  const orderId = typeof payment.order_id === "string" ? payment.order_id : "";
  if (!paymentId || !orderId || payment.status !== "captured") {
    return { status: 200, body: { ignored: true, reason: "no captured payment for an order" } };
  }

  try {
    const order = await deps.fetchOrder(orderId);
    const notes = (order.notes || {}) as Record<string, unknown>;
    const userId = typeof notes.userId === "string" ? notes.userId : "";
    const planId = typeof notes.planId === "string" ? notes.planId : "";
    const duration = normalizeBillingDuration(notes.duration);
    if (!userId || !planId || !duration) {
      deps.log?.warn({ orderId, paymentId }, "[Payments] Webhook: order has no buyer or plan in its notes; skipped");
      return { status: 200, body: { ignored: true, reason: "order has no buyer or plan" } };
    }

    const amountInPaise = Number(order.amount);
    if (Number(payment.amount) !== amountInPaise) {
      deps.log?.warn({ orderId, paymentId }, "[Payments] Webhook: payment amount differs from the order; skipped");
      return { status: 200, body: { ignored: true, reason: "amount mismatch" } };
    }

    const result = await applyPaidPlan(deps.supabaseAdmin(), {
      userId,
      planId,
      duration,
      orderId,
      paymentId,
      amountInPaise,
      currency: typeof order.currency === "string" ? order.currency : "INR",
      source: "webhook",
    });
    deps.log?.info({ userId, paymentId, alreadyApplied: result.already_applied }, "[Payments] Webhook handled");
    return { status: 200, body: { success: true, already_applied: result.already_applied } };
  } catch (error) {
    deps.log?.warn({ error, orderId, paymentId }, "[Payments] Webhook: could not switch the plan on");
    return { status: 500, body: { error: "Could not process the payment." } };
  }
}

// POST /api/v1/payments/webhook. Mounted in server.ts before express.json(): the signature is over the raw body.
export async function razorpayWebhook(request: Request, response: Response) {
  const credentials = getRazorpayCredentials();
  const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from("");
  const header = request.headers["x-razorpay-signature"];
  const result = await handleRazorpayWebhook(rawBody, typeof header === "string" ? header : undefined, {
    secret: process.env.RAZORPAY_WEBHOOK_SECRET,
    supabaseAdmin: getSupabaseAdminClient,
    fetchOrder: async (orderId) => {
      if (!credentials) throw new Error("Razorpay credentials are not configured.");
      const razorpay = new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret });
      return (await razorpay.orders.fetch(orderId)) as RazorpayOrderLike;
    },
    log: request.log,
  });
  response.status(result.status).json(result.body);
}

// POST /api/v1/payments/create-order or /api/create-order
paymentsRouter.post("/create-order", async (request: Request, response: Response) => {
  const credentials = getRazorpayCredentials();
  if (!credentials) {
    response.status(500).json({ error: "Razorpay credentials are not configured." });
    return;
  }

  // The buyer must be signed in: the order carries their user id, so the webhook can switch the plan on even if
  // their page closes before verify-payment runs (issue #316).
  const buyer = await verifySupabaseUser(request);
  if (!buyer) {
    response.status(401).json({ error: "Please sign in to buy a plan." });
    return;
  }

  const { planId: rawPlanId, duration: rawDuration } = request.body || {};
  const planId = typeof rawPlanId === "string" ? rawPlanId.trim() : "";
  const duration = normalizeBillingDuration(rawDuration);

  if (!planId || !duration) {
    response.status(400).json({ error: "Plan and billing duration are required." });
    return;
  }

  const { supabaseAdmin } = buyer;
  const { data, error } = await supabaseAdmin
    .from("pricing_plans")
    .select("id, name, monthly_price, three_month_price, six_month_price, discounted_yearly_price, active")
    .eq("id", planId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    response.status(500).json({ error: error.message || "Unable to load pricing plan." });
    return;
  }

  if (!data) {
    response.status(404).json({ error: "Selected pricing plan is not available." });
    return;
  }

  const plan = mapPaymentPlan(data as PricingPlanPaymentRow);
  const amountInRupees = getPricingPlanAmount(plan, duration);
  const amountInPaise = Math.round(amountInRupees * 100);

  if (amountInPaise < 100) {
    response.status(400).json({ error: "Paid checkout requires an amount of at least ₹1." });
    return;
  }

  try {
    const razorpay = new Razorpay({
      key_id: credentials.keyId,
      key_secret: credentials.keySecret,
    });

    const receipt = `rcpt_${plan.id.slice(0, 10)}_${Date.now().toString(36)}`;
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        userId: buyer.user.id,
        planId: plan.id,
        planName: plan.name,
        duration,
        durationLabel: getBillingDurationLabel(duration),
      },
    });

    response.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: credentials.keyId,
      plan_id: plan.id,
      plan_name: plan.name,
      duration,
    });
  } catch (error) {
    request.log.error({ error }, "[Payments] Create order failed");
    const candidate = error as { statusCode?: number; message?: string; error?: { description?: string } };
    const status = candidate.statusCode || 500;
    const message = candidate.error?.description || candidate.message || "Unable to create Razorpay order.";
    response.status(status === 401 ? 401 : 500).json({ error: message });
  }
});

// POST /api/v1/payments/verify-payment or /api/verify-payment
paymentsRouter.post("/verify-payment", async (request: Request, response: Response) => {
  const credentials = getRazorpayCredentials();
  if (!credentials) {
    response.status(500).json({ error: "Razorpay credentials are not configured." });
    return;
  }

  const verification = await verifySupabaseUser(request);
  if (!verification) {
    response.status(401).json({ error: "You must be signed in to activate a plan." });
    return;
  }

  const { user, supabaseAdmin } = verification;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId: rawPlanId, duration: rawDuration } = request.body || {};

  const orderId = typeof razorpay_order_id === "string" ? razorpay_order_id : "";
  const paymentId = typeof razorpay_payment_id === "string" ? razorpay_payment_id : "";
  const signature = typeof razorpay_signature === "string" ? razorpay_signature : "";
  const requestedPlanId = typeof rawPlanId === "string" ? rawPlanId.trim() : "";
  const requestedDuration = normalizeBillingDuration(rawDuration);

  if (!orderId || !paymentId || !signature) {
    response.status(400).json({ error: "Payment id, order id, and signature are required." });
    return;
  }

  const generatedSignature = crypto
    .createHmac("sha256", credentials.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (!safeCompare(generatedSignature, signature)) {
    response.status(400).json({ success: false, error: "Invalid payment signature." });
    return;
  }

  try {
    const razorpay = new Razorpay({
      key_id: credentials.keyId,
      key_secret: credentials.keySecret,
    });

    const order = await razorpay.orders.fetch(orderId);
    const notes = (order.notes || {}) as Record<string, unknown>;
    const planId = typeof notes.planId === "string" ? notes.planId : requestedPlanId;
    const duration = normalizeBillingDuration(notes.duration || requestedDuration);

    if (!planId || !duration) {
      response.status(400).json({ error: "Payment order does not include plan details." });
      return;
    }

    if (requestedPlanId && requestedPlanId !== planId) {
      response.status(400).json({ error: "Payment plan mismatch." });
      return;
    }

    if (requestedDuration && requestedDuration !== duration) {
      response.status(400).json({ error: "Payment duration mismatch." });
      return;
    }

    const orderUserId = typeof notes.userId === "string" ? notes.userId : "";
    if (orderUserId && orderUserId !== user.id) {
      response.status(403).json({ error: "This payment belongs to another account." });
      return;
    }

    const result = await applyPaidPlan(supabaseAdmin, {
      userId: user.id,
      planId,
      duration,
      orderId,
      paymentId,
      amountInPaise: Number(order.amount),
      currency: typeof order.currency === "string" ? order.currency : "INR",
      source: "verify-payment",
    });
    request.log.info({ userId: user.id, paymentId, alreadyApplied: result.already_applied }, "[Payments] Payment verified");

    response.json({ success: true, payment_id: paymentId, order_id: orderId, ...result });
  } catch (error) {
    request.log.error({ error }, "[Payments] Verify payment failed");
    response.status(500).json({ error: error instanceof Error ? error.message : "Unable to verify payment." });
  }
});

// POST /api/v1/payments/log-failure
paymentsRouter.post("/log-failure", async (request: Request, response: Response) => {
  const verification = await verifySupabaseUser(request);
  const userId = verification?.user?.id;
  const { orderId, paymentId, planId, duration, failureReason } = request.body || {};

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    await supabaseAdmin.from("payments").insert({
      user_id: userId || null,
      amount: 0,
      currency: "INR",
      status: "failed",
      plan_id: planId || "unknown",
      billing_duration: duration || null,
      payment_gateway: "razorpay",
      razorpay_order_id: orderId || null,
      razorpay_payment_id: paymentId || null,
      failure_reason: failureReason || "Payment failed or was dismissed",
    });
    response.json({ success: true });
  } catch (error) {
    request.log.warn({ error }, "[Payments] Failed to log payment failure");
    response.status(200).json({ success: false });
  }
});

