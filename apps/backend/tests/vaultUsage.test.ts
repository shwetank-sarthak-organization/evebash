import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listVaultUsage } from '../src/routes/admin.js';

type Row = Record<string, unknown>;

function fakeAdmin(rows: Row[], pageSizeSeen: number[] = []) {
  return {
    from(table: string) {
      assert.equal(table, 'vault_accounts');
      const builder: any = {
        select: () => builder,
        order: () => builder,
        range: async (from: number, to: number) => {
          pageSizeSeen.push(to - from + 1);
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return builder;
    },
  } as any;
}

test('adds used and reserved bytes per owner and skips empty accounts', async () => {
  const { vaultBytes } = await listVaultUsage(fakeAdmin([
    { owner_id: 'a', used_bytes: 100, reserved_bytes: 20 },
    { owner_id: 'b', used_bytes: 0, reserved_bytes: 0 },
    { owner_id: 'c', used_bytes: '50', reserved_bytes: null },
  ]));
  assert.deepEqual(vaultBytes, { a: 120, c: 50 });
});

test('reads every page when there are more than 1000 accounts', async () => {
  const rows = Array.from({ length: 1500 }, (_, i) => ({ owner_id: `u${i}`, used_bytes: 1, reserved_bytes: 0 }));
  const pages: number[] = [];
  const { vaultBytes } = await listVaultUsage(fakeAdmin(rows, pages));
  assert.equal(Object.keys(vaultBytes).length, 1500);
  assert.equal(pages.length, 2);
});

test('passes a database error on', async () => {
  const failing = { from: () => { const b: any = { select: () => b, order: () => b, range: async () => ({ data: null, error: new Error('boom') }) }; return b; } } as any;
  await assert.rejects(listVaultUsage(failing), /boom/);
});
