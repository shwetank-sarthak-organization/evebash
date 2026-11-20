// Website and app (one copy): plan prices from GET /api/v1/pricing-plans (the pricing_plans table), so a price change
// in the database or the admin dashboard reaches the app without an app update (issue #244).

export type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

/** The fields of one plan that /api/v1/pricing-plans returns and the prices need. */
export interface ServerPricingPlan {
  id: string;
  active?: boolean;
  monthlyPrice?: number | null;
  threeMonthPrice?: number | null;
  sixMonthPrice?: number | null;
  discountedYearlyPrice?: number | null;
}

/** "₹1,249": Indian digit grouping (1,00,000), done by hand so it doesn't depend on the phone's Intl support. */
export function formatRupees(amount: number): string {
  const whole = Math.round(Math.max(0, amount));
  const digits = String(whole);
  if (digits.length <= 3) return `₹${digits}`;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `₹${rest},${last3}`;
}

const CYCLE_FIELD: Record<BillingCycle, keyof ServerPricingPlan> = {
  monthly: 'monthlyPrice',
  quarterly: 'threeMonthPrice',
  semiannual: 'sixMonthPrice',
  yearly: 'discountedYearlyPrice',
};

/**
 * The price shown for one plan and cycle, e.g. "₹399", from the server's plans; null when the server has no usable
 * number for it (the caller keeps its own fallback price then).
 */
export function serverPlanPrice(plans: ServerPricingPlan[] | null | undefined, planId: string, cycle: BillingCycle): string | null {
  const plan = plans?.find((item) => item.id === planId && item.active !== false);
  const value = plan ? plan[CYCLE_FIELD[cycle]] : undefined;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? formatRupees(value) : null;
}

/** The plans array from a /api/v1/pricing-plans response, or null if the response isn't one. */
export function readPricingPlans(body: unknown): ServerPricingPlan[] | null {
  const plans = (body as { plans?: unknown } | null)?.plans;
  if (!Array.isArray(plans)) return null;
  return plans.filter((plan): plan is ServerPricingPlan => Boolean(plan) && typeof (plan as ServerPricingPlan).id === 'string');
}
