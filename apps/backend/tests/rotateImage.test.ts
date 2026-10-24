import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { isRotateUprightFirstEnabled, rotateImage } from '../src/services/rotateImage.js';

// A 60x40 stored image with a red block in its stored top-left corner, marked with the given EXIF orientation
async function photo(orientation: number) {
  const block = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ff0000' } }).png().toBuffer();
  return sharp({ create: { width: 60, height: 40, channels: 3, background: '#ffffff' } })
    .composite([{ input: block, left: 0, top: 0 }]).jpeg().withMetadata({ orientation }).toBuffer();
}

// How a browser or phone shows it: size and which corner the red block is in
async function shown(bytes: Buffer) {
  const { data, info } = await sharp(bytes).autoOrient().raw().toBuffer({ resolveWithObject: true });
  const red = (x: number, y: number) => data[(y * info.width + x) * info.channels] > 200 && data[(y * info.width + x) * info.channels + 1] < 80;
  const corners = { topLeft: red(2, 2), topRight: red(info.width - 3, 2), bottomLeft: red(2, info.height - 3), bottomRight: red(info.width - 3, info.height - 3) };
  return { size: `${info.width}x${info.height}`, corner: Object.entries(corners).filter(([, v]) => v).map(([k]) => k).join(',') };
}

// Turning a picture right moves each corner one step clockwise
const clockwise: Record<string, string> = { topLeft: 'topRight', topRight: 'bottomRight', bottomRight: 'bottomLeft', bottomLeft: 'topLeft' };
function expected(before: { size: string; corner: string }, angle: number) {
  const steps = ((angle / 90) % 4 + 4) % 4;
  let corner = before.corner;
  for (let i = 0; i < steps; i++) corner = clockwise[corner];
  const [w, h] = before.size.split('x');
  return { size: steps % 2 ? `${h}x${w}` : before.size, corner };
}

test('switch is off unless ROTATE_UPRIGHT_FIRST is true', () => {
  for (const value of [undefined, '', 'false', '1']) assert.equal(isRotateUprightFirstEnabled({ ROTATE_UPRIGHT_FIRST: value }), false);
  for (const value of ['true', ' True ']) assert.equal(isRotateUprightFirstEnabled({ ROTATE_UPRIGHT_FIRST: value }), true);
});

test('switch on: every EXIF orientation turns the way the guest sees it, and the result needs no EXIF mark', async () => {
  for (let orientation = 1; orientation <= 8; orientation++) {
    const original = await photo(orientation);
    const before = await shown(original);
    for (const angle of [90, -90, 180]) {
      const { data, info } = await rotateImage(original, angle, true);
      const after = await shown(data);
      assert.deepEqual(after, expected(before, angle), `orientation ${orientation}, angle ${angle}`);
      assert.equal(`${info.width}x${info.height}`, after.size, 'saved size matches what is shown');
      assert.ok(((await sharp(data).metadata()).orientation ?? 1) === 1);
    }
  }
});

test('switch off: the same output as before (sharp rotate(angle) alone)', async () => {
  const original = await photo(6);
  for (const angle of [90, -90]) {
    const old = await sharp(original).rotate(angle).toBuffer();
    assert.ok((await rotateImage(original, angle, false)).data.equals(old));
  }
});

test('switch on: a photo without an EXIF mark rotates exactly as before', async () => {
  const original = await photo(1);
  for (const angle of [90, -90, 180]) {
    assert.deepEqual(await shown((await rotateImage(original, angle, true)).data), await shown((await rotateImage(original, angle, false)).data));
  }
});
