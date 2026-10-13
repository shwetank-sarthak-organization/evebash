import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createPermissionsRouter } from '../src/routes/permissions.js';
import { describeUploaders } from '../src/routes/uploaders.js';

type Row = Record<string, unknown>;

/** Supports select().eq()/.in() chains, awaited directly or with maybeSingle(). */
function fakeAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      const rows = () => (tables[table] || []).filter((row) => filters.every((keep) => keep(row)));
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder; },
        in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return builder; },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (value: { data: Row[]; error: null }) => unknown) => resolve({ data: rows(), error: null }),
      };
      return builder;
    },
  };
}

const OWNER = '11111111-1111-1111-1111-111111111111';
const ADMIN = '22222222-2222-2222-2222-222222222222';
const GUEST = '33333333-3333-3333-3333-333333333333';
const LEFT = '44444444-4444-4444-4444-444444444444';
const GONE = '55555555-5555-5555-5555-555555555555';

const tables = {
  events: [
    { id: 'wedding', parent_id: null, legacy_id: 'old-wedding', created_by: OWNER },
    { id: 'haldi', parent_id: 'old-wedding', legacy_id: null, created_by: OWNER },
  ],
  profiles: [
    { id: OWNER, name: 'Asha', email: 'asha@example.com' },
    { id: ADMIN, name: 'Rahul', email: 'rahul@example.com' },
    { id: GUEST, name: '', email: 'priya@example.com' },
    { id: LEFT, name: 'Amit', email: 'amit@example.com' },
  ],
  guests: [
    { event_id: 'wedding', user_id: ADMIN, status: 'approved', can_admin: true },
    { event_id: 'wedding', user_id: GUEST, status: 'approved', can_admin: false },
    { event_id: 'wedding', user_id: LEFT, status: 'pending', can_admin: false },
  ],
};

test('uploaders get names and roles relative to the top-level event', async () => {
  // A sub-gallery linked to its parent by the legacy id still uses the parent's owner and guests
  const result = await describeUploaders(fakeAdmin(tables) as never, 'haldi', [OWNER, ADMIN, GUEST, LEFT, GONE, 'anonymous']);
  assert.deepEqual(result, [
    { userId: OWNER, name: 'Asha', role: 'owner' },
    { userId: ADMIN, name: 'Rahul', role: 'admin' },
    { userId: GUEST, name: 'priya', role: 'guest' },
    { userId: LEFT, name: 'Amit', role: 'former_guest' },
    { userId: GONE, name: 'Deleted user', role: 'deleted' },
    { userId: 'anonymous', name: 'Anonymous', role: 'anonymous' },
  ]);
  assert.equal(await describeUploaders(fakeAdmin(tables) as never, 'missing', [OWNER]), null);
});

test('only gallery managers can list uploaders', async () => {
  let access: 'allowed' | 'login' | 'forbidden' = 'login';
  const app = express();
  app.use(express.json());
  app.use('/permissions', createPermissionsRouter(
    async () => 'forbidden',
    () => fakeAdmin(tables) as never,
    async () => false,
    async () => access,
  ));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/permissions/uploaders`;
  const post = async (body: object) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };

  try {
    assert.equal((await post({ eventId: 'wedding', userIds: [OWNER] })).status, 401);
    access = 'forbidden';
    assert.equal((await post({ eventId: 'wedding', userIds: [OWNER] })).status, 403);
    access = 'allowed';
    assert.equal((await post({ eventId: 'wedding' })).status, 400);
    assert.equal((await post({ eventId: 'wedding', userIds: Array.from({ length: 501 }, (_, i) => `u${i}`) })).status, 400);
    const ok = await post({ eventId: 'wedding', userIds: [OWNER, OWNER, ADMIN] });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.uploaders.map((u: { role: string }) => u.role), ['owner', 'admin']);
  } finally {
    server.close();
  }
});
