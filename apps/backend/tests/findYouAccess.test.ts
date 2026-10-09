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
