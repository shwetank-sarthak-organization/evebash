import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyDuePlanChanges, todayInIndia } from '../src/routes/subscription.js';
import { startPlanChangeScheduler } from '../src/services/planChangeScheduler.js';

type Row = Record<string, unknown>;

// Enough of the Supabase client for applyDuePlanChanges: a filtered select and a conditional update
function fakeAdmin(profiles: Row[]) {
  return {
    from() {
      const filters: Array<(row: Row) => boolean> = [];
      let patch: Row | null = null;
      const builder: any = {
        select: () => (patch ? run() : builder),
        not: (column: string) => { filters.push(row => row[column] !== null && row[column] !== undefined); return builder; },
        lte: (column: string, value: string) => { filters.push(row => String(row[column]) <= value); return builder; },
        eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return builder; },
        update: (values: Row) => { patch = values; return builder; },
        then: (resolve: (value: unknown) => void) => resolve(run()),
      };
      const run = () => {
        const matched = profiles.filter(row => filters.every(f => f(row)));
        if (patch) matched.forEach(row => Object.assign(row, patch));
        return { data: matched.map(row => ({ ...row })), error: null };
      };
      return builder;
    },
  };
}

test('plan dates follow the Indian calendar day', () => {
  // 18:29 UTC on the 10th is 23:59 IST on the 10th; 18:31 UTC is already the 11th in India
  assert.equal(todayInIndia(new Date('2026-10-10T18:29:00Z')), '2026-10-10');
  assert.equal(todayInIndia(new Date('2026-10-10T18:31:00Z')), '2026-10-11');
});

test('due plan changes are applied once; future ones wait', async () => {
  const profiles: Row[] = [
    { id: 'renewed', role: 'starter', pending_plan_role: 'standard', pending_subscription_duration: '1 month',
      pending_plan_start_date: '2026-10-11', pending_plan_end_date: '2026-11-10' },
    { id: 'later', role: 'starter', pending_plan_role: 'premium', pending_subscription_duration: '1 month',
      pending_plan_start_date: '2026-10-20', pending_plan_end_date: '2026-11-19' },
    { id: 'nothing', role: 'free', pending_plan_role: null, pending_plan_start_date: null },
  ];
  const admin = fakeAdmin(profiles) as never;
  const justAfterMidnightIST = new Date('2026-10-10T18:35:00Z');

  const first = await applyDuePlanChanges(admin, justAfterMidnightIST);
  assert.deepEqual(first, { checked: 1, applied: 1, failures: [] });
  assert.equal(profiles[0].role, 'standard');
  assert.equal(profiles[0].plan_end_date, '2026-11-10');
  assert.equal(profiles[0].pending_plan_role, null);
  assert.equal(profiles[1].role, 'starter', 'a change starting later is left alone');

  // Running again (another server, or the next hour) changes nothing
  assert.deepEqual(await applyDuePlanChanges(admin, justAfterMidnightIST), { checked: 0, applied: 0, failures: [] });
});

test('the scheduler can be switched off', () => {
  let runs = 0;
  const stop = startPlanChangeScheduler(async () => { runs += 1; }, 'false');
  stop();
  assert.equal(runs, 0);
});
