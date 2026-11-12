import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRotatedLinks, isRotateVersionedLinksEnabled, previousOriginalLinks } from '../src/services/rotateLinks.js';

const key = 'events/rec-1/photos/a b-IMG_1.JPG';

test('switch is off unless ROTATE_VERSIONED_LINKS is true', () => {
  for (const value of [undefined, '', 'false', '1', 'on']) assert.equal(isRotateVersionedLinksEnabled({ ROTATE_VERSIONED_LINKS: value }), false);
  for (const value of ['true', ' TRUE ', 'True']) assert.equal(isRotateVersionedLinksEnabled({ ROTATE_VERSIONED_LINKS: value }), true);
});

test('switch off: the same plain links as before', () => {
  assert.deepEqual(buildRotatedLinks('media.evebash.com', key, null), {
    url: `https://media.evebash.com/${key}`,
    thumbnailUrl: `https://media.evebash.com/${key}-thumbnail.webp`,
    previewUrl: `https://media.evebash.com/${key}-preview.webp`,
  });
});

test('switch on: every link gets the same ?v= and still ends in its file name before it', () => {
  const links = buildRotatedLinks('media.evebash.com', key, 1793000000000);
  for (const link of Object.values(links)) assert.ok(link.endsWith('?v=1793000000000'));
  assert.equal(links.thumbnailUrl.split('?')[0], `https://media.evebash.com/${key}-thumbnail.webp`);
  assert.equal(links.previewUrl.split('?')[0], `https://media.evebash.com/${key}-preview.webp`);
  // What the website/app image helpers do with it: strip the query, add the suffix, keep the query
  const [base, query] = links.url.split('?');
  assert.equal(`${base}-preview.webp?${query}`, links.previewUrl);
  // What download and delete code does with it: the path is still the B2 key
  assert.equal(decodeURIComponent(new URL(links.url).pathname.slice(1)), key);
});

test('previous links: plain link plus the earlier versioned one, no duplicates or empties', () => {
  const plain = `https://media.evebash.com/${key}`;
  assert.deepEqual(previousOriginalLinks(plain, plain), [plain]);
  assert.deepEqual(previousOriginalLinks(`${plain}?v=1`, plain), [plain, `${plain}?v=1`]);
  assert.deepEqual(previousOriginalLinks(null, plain), [plain]);
});
