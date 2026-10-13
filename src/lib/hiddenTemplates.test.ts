import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HIDDEN_TEMPLATE_IDS,
  MOBILE_TEMPLATE_THEMES,
  getDefaultTemplateForEventCategory,
  getPickerTemplatesForEventCategory,
} from '../../apps/mobile/constants/templates';

// Hidden themes stay defined; they only leave the pickers.
assert.equal(MOBILE_TEMPLATE_THEMES.length, 32);
assert.equal(HIDDEN_TEMPLATE_IDS.length, 19);
for (const id of HIDDEN_TEMPLATE_IDS) assert.ok(MOBILE_TEMPLATE_THEMES.some(t => t.id === id), `${id} still defined`);

const expected: Record<string, string[]> = {
  Wedding: ['royal', 'classic', 'hero'],
  Birthday: ['scrapbook', 'neon', 'pop'],
  Anniversary: ['royal', 'classic', 'hero'],
  Corporate: ['museum', 'brutalist'],
  Sports: ['bohemian', 'cinematic', 'polaroid', 'editorial'],
  College: ['cyber_tech'],
  Other: ['bohemian', 'cinematic', 'polaroid', 'editorial'],
};
for (const [category, ids] of Object.entries(expected)) {
  assert.deepEqual(getPickerTemplatesForEventCategory(category).map(t => t.id), ids, category);
  assert.equal(getDefaultTemplateForEventCategory(category).id, ids[0], `${category} default`);
}
assert.equal(getDefaultTemplateForEventCategory(undefined).id, 'royal');

// An event already on a hidden theme still sees it, first, as the current choice.
assert.deepEqual(getPickerTemplatesForEventCategory('Anniversary', 'golden_years').map(t => t.id), ['golden_years', 'royal', 'classic', 'hero']);
assert.deepEqual(getPickerTemplatesForEventCategory('Wedding', 'classic').map(t => t.id), ['royal', 'classic', 'hero']);

// The website host page hides the same ids.
const hostPage = readFileSync(join(__dirname, '../app/(main)/host/page.tsx'), 'utf8');
const webHidden = [...hostPage.match(/const HIDDEN_TEMPLATE_IDS = \[([\s\S]*?)\];/)![1].matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
assert.deepEqual(webHidden, HIDDEN_TEMPLATE_IDS);

console.log('hidden template tests passed');
