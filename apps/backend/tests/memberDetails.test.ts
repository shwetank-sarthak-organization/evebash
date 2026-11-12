import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createPermissionsRouter } from '../src/routes/permissions.js';

type Row = Record<string, unknown>;

function fakeAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder; },
        maybeSingle: async () => ({ data: (tables[table] || []).find((row) => filters.every((keep) => keep(row))) ?? null, error: null }),
      };
      return builder;
    },
  };
}

const tables = {
  guests: [
    { id: 'approved', user_id: 'u1', status: 'approved' },
    { id: 'pending', user_id: 'u1', status: 'pending' },
    { id: 'rejected', user_id: 'u1', status: 'rejected' },
    { id: 'no-account', user_id: null, status: 'approved' },
    { id: 'gone', user_id: 'deleted', status: 'approved' },
  ],
  profiles: [{ id: 'u1', username: 'shwetank.cha', email: 'guest@example.com', phone: '+919999999999', name: 'Guest' }],
};

test('member details: event managers get the username and email of people on the guest list, never the phone', async () => {
  let access: 'allowed' | 'login' | 'forbidden' = 'login';
  const asked: string[] = [];
  const app = express();
  app.use(express.json());
  app.use('/permissions', createPermissionsRouter(
    async (_request, logId) => { asked.push(logId); return access; },
    () => fakeAdmin(tables) as never,
  ));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/permissions/member-details`;
  const post = async (body: object) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };

  try {
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ logId: ['approved'] })).status, 400);

    assert.equal((await post({ logId: 'approved' })).status, 401);
    access = 'forbidden';
    const refused = await post({ logId: 'approved' });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.email, undefined);
    assert.equal(asked.at(-1), 'approved');

    access = 'allowed';
    assert.deepEqual((await post({ logId: 'approved' })).body, { success: true, username: 'shwetank.cha', email: 'guest@example.com' });
    assert.equal((await post({ logId: 'pending' })).body.email, 'guest@example.com');

    // Someone who was turned down isn't on the list any more
    assert.deepEqual((await post({ logId: 'rejected' })).body, { success: true, username: null, email: null });
    assert.deepEqual((await post({ logId: 'no-account' })).body, { success: true, username: null, email: null });
    assert.deepEqual((await post({ logId: 'gone' })).body, { success: true, username: null, email: null });
    assert.deepEqual((await post({ logId: 'missing' })).body, { success: true, username: null, email: null });
  } finally {
    server.close();
  }
});

test('member details stay behind a real login when the old body-based check is switched on', async () => {
  process.env.GUEST_ROUTES_REQUIRE_LOGIN = 'false';
  const app = express();
  app.use(express.json());
  app.use('/permissions', createPermissionsRouter(async () => 'login', () => fakeAdmin(tables) as never));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/permissions/member-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId: 'approved', requester: { uid: 'anyone', email: 'code4sarthak@gmail.com' } }),
    });
    assert.equal(response.status, 401);
  } finally {
    delete process.env.GUEST_ROUTES_REQUIRE_LOGIN;
    server.close();
  }
});

test('member directory: managers get usernames for the event and its sub-galleries, never phones', async () => {
  const directoryTables: Record<string, Row[]> = {
    guests: [
      { id: 'main', event_id: 'wedding', parent_event_id: null, user_id: 'u1', status: 'approved' },
      { id: 'sub', event_id: 'haldi', parent_event_id: 'wedding', user_id: 'u2', status: 'pending' },
      { id: 'turned-down', event_id: 'wedding', parent_event_id: null, user_id: 'u1', status: 'rejected' },
      { id: 'no-account', event_id: 'wedding', parent_event_id: null, user_id: null, status: 'approved' },
      { id: 'other', event_id: 'other-event', parent_event_id: null, user_id: 'u1', status: 'approved' },
    ],
    profiles: [
      { id: 'u1', username: 'asha', email: 'asha@example.com', phone: '+911' },
      { id: 'u2', username: null, email: 'rahul@example.com', phone: '+912' },
    ],
  };
  const admin = {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder; },
        in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return builder; },
        then: (resolve: (value: unknown) => unknown) => resolve({ data: (directoryTables[table] || []).filter((row) => filters.every((keep) => keep(row))), error: null }),
      };
      return builder;
    },
  };
  let access: 'allowed' | 'login' | 'forbidden' = 'login';
  const app = express();
  app.use(express.json());
  app.use('/permissions', createPermissionsRouter(
    async () => 'forbidden',
    () => admin as never,
    async () => false,
    async () => access,
  ));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const post = async (body: object) => {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/permissions/member-directory`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  try {
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ eventId: 'wedding' })).status, 401);
    access = 'forbidden';
    const refused = await post({ eventId: 'wedding' });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.members, undefined);

    access = 'allowed';
    assert.deepEqual((await post({ eventId: 'wedding' })).body, {
      success: true,
      members: {
        main: { username: 'asha', email: 'asha@example.com' },
        sub: { username: null, email: 'rahul@example.com' },
      },
    });
  } finally {
    server.close();
  }
});
