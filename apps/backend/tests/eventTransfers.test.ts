import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createEventTransfersRouter } from '../src/routes/eventTransfers.js';
import { checkReceiverCapacity, isEventTransferPending, type ReceiverCapacity } from '../src/services/eventTransfers.js';

type Row = Record<string, any>;
const GB = 1024 ** 3;
const NOW = new Date('2026-11-04T10:00:00Z');

function fakeAdmin(tables: Record<string, Row[]>, sizeBytes = 2 * GB) {
  const rpcCalls: { name: string; args: Row }[] = [];
  const ilikeSeen: string[] = [];
  return {
    rpcCalls,
    ilikeSeen,
    rpc: async (name: string, args: Row) => {
      rpcCalls.push({ name, args });
      return { data: name === 'event_transfer_size_bytes' ? sizeBytes : 'wedding', error: null };
    },
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      const rows = () => (tables[table] || []).filter((row) => filters.every((keep) => keep(row)));
      let patch: Row | null = null;
      let inserted: Row | null = null;
      let insertError: Row | null = null;
      const settle = () => {
        if (patch) for (const row of rows()) Object.assign(row, patch);
        return rows();
      };
      const builder: any = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder; },
        in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return builder; },
        lt: (column: string, value: string) => { filters.push((row) => row[column] < value); return builder; },
        ilike: (column: string, pattern: string) => {
          ilikeSeen.push(pattern);
          const wanted = pattern.replace(/\\/g, '').toLowerCase();
          filters.push((row) => String(row[column] ?? '').toLowerCase() === wanted);
          return builder;
        },
        update: (values: Row) => { patch = values; return builder; },
        insert: (values: Row) => {
          if ((tables[table] || []).some((row) => row.event_id === values.event_id && row.status === 'pending')) {
            insertError = { code: '23505', message: 'duplicate' };
          } else {
            inserted = { id: `t-${(tables[table] || []).length + 1}`, status: 'pending', ...values };
            (tables[table] ||= []).push(inserted);
          }
          return builder;
        },
        single: async () => (insertError ? { data: null, error: insertError } : { data: inserted, error: null }),
        maybeSingle: async () => ({ data: settle()[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data: settle(), error: null }),
      };
      return builder;
    },
  };
}

const USERS: Record<string, Row> = {
  owner: { id: 'owner', email: 'asha@example.com' },
  receiver: { id: 'receiver', email: 'Rahul@Example.com' },
  eventAdmin: { id: 'eventAdmin', email: 'priya@example.com' },
  platform: { id: 'platform', email: 'support@example.com' },
};

function freshTables(extraTransfers: Row[] = []) {
  return {
    events: [
      { id: 'wedding', title: 'Wedding', parent_id: null, legacy_id: 'old-wedding', created_by: 'owner', type: 'main' },
      { id: 'haldi', title: 'Haldi', parent_id: 'old-wedding', legacy_id: null, created_by: 'eventAdmin', type: 'sub' },
    ],
    profiles: [
      { id: 'owner', name: 'Asha', email: 'asha@example.com', role: 'starter' },
      { id: 'receiver', name: 'Rahul', email: 'rahul@example.com', role: 'starter' },
      { id: 'eventAdmin', name: 'Priya', email: 'priya@example.com', role: 'starter' },
      { id: 'platform', name: 'Support', email: 'support@example.com', role: 'admin', delegated_by: null },
    ],
    event_transfers: extraTransfers,
  } as Record<string, Row[]>;
}

const openTransfer = (changes: Row = {}): Row => ({
  id: 't-1',
  event_id: 'wedding',
  from_user_id: 'owner',
  requested_by: 'owner',
  to_user_id: 'receiver',
  keep_old_owner_as_admin: true,
  status: 'pending',
  created_at: '2026-11-01T00:00:00.000Z',
  expires_at: '2026-11-08T00:00:00.000Z',
  ...changes,
});

const CAN_ACCEPT: ReceiverCapacity = { canAccept: true, block: null, neededBytes: 2 * GB, freeBytes: 8 * GB };
const NO_SPACE: ReceiverCapacity = { canAccept: false, block: 'needs_space', neededBytes: 2 * GB, freeBytes: GB };

async function withServer(
  admin: ReturnType<typeof fakeAdmin>,
  capacity: ReceiverCapacity,
  run: (call: (as: string, method: string, path: string, body?: Row) => Promise<{ status: number; body: any }>, pushes: Row[]) => Promise<void>,
) {
  const pushes: Row[] = [];
  const app = express();
  app.use(express.json());
  app.use('/', createEventTransfersRouter({
    verifyUser: (async (request: express.Request) => {
      const user = USERS[String(request.headers['x-test-user'])];
      return user ? { user, supabaseAdmin: admin } : null;
    }) as never,
    checkCapacity: async () => capacity,
    notify: async (_admin, userId, message) => { pushes.push({ userId, ...message }); },
  }, () => NOW));
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  try {
    await run(async (as, method, path, body) => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: { 'content-type': 'application/json', 'x-test-user': as },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: response.status, body: await response.json() };
    }, pushes);
  } finally {
    server.close();
  }
}

