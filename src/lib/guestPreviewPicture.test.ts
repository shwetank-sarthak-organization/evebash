import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ACTIVE_THEME_IDS } from '../../shared/themes/activeThemes';
import { guestPreviewSamplePath, isGuestPreviewPictureOutOfDate, readGuestPreviewPicture } from '../../shared/themes/guestPreviewPicture';

// The app's guest home picture on the Design tab's Guest Home Preview (todo #31), as the backend saves it
const saved = {
  url: 'https://media.example/events/wedding-fdd8/guest-preview/app-1.jpg',
  templateId: 'confetti',
  takenAt: '2026-11-12T08:00:00.000Z',
  width: 585,
  height: 1266,
};

assert.deepEqual(readGuestPreviewPicture(saved), saved);
assert.deepEqual(readGuestPreviewPicture({ ...saved, templateId: undefined }), { ...saved, templateId: null });

// Nothing saved yet, or anything not shaped like a picture, is "no picture"
for (const value of [null, undefined, {}, 'text', { ...saved, url: 'http://media.example/a.jpg' }, { ...saved, url: 'javascript:alert(1)' },
  { ...saved, takenAt: 'yesterday' }, { ...saved, width: 0 }, { ...saved, height: '1266' }]) {
  assert.equal(readGuestPreviewPicture(value), null);
}

// Out of date once the event has another template (no template on either side counts as the same)
assert.equal(isGuestPreviewPictureOutOfDate(saved, 'confetti'), false);
assert.equal(isGuestPreviewPictureOutOfDate(saved, 'hero'), true);
assert.equal(isGuestPreviewPictureOutOfDate({ templateId: null }, undefined), false);
assert.equal(isGuestPreviewPictureOutOfDate({ templateId: null }, 'hero'), true);

// A sample of the app for every theme hosts can pick, and the file is on the website (no template: Midnight Hero)
for (const themeId of ACTIVE_THEME_IDS) {
  const path = guestPreviewSamplePath(themeId);
  assert.ok(path, `no sample for ${themeId}`);
  assert.ok(existsSync(new URL(`../../public${path.split('?')[0]}`, import.meta.url)), `missing file for ${path}`);
}
assert.equal(guestPreviewSamplePath(null), guestPreviewSamplePath('hero'));
assert.equal(guestPreviewSamplePath('vintage'), null);

console.log('guest preview picture tests passed');
