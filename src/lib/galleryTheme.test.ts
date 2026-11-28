import assert from 'node:assert/strict';
import { WEB_LIGHTBOX_THEMES, getReadableTextColor } from './webTemplateTheme';
import { TEMPLATE_ID_TO_PAGE_FLIP_THEME } from '../components/page-flip/pageFlipThemes';
import { MOBILE_TEMPLATE_THEMES } from '../../apps/mobile/constants/templates';
import { galleryActionText } from '../../apps/mobile/constants/galleryContrast';
import { VIEWER_TEMPLATE_PALETTES, SPORTS_VIEWER_PALETTES } from '../../apps/mobile/constants/viewerPalettes';

function rgb(value: string): number[] {
  if (/^#[\da-f]{6}$/i.test(value)) return [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
  assert.match(value, /^rgba?\(/);
  return value.match(/[\d.]+/g)!.map(Number);
}
function surface(value: string, background: string) {
  const color = rgb(value), base = rgb(background), alpha = color[3] ?? 1;
  return color.slice(0, 3).map((channel, i) => channel * alpha + base[i] * (1 - alpha));
}
function luminance(color: number[]) {
  return color.map(channel => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
// Every problem is collected and printed at the end, so one bad colour doesn't hide the checks after it (#65)
const problems: string[] = [];
function readable(label: string, foreground: string, background: number[]) {
  const a = luminance(rgb(foreground)), b = luminance(background);
  const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  if (contrast < 4.5) problems.push(`${label}: ${contrast.toFixed(2)}:1, expected at least 4.5:1`);
}

// The website photo viewer has every theme. The other lists may leave some out and fall back safely: the album
// (page flip) uses Midnight Hero, the app photo viewer uses the theme's own app colours, and Periwinkle has no app
// version. Each list may only name themes the website knows.
const webIds = Object.keys(WEB_LIGHTBOX_THEMES).sort();
for (const [name, ids] of Object.entries({
  'album (page flip)': Object.keys(TEMPLATE_ID_TO_PAGE_FLIP_THEME),
  'app themes': MOBILE_TEMPLATE_THEMES.map(t => t.id),
  'app photo viewer': Object.keys(VIEWER_TEMPLATE_PALETTES),
})) {
  const unknown = ids.filter(id => !webIds.includes(id));
  if (unknown.length) problems.push(`${name} names themes the website doesn't have: ${unknown.join(', ')}`);
}

for (const [id, theme] of Object.entries(WEB_LIGHTBOX_THEMES)) {
  for (const role of ['text', 'muted'] as const) for (const area of ['background', 'panel'] as const) {
    readable(`web ${id} ${role}/${area}`, theme[role]!, surface(theme[area]!, theme.background!));
  }
  readable(`web ${id} selected action`, getReadableTextColor(theme.accent!), rgb(theme.accent!));
}
for (const theme of MOBILE_TEMPLATE_THEMES) {
  for (const mode of ['light', 'dark'] as const) for (const role of ['text', 'muted'] as const) for (const area of ['background', 'panel'] as const) {
    readable(`native ${theme.id} ${mode} ${role}/${area}`, theme[role][mode], surface(theme[area][mode], theme.background[mode]));
  }
  readable(`native ${theme.id} selected action`, galleryActionText(theme.accent), rgb(theme.accent));
}
for (const [kind, palettes] of Object.entries({ viewer: VIEWER_TEMPLATE_PALETTES, sports: SPORTS_VIEWER_PALETTES })) {
  for (const [id, theme] of Object.entries(palettes)) for (const role of ['text', 'muted'] as const) for (const area of ['background', 'panel'] as const) {
    readable(`${kind} ${id} ${role}/${area}`, theme[role], surface(theme[area], theme.background));
  }
}

if (problems.length) {
  console.error(`${problems.length} contrast / theme list problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`${webIds.length} web, ${MOBILE_TEMPLATE_THEMES.length} app, ${Object.keys(VIEWER_TEMPLATE_PALETTES).length} app viewer and ${Object.keys(SPORTS_VIEWER_PALETTES).length} Sports viewer palettes: text, panel and selected-action contrast passed.`);
