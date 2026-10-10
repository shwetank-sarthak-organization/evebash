import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';
import { checkGuestRouteAccessAsCaller, createPermissionsRouter } from '../src/routes/permissions.js';
import type { verifySupabaseUser } from '../src/auth.js';

type Row = Record<string, unknown>;

function fakeAdmin(tables: Record<string, Row[]>, writes: string[] = []) {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let action = 'select';
      const builder: any = {
        select: () => builder,
        update: () => { action = 'update'; return builder; },
        delete: () => { action = 'delete'; return builder; },
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          if (action !== 'select') {
            writes.push(`${action} ${table} ${String(value)}`);
            return Promise.resolve({ error: null });
          }
          return builder;
        },
        maybeSingle: async () => ({
          data: (tables[table] || []).find(row => filters.every(([column, value]) => row[column] === value)) ?? null,
          error: null,
        }),
      };
      return builder;
    },
  };
}

test('guest routes refuse anyone who only claims to be an admin in the request body', async () => {
  const writes: string[] = [];
  let access: 'allowed' | 'login' | 'forbidden' = 'login';
  const app = express();
  app.use(express.json());
  app.use('/permissions', createPermissionsRouter(async () => access, () => fakeAdmin({}, writes) as never));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/permissions`;
  const post = async (path: string, body: object) => {
    const response = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return response.status;
  };
  const fakeSuperAdmin = { email: 'code4sarthak@gmail.com' };

  try {
    // Not logged in: the body's "requester" no longer counts
    assert.equal(await post('update-guest-status', { logId: 'g1', status: 'approved', requester: fakeSuperAdmin }), 401);
    assert.equal(await post('update-guest-permissions', { logId: 'g1', permissions: { canAdmin: true }, requester: fakeSuperAdmin }), 401);
    assert.equal(await post('delete-guest', { logId: 'g1', requester: fakeSuperAdmin }), 401);

    // Logged in but not a host of that gallery
    access = 'forbidden';
    assert.equal(await post('update-guest-status', { logId: 'g1', status: 'approved' }), 403);
    assert.equal(await post('delete-guest', { logId: 'g1' }), 403);
    assert.deepEqual(writes, []);

    // A host of the gallery
    access = 'allowed';
    assert.equal(await post('update-guest-status', { logId: 'g1', status: 'whatever' }), 400);
    assert.equal(await post('update-guest-status', { logId: 'g1', status: 'approved' }), 200);
    assert.equal(await post('update-guest-permissions', { logId: 'g1', permissions: { canUpload: false } }), 200);
    assert.equal(await post('delete-guest', { logId: 'g1' }), 200);
    assert.deepEqual(writes, ['update guests g1', 'update guests g1', 'delete guests g1']);

    // Kill switch: back to the old check (body-based); an unknown requester is still refused
    process.env.GUEST_ROUTES_REQUIRE_LOGIN = 'false';
    access = 'login';
    assert.equal(await post('delete-guest', { logId: 'g1' }), 403);
  } finally {
    delete process.env.GUEST_ROUTES_REQUIRE_LOGIN;
    server.close();
  }
});

test('the host check uses the guest row\'s gallery, old rows included', async () => {
  const tables = {
    guests: [
      { id: 'u1_wedding', event_id: 'wedding' },
      { id: '9876543210_check_photo_13-j1cq', event_id: null },
    ],
    events: [{ id: 'check_photo_13-j1cq' }],
  };
  const asked: string[] = [];
  const request = {} as Request;
  const verify = async () => ({ user: { id: 'host' }, supabaseAdmin: fakeAdmin(tables) }) as unknown as NonNullable<Awaited<ReturnType<typeof verifySupabaseUser>>>;
  const hostOfWeddingOnly = async (_req: Request, eventId: string) => { asked.push(eventId); return eventId === 'wedding' ? 'manage' : 'member'; };

  assert.equal(await checkGuestRouteAccessAsCaller(request, 'u1_wedding', verify, hostOfWeddingOnly), 'allowed');
  assert.equal(await checkGuestRouteAccessAsCaller(request, '9876543210_check_photo_13-j1cq', verify, hostOfWeddingOnly), 'forbidden');
  assert.deepEqual(asked, ['wedding', 'check_photo_13-j1cq']);
  assert.equal(await checkGuestRouteAccessAsCaller(request, 'missing', verify, hostOfWeddingOnly), 'forbidden');
  assert.equal(await checkGuestRouteAccessAsCaller(request, 'u1_wedding', async () => null, hostOfWeddingOnly), 'login');
});
