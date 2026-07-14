import type { PricingPlan } from "@/lib/pricingPlans";

export type RazorpayBillingDuration = "monthly" | "threeMonths" | "sixMonths" | "yearly";

export function normalizeBillingDuration(value: unknown): RazorpayBillingDuration | null {
    if (value === "monthly" || value === "threeMonths" || value === "sixMonths" || value === "yearly") {
        return value;
    }

    return null;
}

export function getPricingPlanAmount(plan: Pick<PricingPlan, "monthlyPrice" | "threeMonthPrice" | "sixMonthPrice" | "discountedYearlyPrice">, duration: RazorpayBillingDuration) {
    if (duration === "monthly") return plan.monthlyPrice;
    if (duration === "threeMonths") return plan.threeMonthPrice;
    if (duration === "sixMonths") return plan.sixMonthPrice;
    return plan.discountedYearlyPrice;
}

export function getBillingDurationLabel(duration: RazorpayBillingDuration) {
    if (duration === "monthly") return "Monthly";
    if (duration === "threeMonths") return "3 Months";
    if (duration === "sixMonths") return "6 Months";
    return "Yearly";
}
