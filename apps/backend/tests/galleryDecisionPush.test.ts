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

test('approval push goes to the guest once, only when a gallery host triggers it', async () => {
  const tables: Record<string, Row[]> = {
    events: [
      { id: 'wedding' },
      { id: 'check_photo_13-j1cq' },
    ],
    guests: [
      { id: 'u-asha_wedding', event_id: 'wedding', user_id: 'asha', phone: null, status: 'approved', event_title: 'Wedding' },
      { id: 'u-ravi_wedding', event_id: 'wedding', user_id: 'ravi', phone: null, status: 'rejected', event_title: 'Wedding' },
      { id: 'u-neha_wedding', event_id: 'wedding', user_id: 'neha', phone: null, status: 'pending', event_title: 'Wedding' },
      { id: 'u-quiet_wedding', event_id: 'wedding', user_id: 'quiet', phone: null, status: 'approved', event_title: 'Wedding' },
      // Old row: no event_id or user_id, a gallery id with "_" in it, found by phone
      { id: '9876543210_check_photo_13-j1cq', event_id: null, user_id: null, phone: '9876543210', status: 'approved', event_title: 'Check' },
    ],
    profiles: [
      { id: 'asha', phone: null, push_token: 'ExponentPushToken[asha]', notification_preferences: null },
      { id: 'ravi', phone: null, push_token: 'ExponentPushToken[ravi]', notification_preferences: { eventInvites: true } },
      { id: 'neha', phone: null, push_token: 'ExponentPushToken[neha]', notification_preferences: null },
      { id: 'quiet', phone: null, push_token: 'ExponentPushToken[quiet]', notification_preferences: '{"eventInvites":false}' },
      { id: 'old-guest', phone: '9876543210', push_token: 'ExponentPushToken[old]', notification_preferences: null },
    ],
  };
  let caller: string | null = null;
  let clock = 1_000_000;
  const sent: ExpoPush[] = [];
  const checked: string[] = [];
  const verify = async () => caller
    ? ({ user: { id: caller }, supabaseAdmin: fakeAdmin(tables) } as unknown as NonNullable<Awaited<ReturnType<typeof verifySupabaseUser>>>)
    : null;
  // Only "host" manages the galleries; everyone else is a member at most
  const galleryAccess = async (_request: unknown, eventId: string) => {
    checked.push(eventId);
    return caller === 'host' ? 'manage' : 'member';
  };

  const app = express();
  app.use(express.json());
  app.use('/notifications', createNotificationsRouter(verify, async push => { sent.push(push); }, () => clock, galleryAccess as never));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/notifications/gallery-decision`;
  const post = async (body: object) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as { sent?: boolean } };
  };

  try {
    assert.equal((await post({ guestId: 'u-asha_wedding' })).status, 401);

    // A guest can't make the server push other guests
    caller = 'asha';
    assert.equal((await post({ guestId: 'u-asha_wedding' })).status, 403);
    assert.equal(sent.length, 0);

    caller = 'host';
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ guestId: 'nope' })).status, 404);

    assert.equal((await post({ guestId: 'u-asha_wedding' })).body.sent, true);
    assert.deepEqual(sent[0], {
      token: 'ExponentPushToken[asha]',
      title: 'Access Approved! ✨',
      body: 'You have been approved to join the event "Wedding"!',
      data: { eventId: 'wedding' },
    });

    // Repeats within the window are skipped; after it they're sent again
    assert.equal((await post({ guestId: 'u-asha_wedding' })).body.sent, false);
    clock += GALLERY_REQUEST_PUSH_WINDOW_MS + 1;
    assert.equal((await post({ guestId: 'u-asha_wedding' })).body.sent, true);

    // Turned down: the softer "updated" message, as the website sent before
    assert.equal((await post({ guestId: 'u-ravi_wedding' })).body.sent, true);
    assert.equal(sent.at(-1)?.title, 'Access Request Update');

    // Still pending, or the guest turned off "Event invites": nothing
    assert.equal((await post({ guestId: 'u-neha_wedding' })).body.sent, false);
    assert.equal((await post({ guestId: 'u-quiet_wedding' })).body.sent, false);

    // Old row: gallery found from the id (despite "_" in the gallery id), guest found by phone
    assert.equal((await post({ guestId: '9876543210_check_photo_13-j1cq' })).body.sent, true);
    assert.deepEqual(sent.at(-1)?.data, { eventId: 'check_photo_13-j1cq' });
    assert.equal(checked.at(-1), 'check_photo_13-j1cq');

    // Kill switch
    process.env.GALLERY_APPROVAL_PUSH = 'false';
    clock += GALLERY_REQUEST_PUSH_WINDOW_MS + 1;
    const before = sent.length;
    assert.equal((await post({ guestId: 'u-asha_wedding' })).body.sent, false);
    assert.equal(sent.length, before);
  } finally {
    delete process.env.GALLERY_APPROVAL_PUSH;
    server.close();
  }
});
