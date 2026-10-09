import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createNotificationsRouter, GALLERY_REQUEST_PUSH_WINDOW_MS, type ExpoPush } from '../src/routes/notifications.js';
import type { verifySupabaseUser } from '../src/auth.js';

type Row = Record<string, unknown>;

// Just enough of the Supabase client for the route: from(table).select().eq()...maybeSingle()
function fakeAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
        maybeSingle: async () => ({
          data: (tables[table] || []).find(row => filters.every(([column, value]) => row[column] === value)) ?? null,
          error: null,
        }),
      };
      return builder;
    },
  };
}

test('gallery request push goes to the owner once, only for a real pending request', async () => {
  const tables: Record<string, Row[]> = {
    events: [
      { id: 'wedding', parent_id: null, created_by: 'owner', title: 'Wedding', join_id: 'WEDD-1234', legacy_id: null },
      { id: 'wedding-haldi', parent_id: 'wedding', created_by: 'owner', title: 'Haldi', join_id: null, legacy_id: null },
      { id: 'quiet', parent_id: null, created_by: 'quiet-owner', title: 'Quiet', join_id: null, legacy_id: null },
    ],
    guests: [
      { user_id: 'guest', event_id: 'wedding', name: 'Asha', status: 'pending' },
      { user_id: 'member', event_id: 'wedding', name: 'Ravi', status: 'approved' },
      { user_id: 'guest', event_id: 'quiet', name: 'Asha', status: 'pending' },
    ],
    profiles: [
      { id: 'owner', push_token: 'ExponentPushToken[owner]', notification_preferences: { eventInvites: true } },
      { id: 'quiet-owner', push_token: 'ExponentPushToken[quiet]', notification_preferences: '{"eventInvites":false}' },
    ],
  };
  let caller: string | null = null;
  let clock = 1_000_000;
  const sent: ExpoPush[] = [];
  const verify = async () => caller
    ? ({ user: { id: caller }, supabaseAdmin: fakeAdmin(tables) } as unknown as NonNullable<Awaited<ReturnType<typeof verifySupabaseUser>>>)
    : null;

  const app = express();
  app.use(express.json());
  app.use('/notifications', createNotificationsRouter(verify, async push => { sent.push(push); }, () => clock));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/notifications/gallery-request`;
  const post = async (body: object) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as { sent?: boolean } };
  };

  try {
    assert.equal((await post({ ref: 'wedding' })).status, 401);
    caller = 'guest';
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ ref: 'nope' })).status, 404);

    // A sub-gallery link or a join code both notify the top-level gallery's owner
    assert.equal((await post({ ref: 'wedding-haldi' })).body.sent, true);
    assert.deepEqual(sent, [{
      token: 'ExponentPushToken[owner]',
      title: 'New access request 🔔',
      body: 'Asha is asking to join "Wedding".',
      data: { eventId: 'wedding' },
    }]);

    // Asking again soon after doesn't push again; after the window it does
    assert.equal((await post({ ref: 'WEDD-1234' })).body.sent, false);
    clock += GALLERY_REQUEST_PUSH_WINDOW_MS + 1;
    assert.equal((await post({ ref: 'WEDD-1234' })).body.sent, true);
    assert.equal(sent.length, 2);

    // Approved members, the owner and owners who turned off "Event invites" get nothing
    caller = 'member';
    assert.equal((await post({ ref: 'wedding' })).body.sent, false);
    caller = 'owner';
    assert.equal((await post({ ref: 'wedding' })).body.sent, false);
    caller = 'guest';
    assert.equal((await post({ ref: 'quiet' })).body.sent, false);

    // Kill switch
    process.env.GALLERY_REQUEST_PUSH = 'false';
    clock += GALLERY_REQUEST_PUSH_WINDOW_MS + 1;
    assert.equal((await post({ ref: 'wedding' })).body.sent, false);
    assert.equal(sent.length, 2);
  } finally {
    delete process.env.GALLERY_REQUEST_PUSH;
    server.close();
  }
});
