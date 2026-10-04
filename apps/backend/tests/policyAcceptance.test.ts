import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptanceIntent, matchesAcceptanceIntent, POLICY_VERSION } from '../../../shared/legal/acceptance.js';

test('signup intent is scoped to the signed-in email and current policy version', () => {
  const intent = acceptanceIntent(' Person@Example.com ');
  assert.equal(matchesAcceptanceIntent(intent, 'person@example.com'), true);
  assert.equal(matchesAcceptanceIntent(intent, 'other@example.com'), false);
  assert.equal(matchesAcceptanceIntent(JSON.stringify({ email: 'person@example.com', version: 'old' }), 'person@example.com'), false);
  for (const invalid of [null, '', 'broken', '{}', 'true']) assert.equal(matchesAcceptanceIntent(invalid, 'person@example.com'), false);
  assert.equal(matchesAcceptanceIntent(JSON.stringify({ email: 'person@example.com', version: POLICY_VERSION }), 'person@example.com'), true);
});
