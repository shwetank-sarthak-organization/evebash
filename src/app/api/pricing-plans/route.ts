import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { defaultPricingPlans, PricingPlan } from "@/lib/pricingPlans";

export const runtime = "nodejs";

type PricingPlanRow = {
    id: string;
    name: string;
    storage_gb: number | string;
    storage_label: string;
    events: number;
    image_upload: boolean;
    video_upload: boolean;
    video_limit_mb: number | null;
    monthly_actual_price: number | string;
    monthly_price: number | string;
    three_month_actual_price: number | string;
    three_month_price: number | string;
    six_month_actual_price: number | string;
    six_month_price: number | string;
    discounted_yearly_price: number | string;
    yearly_price: number | string;
    active: boolean;
    display_order: number;
};

function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
}

function toNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function mapPricingRow(row: PricingPlanRow): PricingPlan {
    return {
        id: row.id,
        name: row.name,
        storageGb: toNumber(row.storage_gb),
        storageLabel: row.storage_label,
        events: Number(row.events) || 0,
        imageUpload: Boolean(row.image_upload),
        videoUpload: Boolean(row.video_upload),
        videoLimitMb: row.video_limit_mb === null ? null : Number(row.video_limit_mb) || null,
        monthlyActualPrice: toNumber(row.monthly_actual_price ?? row.monthly_price),
        monthlyPrice: toNumber(row.monthly_price),
        threeMonthActualPrice: toNumber(row.three_month_actual_price ?? row.three_month_price),
        threeMonthPrice: toNumber(row.three_month_price),
        sixMonthActualPrice: toNumber(row.six_month_actual_price ?? row.six_month_price),
        sixMonthPrice: toNumber(row.six_month_price),
        discountedYearlyPrice: toNumber(row.discounted_yearly_price),
        yearlyActualPrice: toNumber(row.yearly_price),
        active: Boolean(row.active),
        displayOrder: Number(row.display_order) || 0,
    };
}

function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(),
    });
}

export async function GET() {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return NextResponse.json(
            { plans: defaultPricingPlans, source: "default", error: "Supabase public credentials are not configured." },
            { headers: corsHeaders() }
        );
    }

    const { data, error } = await supabase
        .from("pricing_plans")
        .select(
            "id, name, storage_gb, storage_label, events, image_upload, video_upload, video_limit_mb, monthly_actual_price, monthly_price, three_month_actual_price, three_month_price, six_month_actual_price, six_month_price, discounted_yearly_price, yearly_price, active, display_order"
        )
        .order("display_order", { ascending: true });

    if (error || !data || data.length === 0) {
        return NextResponse.json(
            {
                plans: defaultPricingPlans,
                source: "default",
                error: error?.message || "No pricing plans found.",
            },
            { headers: corsHeaders() }
        );
    }

    return NextResponse.json(
        {
            plans: data.map((row) => mapPricingRow(row as PricingPlanRow)),
            source: "supabase",
        },
        { headers: corsHeaders() }
    );
}
