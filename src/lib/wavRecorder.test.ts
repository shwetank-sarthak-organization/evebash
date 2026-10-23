import assert from 'node:assert/strict';
import { encodeWav } from './wavRecorder';

const text = (view: DataView, at: number, length: number) =>
    String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(at + i)));

// One second of a 440 Hz tone at 48 kHz, delivered in blocks like the browser does
const input = Float32Array.from({ length: 48_000 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48_000));
const blocks = Array.from({ length: Math.ceil(input.length / 128) }, (_, i) => input.slice(i * 128, (i + 1) * 128));
const wav = new DataView(encodeWav(blocks, 48_000));

assert.equal(text(wav, 0, 4), 'RIFF');
assert.equal(text(wav, 8, 4), 'WAVE');
assert.equal(text(wav, 12, 4), 'fmt ');
assert.equal(wav.getUint16(20, true), 1, 'PCM');
assert.equal(wav.getUint16(22, true), 1, 'mono');
assert.equal(wav.getUint32(24, true), 16_000, '16 kHz');
assert.equal(wav.getUint16(34, true), 16, '16-bit');
assert.equal(text(wav, 36, 4), 'data');
assert.equal(wav.getUint32(40, true), 16_000 * 2, 'one second of 16-bit samples');
assert.equal(wav.byteLength, 44 + 32_000);
assert.equal(wav.getUint32(4, true), wav.byteLength - 8, 'RIFF size');

// The tone survives downsampling: peak close to 0.5 of full scale, and it crosses zero ~880 times a second
let peak = 0;
let crossings = 0;
for (let i = 0; i < 16_000; i++) {
    const sample = wav.getInt16(44 + i * 2, true) / 0x8000;
    peak = Math.max(peak, Math.abs(sample));
    if (i > 0 && Math.sign(sample) !== Math.sign(wav.getInt16(44 + (i - 1) * 2, true))) crossings++;
}
assert.ok(peak > 0.45 && peak <= 0.5, `peak ${peak}`);
assert.ok(Math.abs(crossings - 880) < 20, `zero crossings ${crossings}`);

// Clipping and a rate already at 16 kHz
const loud = new DataView(encodeWav([Float32Array.from([2, -2, 0])], 16_000));
assert.equal(loud.getUint32(24, true), 16_000);
assert.deepEqual([loud.getInt16(44, true), loud.getInt16(46, true), loud.getInt16(48, true)], [0x7fff, -0x8000, 0]);

// Two minutes fit the 5 MB voice note limit
assert.ok(44 + 120 * 16_000 * 2 < 5 * 1024 * 1024);

console.log('wavRecorder tests passed');
