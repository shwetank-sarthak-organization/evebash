import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { applyPaidPlan, handleRazorpayWebhook, paymentFailureRow, paymentsRouter } from '../src/routes/payments.js';

// The plan date helpers in payments.ts mix local time and UTC; Railway runs in UTC, so test in UTC too
process.env.TZ = 'UTC';

type Row = Record<string, unknown>;

// Enough of the Supabase client for applyPaidPlan. payments keeps captured razorpay_payment_id unique, like the
// index in migration 20261124120000; failProfileUpdate makes the profile update fail once.
function fakeAdmin(tables: { profiles: Row[]; payments: Row[] }, options: { failProfileUpdate?: boolean } = {}) {
  let nextId = 1;
  return {
    from(table: 'profiles' | 'payments') {
      const rows = tables[table];
      const filters: Array<(row: Row) => boolean> = [];
      let mode: 'select' | 'update' | 'delete' | 'insert' = 'select';
      let patch: Row | null = null;
      let inserted: Row | null = null;
      let insertError: { code: string; message: string } | null = null;
      const matched = () => rows.filter(row => filters.every(f => f(row)));
      const result = () => {
        if (mode === 'insert') return { data: inserted ? { id: inserted.id } : null, error: insertError };
        if (mode === 'update') {
          if (options.failProfileUpdate && table === 'profiles') {
            options.failProfileUpdate = false;
            return { data: null, error: { message: 'update failed' } };
          }
          matched().forEach(row => Object.assign(row, patch));
          return { data: null, error: null };
        }
        if (mode === 'delete') {
          for (const row of matched()) rows.splice(rows.indexOf(row), 1);
          return { data: null, error: null };
        }
        return { data: matched().map(row => ({ ...row })), error: null };
      };
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return builder; },
        limit: () => builder,
        maybeSingle: async () => { const r = result(); return { data: (r.data as Row[])[0] ?? null, error: r.error }; },
        single: async () => result(),
        update: (values: Row) => { mode = 'update'; patch = values; return builder; },
        delete: () => { mode = 'delete'; return builder; },
        insert: (values: Row) => {
          mode = 'insert';
          const duplicate = values.status === 'captured'
            && rows.some(row => row.status === 'captured' && row.razorpay_payment_id === values.razorpay_payment_id);
          if (duplicate) insertError = { code: '23505', message: 'duplicate key' };
          else { inserted = { id: `pay-row-${nextId++}`, ...values }; rows.push(inserted); }
          return builder;
        },
        then: (resolve: (value: unknown) => void) => resolve(result()),
      };
      return builder;
    },
  };
}

const NOW = new Date('2026-11-24T06:00:00Z');
const input = {
  userId: 'user-1', planId: 'starter', duration: 'monthly' as const, orderId: 'order_1', paymentId: 'pay_1',
  amountInPaise: 15000, currency: 'INR', source: 'webhook' as const,
};

test('a payment switches the plan on once, even when the webhook and the page both report it', async () => {
  const tables = { profiles: [{ id: 'user-1', role: 'free', plan_end_date: null }] as Row[], payments: [] as Row[] };
  const admin = fakeAdmin(tables) as never;

  const first = await applyPaidPlan(admin, input, NOW);
  assert.equal(first.change_type, 'immediate');
  assert.equal(first.already_applied, false);
  assert.equal(tables.profiles[0].role, 'starter');
  assert.equal(tables.profiles[0].plan_end_date, '2026-12-24');
  assert.equal(tables.payments.length, 1);
  assert.equal(tables.payments[0].amount, 150);

  // The page's verify-payment arrives a day later: nothing changes, it reports the plan that is on
  tables.profiles[0].plan_end_date = '2026-12-24';
  const second = await applyPaidPlan(admin, { ...input, source: 'verify-payment' }, new Date('2026-11-25T06:00:00Z'));
  assert.equal(second.already_applied, true);
  assert.equal(second.plan_end_date, '2026-12-24', 'the plan is not extended a second time');
  assert.equal(tables.payments.length, 1);
});

