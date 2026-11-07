import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOBILE_TEMPLATE_THEMES } from '../../apps/mobile/constants/templates';
import {
  EDITABLE_COLUMNS,
  STANDARD_EDITABLE_FIELDS,
  THEME_EDITABLE_FIELDS,
  editableFieldsFor,
} from '../../shared/themes/editableFields';
import {
  EMPTY_DRAFT,
  applyGalleryDraft,
  draftSummary,
  draftSummaryText,
  editableMessage,
  setDraftBlock,
  setDraftField,
  withoutGallery,
} from '../../shared/guestEdit/draft';
import {
  cleanCouple,
  cleanThemeContentBlock,
  editableCouple,
  readThemeContent,
  sameCouple,
  shownCouple,
  socialLinkUrl,
} from '../../shared/themes/themeContent';
import { clampCoverZoom, coverFocus, dragCoverFocus, focusToOffsets } from '../../shared/themes/coverFocus';
import { shownCover, withShownCover } from '../../shared/themes/phoneCover';

// --- Theme edit lists (shared/themes/editableFields.ts) ---

const registry = readFileSync(join(__dirname, '../components/templateRegistry.tsx'), 'utf8');
const webIds = [...registry.match(/WEB_TEMPLATE_COMPONENTS[^{]*\{([\s\S]*?)\n\};/)![1].matchAll(/^\s*([a-z_]+):/gm)].map(m => m[1]);
assert.ok(webIds.length >= 30, 'read the website theme ids');
const appIds = MOBILE_TEMPLATE_THEMES.map(theme => theme.id);
const knownIds = new Set([...webIds, ...appIds]);

for (const [themeId, fields] of Object.entries(THEME_EDITABLE_FIELDS)) {
  assert.ok(knownIds.has(themeId), `${themeId} is a website or app theme`);
  const keys = fields.map(field => field.key);
  assert.equal(new Set(keys).size, keys.length, `${themeId}: no field listed twice`);
  for (const field of fields) {
    assert.ok(EDITABLE_COLUMNS.includes(field.column), `${themeId}.${field.key}: saved to an existing column`);
    assert.ok(field.label.trim(), `${themeId}.${field.key}: has a label`);
  }
}

// Every theme gets an edit list: its own, or the standard five
for (const id of knownIds) assert.ok(editableFieldsFor(id, 'web', true).length > 0 || editableFieldsFor(id, 'app', true).length > 0, id);
assert.deepEqual(editableFieldsFor(undefined, 'web', true).map(f => f.key), ['cover', 'title', 'date', 'message', 'video']);
assert.deepEqual(editableFieldsFor('unknown_theme', 'app', false), [...STANDARD_EDITABLE_FIELDS]);
assert.equal(editableFieldsFor('periwinkle', 'web', true).find(f => f.key === 'message')?.label, 'Cover message');

// --- Draft (shared/guestEdit/draft.ts) ---

let draft = setDraftField(EMPTY_DRAFT, 'home', 'title', 'Asha & Raj', 'Asha and Raj');
draft = setDraftField(draft, 'home', 'description', 'Welcome!', '');
draft = setDraftField(draft, 'sangeet', 'galleryVideoId', null, 'video-1');
assert.deepEqual(draftSummary(draft), { changes: 3, galleries: 2 });
assert.equal(draftSummaryText(draft), '3 changes in 2 galleries');

// Back to the saved value: no longer a change, and an emptied gallery leaves the draft
draft = setDraftField(draft, 'sangeet', 'galleryVideoId', 'video-1', 'video-1');
assert.equal('sangeet' in draft, false);
assert.equal(draftSummaryText(draft), '2 changes');
assert.equal(draftSummaryText(withoutGallery(draft, 'home')), 'No changes');
// Undefined and null count as the same saved value (no message yet)
assert.equal('home' in setDraftField(EMPTY_DRAFT, 'home', 'galleryVideoId', null, undefined), false);

// Applying a draft
const gallery = { id: 'home', title: 'Old', date: '1 Jan 2026', coverImage: 'a.jpg', coverMode: 'fill' as const, coverOffset: 30, coverOffsetX: -10, coverScale: 1.4 };
assert.equal(applyGalleryDraft(gallery, undefined), gallery, 'nothing to apply: same object');
const shown = applyGalleryDraft(gallery, { title: 'New', date: '2026-11-06', coverImage: '' }, { date: d => `shown ${d}`, coverImage: c => c || 'default.jpg' });
assert.deepEqual(
  { title: shown.title, date: shown.date, coverImage: shown.coverImage, coverOffset: shown.coverOffset },
  { title: 'New', date: 'shown 2026-11-06', coverImage: 'default.jpg', coverOffset: 30 },
);
// Fit / Fill resets the position, like the host page
const fitted = applyGalleryDraft(gallery, { coverMode: 'fit' });
assert.deepEqual([fitted.coverMode, fitted.coverOffset, fitted.coverOffsetX, fitted.coverScale], ['fit', 0, 0, 1]);
assert.equal(gallery.coverOffset, 30, 'the loaded gallery is not changed');
// Moving and zooming apply on top; with Fit / Fill in the same draft, the move wins over the reset
const moved = applyGalleryDraft(gallery, { coverMode: 'fit', coverOffsetX: 12, coverScale: 1.8 });
assert.deepEqual([moved.coverMode, moved.coverOffset, moved.coverOffsetX, moved.coverScale], ['fit', 0, 12, 1.8]);

assert.equal(editableMessage('Main Event: Asha & Raj', 'Asha & Raj'), '');
assert.equal(editableMessage('Welcome all', 'Asha & Raj'), 'Welcome all');
assert.equal(editableMessage(undefined, 'Asha & Raj'), '');

// --- Cover focus point and zoom (shared/themes/coverFocus.ts) ---

assert.deepEqual(coverFocus({}), { x: 50, y: 50, zoom: 1 }, 'nothing saved: middle, no zoom');
assert.deepEqual(coverFocus({ coverOffsetX: -20, coverOffset: 30, coverScale: 1.5 }), { x: 30, y: 80, zoom: 1.5 });
assert.deepEqual(coverFocus({ coverOffsetX: 90, coverOffset: -80, coverScale: 9 }), { x: 100, y: 0, zoom: 2.5 }, 'kept inside the photo');
assert.deepEqual(focusToOffsets(30, 80), { coverOffsetX: -20, coverOffset: 30 });
assert.deepEqual(focusToOffsets(-10, 133.33), { coverOffsetX: -50, coverOffset: 50 });
assert.equal(clampCoverZoom(0.4), 1);
assert.equal(clampCoverZoom(1.234), 1.2);
// The photo follows the finger: dragging it right shows more of its left side
const dragged = dragCoverFocus({ x: 50, y: 50 }, 100, -50, { width: 400, height: 200 }, 1);
assert.deepEqual(dragged, { x: 25, y: 75 });
// Zoomed in, the same drag moves the focus less
assert.deepEqual(dragCoverFocus({ x: 50, y: 50 }, 100, 0, { width: 400, height: 200 }, 2), { x: 37.5, y: 50 });
assert.deepEqual(dragCoverFocus({ x: 5, y: 95 }, 400, -400, { width: 400, height: 200 }, 1), { x: 0, y: 100 }, 'stops at the edges');

// --- Phone cover and computer cover (shared/themes/phoneCover.ts) ---

const isDefault = (image?: string | null) => !image || image === 'default.jpg';
const computerOnly = { coverImage: 'c.jpg', coverMode: 'fill' as const, coverOffset: 10, coverOffsetX: -5, coverScale: 1.2 };
// Nothing set for phones: phones show the computer cover, and it's the same object
assert.equal(withShownCover(computerOnly, 'phone', isDefault), computerOnly);
assert.equal(withShownCover(computerOnly, 'computer', isDefault), computerOnly);
// Its own photo and framing on phones; computers keep theirs
const both = { ...computerOnly, phoneCoverImage: 'p.jpg', phoneCoverMode: 'fill' as const, phoneCoverOffset: -20, phoneCoverOffsetX: 0, phoneCoverScale: 1 };
assert.deepEqual(shownCover(both, 'phone', isDefault), { coverImage: 'p.jpg', coverMode: 'fill', coverOffset: -20, coverOffsetX: 0, coverScale: 1 });
assert.deepEqual(shownCover(both, 'computer', isDefault), { coverImage: 'c.jpg', coverMode: 'fill', coverOffset: 10, coverOffsetX: -5, coverScale: 1.2 });
// Only the framing set for phones: same photo, phone framing
assert.deepEqual(shownCover({ ...computerOnly, phoneCoverMode: 'fit' }, 'phone', isDefault), { coverImage: 'c.jpg', coverMode: 'fit', coverOffset: 0, coverOffsetX: 0, coverScale: 1 });
// Only a phone cover set (app-only host): computers show it instead of the default photo
const phoneOnly = { coverImage: 'default.jpg', phoneCoverImage: 'p.jpg', phoneCoverMode: 'fill' as const, phoneCoverOffset: 5 };
assert.equal(shownCover(phoneOnly, 'computer', isDefault).coverImage, 'p.jpg');
assert.equal(shownCover(phoneOnly, 'computer', isDefault).coverOffset, 5);

// --- Theme content: Confetti Circle's couple (shared/themes/themeContent.ts, todo #10) ---

// Links: a profile link or @username becomes a full https link to that network; anything else is refused
assert.equal(socialLinkUrl('instagram', ' @asha.k '), 'https://www.instagram.com/asha.k');
assert.equal(socialLinkUrl('instagram', 'instagram.com/asha.k'), 'https://instagram.com/asha.k');
assert.equal(socialLinkUrl('instagram', 'http://www.instagram.com/asha/'), 'https://www.instagram.com/asha/');
assert.equal(socialLinkUrl('facebook', 'https://m.facebook.com/profile.php?id=123#top'), 'https://m.facebook.com/profile.php?id=123');
assert.equal(socialLinkUrl('x', 'twitter.com/asha_k'), 'https://twitter.com/asha_k');
assert.equal(socialLinkUrl('x', '@asha_k'), 'https://x.com/asha_k');
assert.equal(socialLinkUrl('x', 'instagram.com/asha'), null, 'another network');
assert.equal(socialLinkUrl('instagram', 'https://instagram.com'), null, 'the site, not a profile');
assert.equal(socialLinkUrl('instagram', 'https://evil.com/instagram.com/asha'), null);
assert.equal(socialLinkUrl('instagram', 'https://instagram.com@evil.com/asha'), null);
assert.equal(socialLinkUrl('instagram', 'https://instagram.com.evil.com/asha'), null);
assert.equal(socialLinkUrl('instagram', 'javascript:alert(1)'), null);
assert.equal(socialLinkUrl('instagram', 'instagram.com/a"><script>'), null);
assert.equal(socialLinkUrl('x', '@this_is_far_too_long'), null, 'X usernames are at most 15 letters');
assert.equal(socialLinkUrl('instagram', ''), null);

// Saved form: trimmed, cut to the limits, only working links; a label alone isn't content
const typed = {
  left: { label: ' The Bride ', name: ' Asha ', about: 'x'.repeat(200), links: { instagram: '@asha', facebook: 'not a link', x: '' } },
  right: { label: 'The Groom', name: '', about: '', links: {} },
};
assert.deepEqual(cleanCouple(typed), {
  left: { label: 'The Bride', name: 'Asha', about: 'x'.repeat(160), links: { instagram: 'https://www.instagram.com/asha' } },
});
assert.equal(cleanCouple({ left: { label: 'The Bride', name: ' ', about: '', links: {} } }), null);
assert.equal(cleanThemeContentBlock('couple', undefined), null);

// Read from the database: only known blocks, cleaned; anything odd is empty
assert.deepEqual(readThemeContent({ couple: typed, milestones: [1, 2] }), { couple: cleanCouple(typed) });
assert.deepEqual(readThemeContent('{"couple":{}}'), {});
assert.deepEqual(readThemeContent([typed]), {});
assert.deepEqual(readThemeContent(null), {});
assert.deepEqual(readThemeContent({ couple: { left: { name: 42, links: 'x' } } }), {});

// Guests see a side only with a name
assert.deepEqual(Object.keys(shownCouple({ left: { label: '', name: '', about: 'Hi', links: { instagram: '@a' } }, right: { label: '', name: 'Raj', about: '', links: {} } })), ['right']);
assert.deepEqual(shownCouple(undefined), {});

// The panel: empty sides with the default labels (weddings only); nothing comes from the title
assert.deepEqual(editableCouple(undefined, 'Wedding'), {
  left: { label: 'The Bride', name: '', about: '', links: {} },
  right: { label: 'The Groom', name: '', about: '', links: {} },
});
assert.equal(editableCouple(undefined, 'Birthday').left.label, '');
const panel = editableCouple(undefined, 'Wedding');
assert.ok(sameCouple(panel, editableCouple(undefined, 'Wedding')));
assert.ok(sameCouple({ ...panel, left: { ...panel.left, links: { x: '' } } }, panel), 'an emptied link is no change');
assert.ok(!sameCouple({ ...panel, left: { ...panel.left, name: 'Asha ' } }, { ...panel, left: { ...panel.left, name: 'Asha' } }), 'typed as is');

// Draft: a changed block is one change; setting it back takes it out; the page shows it merged with the saved blocks
const withCouple = setDraftBlock(EMPTY_DRAFT, 'root', 'couple', typed, false);
assert.deepEqual(draftSummary(withCouple), { changes: 1, galleries: 1 });
assert.deepEqual(draftSummary(setDraftField(withCouple, 'root', 'title', 'New', 'Old')), { changes: 2, galleries: 1 });
assert.deepEqual(setDraftBlock(withCouple, 'root', 'couple', undefined, true), EMPTY_DRAFT);
const shownRoot = applyGalleryDraft({ title: 'Asha and Raj', themeContent: { couple: { right: { label: '', name: 'Raj', about: '', links: {} } } } }, withCouple.root);
assert.equal(shownRoot.themeContent?.couple, typed);
// After a save that removed the block, the saved layer says so and the page stops showing the old couple
const afterRemoval = applyGalleryDraft({ title: 'x', themeContent: { couple: cleanCouple(typed)! } }, { themeContent: { couple: undefined } });
assert.equal(afterRemoval.themeContent?.couple, undefined);
assert.deepEqual(shownCouple(afterRemoval.themeContent?.couple), {});

// Confetti Circle lists the couple on the website only (the app shows the section from todo #12), on every gallery
assert.ok(editableFieldsFor('confetti', 'web', false).some(field => field.key === 'couple' && field.block === 'couple'));
assert.ok(!editableFieldsFor('confetti', 'app', true).some(field => field.key === 'couple'));
assert.ok(!editableFieldsFor('classic', 'web', true).some(field => field.key === 'couple'));

console.log('guest edit tests passed');
