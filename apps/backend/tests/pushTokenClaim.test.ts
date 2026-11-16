import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createNotificationsRouter } from '../src/routes/notifications.js';
import type { verifySupabaseUser } from '../src/auth.js';

type Row = Record<string, unknown>;

// Just enough of the Supabase client for the route: from('profiles').update().eq()/.neq(), awaited directly or
// ending in .select() to return the changed rows.
function fakeAdmin(profiles: Row[]) {
  return {
    from(table: string) {
      assert.equal(table, 'profiles');
      let patch: Row = {};
      const filters: ((row: Row) => boolean)[] = [];
      const run = async (returnRows: boolean) => {
        const hit = profiles.filter(row => filters.every(keep => keep(row)));
        for (const row of hit) Object.assign(row, patch);
        return { data: returnRows ? hit.map(row => ({ id: row.id })) : null, error: null };
      };
      const builder = {
        update: (values: Row) => { patch = values; return builder; },
        eq: (column: string, value: unknown) => { filters.push(row => row[column] === value); return builder; },
        neq: (column: string, value: unknown) => { filters.push(row => row[column] !== value); return builder; },
        select: () => run(true),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => run(false).then(resolve, reject),
      };
      return builder;
    },
  };
}

test('push token moves to the signed-in account and off every other account (#104)', async () => {
  const phone = 'ExponentPushToken[phone-1]';
  const otherPhone = 'ExponentPushToken[phone-2]';
  const profiles: Row[] = [
    { id: 'asha', push_token: phone },
    { id: 'ravi', push_token: phone },
    { id: 'meera', push_token: otherPhone },
    { id: 'kabir', push_token: null },
  ];
  let caller: string | null = null;
  const verify = async () => caller
    ? ({ user: { id: caller }, supabaseAdmin: fakeAdmin(profiles) } as unknown as NonNullable<Awaited<ReturnType<typeof verifySupabaseUser>>>)
    : null;

  const app = express();
  app.use(express.json());
  app.use('/notifications', createNotificationsRouter(verify));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/notifications/push-token`;
  const post = async (body: object) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as { released?: number; skipped?: boolean } };
  };
  const tokens = () => Object.fromEntries(profiles.map(row => [row.id, row.push_token]));

  try {
    assert.equal((await post({ token: phone })).status, 401);
    caller = 'kabir';
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ token: 'not-a-token' })).status, 400);

    // Kill switch: nothing changes
    process.env.PUSH_TOKEN_CLAIM = 'false';
    assert.deepEqual((await post({ token: phone })).body, { success: true, released: 0, skipped: true });
    assert.deepEqual(tokens(), { asha: phone, ravi: phone, meera: otherPhone, kabir: null });
    delete process.env.PUSH_TOKEN_CLAIM;

    // Kabir signs in on the phone Asha and Ravi used: only Kabir keeps its token, Meera's phone is untouched
    assert.equal((await post({ token: phone })).body.released, 2);
    assert.deepEqual(tokens(), { asha: null, ravi: null, meera: otherPhone, kabir: phone });

    // Signing in again on the same phone changes nothing
    assert.equal((await post({ token: phone })).body.released, 0);
    assert.deepEqual(tokens(), { asha: null, ravi: null, meera: otherPhone, kabir: phone });

    // Asha signs back in on that phone: it moves back to her
    caller = 'asha';
    assert.equal((await post({ token: ` ${phone} ` })).body.released, 1);
    assert.deepEqual(tokens(), { asha: phone, ravi: null, meera: otherPhone, kabir: null });
  } finally {
    delete process.env.PUSH_TOKEN_CLAIM;
    server.close();
  }
});