test('when both arrive at the same moment, the unique payment id lets only one through', async () => {
  const tables = { profiles: [{ id: 'user-1', role: 'free' }] as Row[], payments: [] as Row[] };
  const admin = fakeAdmin(tables) as never;
  const [a, b] = await Promise.all([applyPaidPlan(admin, input, NOW), applyPaidPlan(admin, input, NOW)]);
  assert.deepEqual([a.already_applied, b.already_applied].sort(), [false, true]);
  assert.equal(tables.payments.length, 1);
});

test('a cheaper plan bought during an active plan is queued after it', async () => {
  const tables = {
    profiles: [{ id: 'user-1', role: 'pro', plan_end_date: '2026-12-31' }] as Row[],
    payments: [] as Row[],
  };
  const result = await applyPaidPlan(fakeAdmin(tables) as never, input, NOW);
  assert.equal(result.change_type, 'downgrade_scheduled');
  assert.equal(tables.profiles[0].role, 'pro');
  assert.equal(tables.profiles[0].pending_plan_role, 'starter');
  assert.equal(tables.profiles[0].pending_plan_start_date, '2027-01-01');
});

test('if the plan update fails, the payment record is removed so a retry can switch it on', async () => {
  const tables = { profiles: [{ id: 'user-1', role: 'free' }] as Row[], payments: [] as Row[] };
  const admin = fakeAdmin(tables, { failProfileUpdate: true }) as never;
  await assert.rejects(applyPaidPlan(admin, input, NOW));
  assert.equal(tables.payments.length, 0);
  assert.equal(tables.profiles[0].role, 'free');

  const retry = await applyPaidPlan(admin, input, NOW);
  assert.equal(retry.already_applied, false);
  assert.equal(tables.profiles[0].role, 'starter');
});

// Webhook
const SECRET = 'test-webhook-secret';
function signed(body: object) {
  const raw = Buffer.from(JSON.stringify(body));
  return { raw, signature: crypto.createHmac('sha256', SECRET).update(raw).digest('hex') };
}
function capturedEvent(overrides: Row = {}) {
  return {
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', status: 'captured', amount: 15000, ...overrides } } },
  };
}
function deps(tables: { profiles: Row[]; payments: Row[] }, notes: Row = { userId: 'user-1', planId: 'starter', duration: 'monthly' }) {
  return {
    secret: SECRET,
    supabaseAdmin: () => fakeAdmin(tables) as never,
    fetchOrder: async () => ({ amount: 15000, currency: 'INR', notes }),
  };
}

test('webhook: a signed captured payment switches the plan on', async () => {
  const tables = { profiles: [{ id: 'user-1', role: 'free' }] as Row[], payments: [] as Row[] };
  const { raw, signature } = signed(capturedEvent());
  const result = await handleRazorpayWebhook(raw, signature, deps(tables));
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(tables.profiles[0].role, 'starter');
  assert.match(String(tables.payments[0].notes), /webhook/);

  // Razorpay sends order.paid for the same payment too: no second change
  const again = signed({ ...capturedEvent(), event: 'order.paid' });
  const second = await handleRazorpayWebhook(again.raw, again.signature, deps(tables));
  assert.equal(second.body.already_applied, true);
  assert.equal(tables.payments.length, 1);
});

test('webhook: a wrong or missing signature changes nothing', async () => {
  const tables = { profiles: [{ id: 'user-1', role: 'free' }] as Row[], payments: [] as Row[] };
  const { raw } = signed(capturedEvent());
  assert.equal((await handleRazorpayWebhook(raw, 'not-the-signature', deps(tables))).status, 400);
  assert.equal((await handleRazorpayWebhook(raw, undefined, deps(tables))).status, 400);
  assert.equal(tables.profiles[0].role, 'free');
});

