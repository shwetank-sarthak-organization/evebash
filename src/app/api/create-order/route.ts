import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import {
    getBillingDurationLabel,
    getPricingPlanAmount,
    normalizeBillingDuration,
    type RazorpayBillingDuration,
} from "@/lib/razorpayPricing";

export const runtime = "nodejs";

type PricingPlanPaymentRow = {
    id: string;
    name: string;
    monthly_price: number | string;
    three_month_price: number | string;
    six_month_price: number | string;
    discounted_yearly_price: number | string;
    active: boolean;
};

function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

function toNumber(value: unknown) {
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

function getRazorpayCredentials() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return null;
    return { keyId, keySecret };
}

function getRazorpayErrorStatus(error: unknown) {
    const candidate = error as { statusCode?: number; status?: number; error?: { statusCode?: number } };
    return candidate.statusCode || candidate.status || candidate.error?.statusCode || 500;
}

function getRazorpayErrorMessage(error: unknown) {
    const candidate = error as { error?: { description?: string }; message?: string };
    return candidate.error?.description || candidate.message || "Unable to create Razorpay order.";
}

export async function POST(request: NextRequest) {
    const credentials = getRazorpayCredentials();
    if (!credentials) {
        return NextResponse.json({ error: "Razorpay credentials are not configured." }, { status: 500 });
    }

    let body: { planId?: unknown; duration?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const planId = typeof body.planId === "string" ? body.planId.trim() : "";
    const duration = normalizeBillingDuration(body.duration);

    if (!planId || !duration) {
        return NextResponse.json({ error: "Plan and billing duration are required." }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        return NextResponse.json({ error: "Pricing database is not configured." }, { status: 500 });
    }

    const { data, error } = await supabase
        .from("pricing_plans")
        .select("id, name, monthly_price, three_month_price, six_month_price, discounted_yearly_price, active")
        .eq("id", planId)
        .eq("active", true)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message || "Unable to load pricing plan." }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: "Selected pricing plan is not available." }, { status: 404 });
    }

    const plan = mapPaymentPlan(data as PricingPlanPaymentRow);
    const amountInRupees = getPricingPlanAmount(plan, duration as RazorpayBillingDuration);
    const amountInPaise = Math.round(amountInRupees * 100);

    if (amountInPaise < 100) {
        return NextResponse.json({ error: "Paid checkout requires an amount of at least ₹1." }, { status: 400 });
    }

    const razorpay = new Razorpay({
        key_id: credentials.keyId,
        key_secret: credentials.keySecret,
    });

    try {
        const receipt = `rcpt_${plan.id.slice(0, 10)}_${Date.now().toString(36)}`;
        const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt,
            notes: {
                planId: plan.id,
                planName: plan.name,
                duration,
                durationLabel: getBillingDurationLabel(duration),
            },
        });

        return NextResponse.json({
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: credentials.keyId,
            plan_id: plan.id,
            plan_name: plan.name,
            duration,
        });
    } catch (error) {
        const status = getRazorpayErrorStatus(error);
        return NextResponse.json(
            { error: getRazorpayErrorMessage(error) },
            { status: status === 401 ? 401 : 500 }
        );
    }
}
