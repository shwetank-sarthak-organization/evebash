import { defaultPricingPlans } from "../pricingPlans.js";
import { vaultConfig } from "./config.js";

const GB = 1024 * 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
const FREE_ROLES = new Set(["user", "free", "freemium"]);

/**
 * active   – plan current (or a free plan, which never expires)
 * grace    – days 0–7 after expiry: everything visible, media beyond the oldest 1 GB flagged
 * hidden   – days 7–30: media beyond the oldest 1 GB hidden
 * deleting – day 30 onward: media beyond the oldest 1 GB is due for permanent deletion
 */
export type PlanState = "active" | "grace" | "hidden" | "deleting";

export type PlanLifecycle = {
  state: PlanState;
  role: string;
  isPaid: boolean;
  /** null = unlimited (admin). */
  planBytes: number | null;
  expiredOn: Date | null;
  graceEndsOn: Date | null;
  deletionOn: Date | null;
};

export function getPlanStorageBytes(role: string): number | null {
  if (role === "admin") return null;
  const plan = defaultPricingPlans.find((candidate) => candidate.id === role) ?? defaultPricingPlans[0];
  return plan.storageGb * GB;
}

/** Plan end dates are calendar dates in India; a plan stays active through the end of that day (IST). */
function endOfPlanDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59.999+05:30`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getPlanLifecycle(params: { role?: string | null; planEndDate?: string | null; now?: Date }): PlanLifecycle {
  const role = String(params.role || "free").toLowerCase();
  const now = params.now ?? new Date();
  const isPaid = role !== "admin" && !FREE_ROLES.has(role);
  const expiredOn = isPaid ? endOfPlanDay(params.planEndDate) : null;

  if (!isPaid || !expiredOn || now.getTime() <= expiredOn.getTime()) {
    return { state: "active", role, isPaid, planBytes: getPlanStorageBytes(role), expiredOn: null, graceEndsOn: null, deletionOn: null };
  }

  const graceEndsOn = new Date(expiredOn.getTime() + vaultConfig.graceDays * DAY);
  const deletionOn = new Date(expiredOn.getTime() + vaultConfig.deletionAfterDays * DAY);
  const state: PlanState = now <= graceEndsOn ? "grace" : now < deletionOn ? "hidden" : "deleting";
  // Once expired, storage falls back to the free allowance (uploads stay paused until renewal).
  return { state, role, isPaid, planBytes: vaultConfig.expiredRetainedBytes, expiredOn, graceEndsOn, deletionOn };
}

export function maxFileBytesFor(lifecycle: PlanLifecycle): number {
  return lifecycle.isPaid || lifecycle.role === "admin" ? vaultConfig.maxFileBytes.paid : vaultConfig.maxFileBytes.free;
}
