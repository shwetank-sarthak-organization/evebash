/**
 * Applies scheduled plan changes every hour (and a minute after startup), so they take effect on time even for
 * people who only use the app. Safe on several servers at once: a change already applied isn't applied again.
 * Kill switch: PLAN_CHANGE_SCHEDULER=false.
 */
export function startPlanChangeScheduler(run: () => Promise<unknown>, setting = process.env.PLAN_CHANGE_SCHEDULER): () => void {
  if (setting?.trim().toLowerCase() === "false") {
    console.log("[PlanChanges] Scheduler disabled (PLAN_CHANGE_SCHEDULER=false)");
    return () => {};
  }
  const tick = (context: string) => run()
    .then((result) => console.log(`[PlanChanges] ${context} run`, result))
    .catch((error) => console.error(`[PlanChanges] ${context} run failed:`, error));
  const interval = setInterval(() => void tick("Scheduled"), 60 * 60 * 1000);
  const startup = setTimeout(() => void tick("Startup"), 60 * 1000);
  return () => {
    clearInterval(interval);
    clearTimeout(startup);
  };
}