test('webhook: without a secret it refuses (503) rather than trusting the body', async () => {
  const { raw, signature } = signed(capturedEvent());
  const result = await handleRazorpayWebhook(raw, signature, { ...deps({ profiles: [], payments: [] }), secret: undefined });
  assert.equal(result.status, 503);
});

test('webhook: other events, old orders without a buyer and amount mismatches are skipped with 200', async () => {
  const tables = { profiles: [{ id: 'user-1', role: 'free' }] as Row[], payments: [] as Row[] };

  const failed = signed(capturedEvent({ status: 'failed' }));
  assert.equal((await handleRazorpayWebhook(failed.raw, failed.signature, deps(tables))).body.ignored, true);

  const other = signed({ ...capturedEvent(), event: 'refund.created' });
  assert.equal((await handleRazorpayWebhook(other.raw, other.signature, deps(tables))).body.ignored, true);

  const ok = signed(capturedEvent());
  const oldOrder = await handleRazorpayWebhook(ok.raw, ok.signature, deps(tables, { planId: 'starter', duration: 'monthly' }));
  assert.equal(oldOrder.status, 200);
  assert.equal(oldOrder.body.ignored, true);

  const cheap = signed(capturedEvent({ amount: 100 }));
  assert.equal((await handleRazorpayWebhook(cheap.raw, cheap.signature, deps(tables))).body.ignored, true);

  assert.equal(tables.profiles[0].role, 'free');
  assert.equal(tables.payments.length, 0);
});

test('webhook: a failure while switching the plan on returns 500 so Razorpay retries', async () => {
  const tables = { profiles: [{ id: 'user-1', role: 'free' }] as Row[], payments: [] as Row[] };
  const { raw, signature } = signed(capturedEvent());
  const result = await handleRazorpayWebhook(raw, signature, {
    ...deps(tables),
    fetchOrder: async () => { throw new Error('Razorpay is down'); },
  });
  assert.equal(result.status, 500);
});

// Issue #319: failed-payment logging needs a signed-in buyer and keeps the text short
function logFailure(body: Row) {
  const layer = (paymentsRouter.stack as any[]).find((l) => l.route?.path === '/log-failure');
  return new Promise<{ status: number; data: any }>((resolve) => {
    let status = 200;
    const req = { body, get: () => '', headers: {}, log: { warn() {} } };
    const res = { status(code: number) { status = code; return res; }, json(data: unknown) { resolve({ status, data }); return res; } };
    layer.route.stack[0].handle(req, res);
  });
}

test('log-failure: refused without a login (issue #319)', async () => {
  delete process.env.PAYMENT_FAILURE_LOG_REQUIRES_LOGIN;
  const result = await logFailure({ planId: 'starter', failureReason: 'test' });
  assert.equal(result.status, 401);
});

test('log-failure: text is cut to a sane length; the kill switch keeps it as sent', () => {
  const long = 'x'.repeat(5000);
  const row = paymentFailureRow({ planId: long, duration: long, orderId: long, paymentId: long, failureReason: long }, 'user-1', true);
  assert.equal(String(row.plan_id).length, 64);
  assert.equal(String(row.billing_duration).length, 32);
  assert.equal(String(row.razorpay_order_id).length, 64);
  assert.equal(String(row.razorpay_payment_id).length, 64);
  assert.equal(String(row.failure_reason).length, 1000);
  assert.equal(row.user_id, 'user-1');
  const real = { orderId: 'order_ABC', paymentId: null, planId: 'starter', duration: 'monthly', failureReason: 'BAD_REQUEST_ERROR: Payment cancelled' };
  assert.deepEqual(paymentFailureRow(real, 'u', true), paymentFailureRow(real, 'u', false), 'real failures are stored the same');
  assert.equal(paymentFailureRow({ failureReason: long }, null, false).failure_reason, long);
  assert.equal(paymentFailureRow({}, 'u', true).plan_id, 'unknown');
});
