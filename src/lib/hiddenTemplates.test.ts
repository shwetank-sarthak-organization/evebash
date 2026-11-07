import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HIDDEN_TEMPLATE_IDS,
  MOBILE_TEMPLATE_THEMES,
  getComingSoonTemplatesForEventCategory,
  getDefaultTemplateForEventCategory,
  getPickerTemplatesForEventCategory,
} from '../../apps/mobile/constants/templates';
import { ACTIVE_THEME_IDS, comingSoonThemes, pickableThemes } from '../../shared/themes/activeThemes';

// Hidden themes stay defined; they only leave the pickers.
assert.equal(MOBILE_TEMPLATE_THEMES.length, 33);
assert.equal(HIDDEN_TEMPLATE_IDS.length, 19);
for (const id of HIDDEN_TEMPLATE_IDS) assert.ok(MOBILE_TEMPLATE_THEMES.some(t => t.id === id), `${id} still defined`);

// Every event type picks from the active themes (shared/themes/activeThemes.ts, 2026-11-06); the app has no
// Confetti Circle yet, so it shows the other four. The event type's own other themes are "Coming soon".
const appActive = ['royal', 'classic', 'portrait', 'hero'];
const comingSoon: Record<string, string[]> = {
  Wedding: [],
  Anniversary: [],
  Birthday: ['scrapbook', 'neon', 'pop'],
  Corporate: ['museum', 'brutalist'],
  Sports: ['bohemian', 'cinematic', 'polaroid', 'editorial'],
  College: ['cyber_tech'],
  Other: ['bohemian', 'cinematic', 'polaroid', 'editorial'],
};
for (const [category, ids] of Object.entries(comingSoon)) {
  assert.deepEqual(getPickerTemplatesForEventCategory(category).map(t => t.id), appActive, category);
  assert.equal(getDefaultTemplateForEventCategory(category).id, 'royal', `${category} default`);
  assert.deepEqual(getComingSoonTemplatesForEventCategory(category).map(t => t.id), ids, `${category} coming soon`);
}
assert.equal(getDefaultTemplateForEventCategory(undefined).id, 'royal');
// Themes hidden for good never show, not even as Coming soon
for (const ids of Object.values(comingSoon)) for (const id of ids) assert.ok(!HIDDEN_TEMPLATE_IDS.includes(id), id);

// The shared rule with the website's theme list: Confetti Circle is pickable there, Periwinkle Script is a
// Wedding "Coming soon", and an event's current theme is never listed twice
const web = [
  { id: 'royal', category: 'Wedding' }, { id: 'confetti', category: 'Wedding' }, { id: 'periwinkle', category: 'Wedding' },
  { id: 'hero', category: 'Wedding' }, { id: 'classic', category: 'Wedding' }, { id: 'portrait', category: 'Wedding' },
  { id: 'pop', category: 'Birthday' }, { id: 'rose', category: 'Wedding' },
];
const webHiddenForGood = (id: string) => id === 'rose';
assert.deepEqual(pickableThemes(web).map(t => t.id), [...ACTIVE_THEME_IDS]);
assert.deepEqual(comingSoonThemes(web, 'Wedding', webHiddenForGood).map(t => t.id), ['periwinkle']);
assert.deepEqual(pickableThemes(web, 'pop').map(t => t.id), ['pop', ...ACTIVE_THEME_IDS]);
assert.deepEqual(comingSoonThemes(web, 'Birthday', webHiddenForGood, 'pop').map(t => t.id), []);

// An event already on a hidden theme still sees it, first, as the current choice.
assert.deepEqual(getPickerTemplatesForEventCategory('Anniversary', 'golden_years').map(t => t.id), ['golden_years', ...appActive]);
assert.deepEqual(getPickerTemplatesForEventCategory('Wedding', 'classic').map(t => t.id), appActive);
// An event on a theme that is now "Coming soon" keeps it as its current choice, and it isn't listed twice
assert.deepEqual(getPickerTemplatesForEventCategory('Birthday', 'neon').map(t => t.id), ['neon', ...appActive]);
assert.deepEqual(getComingSoonTemplatesForEventCategory('Birthday', 'neon').map(t => t.id), ['scrapbook', 'pop']);

// The website host page hides the same ids.
const hostPage = readFileSync(join(__dirname, '../app/(main)/host/page.tsx'), 'utf8');
const webHidden = [...hostPage.match(/const HIDDEN_TEMPLATE_IDS = \[([\s\S]*?)\];/)![1].matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
assert.deepEqual(webHidden, HIDDEN_TEMPLATE_IDS);

console.log('hidden template tests passed');