test('the owner starts a transfer, and a sub-gallery id means the whole event', async () => {
  const tables = freshTables();
  await withServer(fakeAdmin(tables), NO_SPACE, async (call, pushes) => {
    const result = await call('owner', 'POST', '/', { eventId: 'haldi', toEmail: ' rahul@EXAMPLE.com ' });
    assert.equal(result.status, 200);
    // A request can wait for the receiver to free up space or upgrade
    assert.equal(result.body.receiverReady, false);
    const [row] = tables.event_transfers;
    assert.equal(row.event_id, 'wedding');
    assert.equal(row.from_user_id, 'owner');
    assert.equal(row.to_user_id, 'receiver');
    assert.equal(row.keep_old_owner_as_admin, true);
    assert.equal(row.expires_at, '2026-11-11T10:00:00.000Z');
    assert.equal(pushes[0].userId, 'receiver');
  });
});

test('an event admin cannot start a transfer; a platform admin can, for the owner', async () => {
  const tables = freshTables();
  await withServer(fakeAdmin(tables), CAN_ACCEPT, async (call) => {
    assert.equal((await call('eventAdmin', 'POST', '/', { eventId: 'wedding', toEmail: 'rahul@example.com' })).status, 403);
    assert.equal(tables.event_transfers.length, 0);
    assert.equal((await call('platform', 'POST', '/', { eventId: 'wedding', toEmail: 'rahul@example.com', keepOldOwnerAsAdmin: false })).status, 200);
    assert.equal(tables.event_transfers[0].from_user_id, 'owner');
    assert.equal(tables.event_transfers[0].requested_by, 'platform');
    assert.equal(tables.event_transfers[0].keep_old_owner_as_admin, false);
  });
});

test('the receiver must have an account and be someone else, and an event has one open request', async () => {
  const admin = fakeAdmin(freshTables([openTransfer()]));
  await withServer(admin, CAN_ACCEPT, async (call) => {
    const missing = await call('owner', 'POST', '/', { eventId: 'wedding', toEmail: 'nobody@example.com' });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'no_account');
    assert.equal((await call('owner', 'POST', '/', { eventId: 'wedding', toEmail: 'asha@example.com' })).status, 400);
    const second = await call('owner', 'POST', '/', { eventId: 'wedding', toEmail: 'priya@example.com' });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, 'already_pending');
  });
});

test('an email is matched whole: wildcards in it match nothing else', async () => {
  const admin = fakeAdmin(freshTables());
  await withServer(admin, CAN_ACCEPT, async (call) => {
    assert.equal((await call('owner', 'POST', '/', { eventId: 'wedding', toEmail: '%@example.com' })).status, 404);
    assert.equal(admin.ilikeSeen[0], '\\%@example.com');
  });
});

test('accepting needs space, and only the receiver can do it', async () => {
  const tables = freshTables([openTransfer()]);
  const admin = fakeAdmin(tables);
  await withServer(admin, NO_SPACE, async (call) => {
    assert.equal((await call('eventAdmin', 'POST', '/t-1/accept')).status, 403);
    const refused = await call('receiver', 'POST', '/t-1/accept');
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, 'needs_space');
    assert.equal(refused.body.neededBytes, 2 * GB);
    assert.match(refused.body.error, /You need 1 GB more/);
    assert.ok(!admin.rpcCalls.some((rpc) => rpc.name === 'complete_event_transfer'));
    assert.equal(tables.event_transfers[0].status, 'pending');
  });
});

test('accepting with space completes the move and tells the old owner', async () => {
  const admin = fakeAdmin(freshTables([openTransfer()]));
  await withServer(admin, CAN_ACCEPT, async (call, pushes) => {
    const result = await call('receiver', 'POST', '/t-1/accept');
    assert.equal(result.status, 200);
    assert.deepEqual(admin.rpcCalls.at(-1), { name: 'complete_event_transfer', args: { p_transfer_id: 't-1', p_to_user_id: 'receiver' } });
    assert.equal(pushes[0].userId, 'owner');
  });
});

test('a request past its 7 days cannot be accepted', async () => {
  const tables = freshTables([openTransfer({ expires_at: '2026-11-04T09:59:00.000Z' })]);
  const admin = fakeAdmin(tables);
  await withServer(admin, CAN_ACCEPT, async (call) => {
    const result = await call('receiver', 'POST', '/t-1/accept');
    assert.equal(result.status, 409);
    assert.equal(result.body.code, 'expired');
    assert.equal(tables.event_transfers[0].status, 'expired');
    assert.ok(!admin.rpcCalls.some((rpc) => rpc.name === 'complete_event_transfer'));
  });
});

