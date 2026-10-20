import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFindYouAccess } from '../src/routes/findYou.js';

test('Find You is allowed only for galleries the user owns, manages or has joined', async () => {
  const accessByRef: Record<string, string | null> = {
    owned: 'manage',
    joined: 'member',
    privateGallery: 'none',
    waiting: 'pending',
    loggedOutOnly: 'public_view',
    signInFirst: 'login_required',
    missing: 'not_found',
    broken: null,
  };
  const asked: string[] = [];
  const openGallery = async (ref: string) => {
    asked.push(ref);
    return accessByRef[ref] ?? null;
  };

  assert.deepEqual(await checkFindYouAccess(['owned', 'joined'], openGallery), { ok: true });
  for (const denied of ['privateGallery', 'waiting', 'loggedOutOnly', 'signInFirst', 'missing', 'broken']) {
    assert.deepEqual(await checkFindYouAccess(['owned', denied], openGallery), { ok: false, eventId: denied });
  }

  asked.length = 0;
  await checkFindYouAccess([' owned ', 'owned', '', 'joined'], openGallery);
  assert.deepEqual(asked.sort(), ['joined', 'owned'], 'each gallery is checked once, blanks ignored');
});

test('a failing access lookup fails the search instead of allowing it', async () => {
  await assert.rejects(
    checkFindYouAccess(['owned'], async () => {
      throw new Error('database unavailable');
    }),
    /database unavailable/,
  );
});

test('Find You leaves out photos the host hid from guests; a failed lookup filters nothing', async () => {
  const { findHiddenMediaIds } = await import('../src/routes/findYou.js');
  const asked: string[][] = [];
  const admin = (rows: { id: string }[] | null, error: unknown = null) => () => ({
    from: () => ({ select: () => ({ in: (_c: string, ids: string[]) => { asked.push(ids); return { eq: async () => ({ data: rows, error }) }; } }) }),
  }) as never;

  assert.deepEqual([...await findHiddenMediaIds(['p1', 'p2', 'p1', ''], admin([{ id: 'p2' }]))], ['p2']);
  assert.deepEqual(asked[0], ['p1', 'p2']);
  assert.equal((await findHiddenMediaIds([], admin([{ id: 'x' }]))).size, 0);
  assert.equal((await findHiddenMediaIds(['p1'], admin(null, { code: '42703' }))).size, 0);
});
