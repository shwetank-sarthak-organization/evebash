import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrubSentryEvent, scrubText } from './sentryScrub';

test('scrubText removes emails, tokens and signed-link parameters', () => {
  assert.equal(scrubText('Upload failed for guest@example.com'), 'Upload failed for [email]');
  assert.equal(scrubText('Authorization: Bearer abc.def-123'), 'Authorization: Bearer [token]');
  assert.equal(scrubText('jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig_part-1 end'), 'jwt [token] end');
  assert.equal(
    scrubText('https://media.evebash.com/a.jpg?X-Amz-Signature=deadbeef&w=400'),
    'https://media.evebash.com/a.jpg?X-Amz-Signature=[removed]&w=400',
  );
  assert.equal(scrubText('evebash://login#access_token=abc&refresh_token=def'), 'evebash://login#access_token=[removed]&refresh_token=[removed]');
  assert.equal(scrubText('Cannot read property "id" of undefined'), 'Cannot read property "id" of undefined');
});

test('scrubSentryEvent keeps only the user id and drops cookies, bodies and auth headers', () => {
  const event = scrubSentryEvent({
    message: 'Failed for host@example.com',
    user: { id: 'u1', email: 'host@example.com', ip_address: '1.2.3.4' },
    request: {
      url: 'https://evebash.com/gallery/x?token=secret',
      headers: { Authorization: 'Bearer abc', Cookie: 'sb=1', 'User-Agent': 'Safari' },
      cookies: { sb: '1' },
      data: { email: 'host@example.com' },
    },
    breadcrumbs: [{ message: 'signed in as host@example.com' }],
    exception: { values: [{ type: 'Error', value: 'no row for guest@example.com' }] },
  });

  assert.equal(event.message, 'Failed for [email]');
  assert.deepEqual(event.user, { id: 'u1' });
  assert.equal(event.request.url, 'https://evebash.com/gallery/x?token=[removed]');
  assert.deepEqual(event.request.headers, { Authorization: '[removed]', Cookie: '[removed]', 'User-Agent': 'Safari' });
  assert.equal('cookies' in event.request, false);
  assert.equal('data' in event.request, false);
  assert.equal(event.breadcrumbs[0].message, 'signed in as [email]');
  assert.equal(event.exception.values[0].value, 'no row for [email]');
});
