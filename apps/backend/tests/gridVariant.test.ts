import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID_SUFFIX, gridKey, isGridVariantEnabled } from '../src/services/gridVariant.js';

test('switch is off unless GRID_VARIANT is true', () => {
  for (const value of [undefined, '', 'false', '1']) assert.equal(isGridVariantEnabled({ GRID_VARIANT: value }), false);
  for (const value of ['true', ' TRUE ']) assert.equal(isGridVariantEnabled({ GRID_VARIANT: value }), true);
});

test('grid file sits next to the preview and thumbnail', () => {
  assert.equal(gridKey('events/e-1/photos/a.JPG'), 'events/e-1/photos/a.JPG-grid.webp');
  // The orphan cleanup strips this ending to find the photo a file belongs to
  assert.equal(gridKey('events/e-1/photos/a.JPG').replace(GRID_SUFFIX, ''), 'events/e-1/photos/a.JPG');
});