test('only the receiver declines, and only the owner side cancels', async () => {
  const declined = freshTables([openTransfer()]);
  await withServer(fakeAdmin(declined), CAN_ACCEPT, async (call, pushes) => {
    assert.equal((await call('owner', 'POST', '/t-1/decline')).status, 403);
    assert.equal((await call('receiver', 'POST', '/t-1/decline')).status, 200);
    assert.equal(declined.event_transfers[0].status, 'declined');
    assert.equal(pushes[0].userId, 'owner');
    assert.equal((await call('receiver', 'POST', '/t-1/decline')).status, 409);
  });

  const cancelled = freshTables([openTransfer()]);
  await withServer(fakeAdmin(cancelled), CAN_ACCEPT, async (call) => {
    assert.equal((await call('receiver', 'POST', '/t-1/cancel')).status, 403);
    assert.equal((await call('owner', 'POST', '/t-1/cancel')).status, 200);
    assert.equal(cancelled.event_transfers[0].status, 'cancelled');
  });
});

test('the receiver sees the size and their space; the owner only sees yes or no', async () => {
  await withServer(fakeAdmin(freshTables([openTransfer()])), NO_SPACE, async (call) => {
    const incoming = await call('receiver', 'GET', '/incoming');
    const [request] = incoming.body.requests;
    assert.equal(request.eventTitle, 'Wedding');
    assert.equal(request.fromName, 'Asha');
    assert.equal(request.sizeBytes, 2 * GB);
    assert.equal(request.freeBytes, GB);
    assert.equal(request.canAccept, false);
    assert.equal(request.block, 'needs_space');
    assert.equal((await call('owner', 'GET', '/incoming')).body.requests.length, 0);

    const view = await call('owner', 'GET', '/event/haldi');
    assert.equal(view.body.eventId, 'wedding');
    assert.equal(view.body.sizeBytes, 2 * GB);
    assert.equal(view.body.pending.receiverReady, false);
    assert.equal(view.body.pending.freeBytes, undefined);
    assert.equal((await call('eventAdmin', 'GET', '/event/wedding')).status, 403);
  });
});

// The space check itself
const receiver = { id: 'receiver', email: 'rahul@example.com' };
const repoWith = (profile: Row, eventBytes: number, usedBytes = 0, reservedBytes = 0) => ({
  getProfile: async () => profile,
  getEventStorageBytes: async () => eventBytes,
  getAccount: async () => ({ usedBytes, reservedBytes }),
  getRetainedItemIds: async () => new Set<string>(),
}) as never;
const ACTIVE = { role: 'starter', planEndDate: '2027-01-01' };

test('free space counts events and EB Vault', async () => {
  // 10 GB plan with 3 GB of events and 2 + 1 GB in the Vault leaves 4 GB
  const repo = repoWith(ACTIVE, 3 * GB, 2 * GB, GB);
  const fits = await checkReceiverCapacity(receiver, 4 * GB, { repo, countEvents: async () => 0, now: NOW });
  assert.deepEqual(fits, { canAccept: true, block: null, neededBytes: 4 * GB, freeBytes: 4 * GB });
  const tooBig = await checkReceiverCapacity(receiver, 4 * GB + 1, { repo, countEvents: async () => 0, now: NOW });
  assert.equal(tooBig.block, 'needs_space');
});

test('an expired plan or a full event list refuses, and a platform admin has no limits', async () => {
  const expired = repoWith({ role: 'starter', planEndDate: '2026-10-01' }, 0);
  assert.equal((await checkReceiverCapacity(receiver, 1, { repo: expired, countEvents: async () => 0, now: NOW })).block, 'plan_expired');

  const roomy = repoWith(ACTIVE, 0);
  assert.equal((await checkReceiverCapacity(receiver, 1, { repo: roomy, countEvents: async () => 10, now: NOW })).block, 'no_event_slot');
  assert.equal((await checkReceiverCapacity(receiver, 1, { repo: roomy, countEvents: async () => 9, now: NOW })).canAccept, true);

  const unlimited = await checkReceiverCapacity(receiver, 900 * GB, { repo: repoWith({ role: 'admin', planEndDate: null }, 0), countEvents: async () => 99999, now: NOW });
  assert.deepEqual(unlimited, { canAccept: true, block: null, neededBytes: 900 * GB, freeBytes: null });
});

test('uploads pause on the whole event while a transfer waits, and not if the check fails', async () => {
  const later = new Date(Date.now() + 60_000).toISOString();
  const waiting = fakeAdmin(freshTables([openTransfer({ expires_at: later })])) as never;
  assert.equal(await isEventTransferPending('wedding', () => waiting), true);
  assert.equal(await isEventTransferPending('haldi', () => waiting), true);

  const past = fakeAdmin(freshTables([openTransfer({ expires_at: '2020-01-01T00:00:00.000Z' })])) as never;
  assert.equal(await isEventTransferPending('wedding', () => past), false);
  assert.equal(await isEventTransferPending('wedding', () => fakeAdmin(freshTables()) as never), false);

  // For example before the migration is applied
  assert.equal(await isEventTransferPending('wedding', () => { throw new Error('no table'); }), false);
});
