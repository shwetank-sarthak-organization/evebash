import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newEventJoinCode, normalizeJoinCode } from './joinCode';

test('new codes are 8 characters as XXXX-XXXX, without look-alike characters', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const code = newEventJoinCode();
    assert.match(code, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    seen.add(code);
  }
  assert.equal(seen.size, 2000);
});

test('a code typed without its dash, in small letters or with spaces, is read as saved', () => {
  assert.equal(normalizeJoinCode('K7MP-Q4RX'), 'K7MP-Q4RX');
  assert.equal(normalizeJoinCode('k7mpq4rx'), 'K7MP-Q4RX');
  assert.equal(normalizeJoinCode(' k7mp q4rx '), 'K7MP-Q4RX');
  assert.equal(normalizeJoinCode('K7MP – Q4RX'), 'K7MP-Q4RX');
  assert.equal(normalizeJoinCode('K7M-PQ4RX'), 'K7MP-Q4RX');
});

test('old codes keep working as typed', () => {
  // 9 and 10 characters, made from the event's name and id
  assert.equal(normalizeJoinCode('wedd-77d4'), 'WEDD-77D4');
  assert.equal(normalizeJoinCode('WEDD77D4K'), 'WEDD-77D4K');
  // 6 characters: dash elsewhere, or none
  assert.equal(normalizeJoinCode('abc-1-'), 'ABC-1-');
  assert.equal(normalizeJoinCode('abc-12'), 'ABC-12');
  assert.equal(normalizeJoinCode('abcdef'), 'ABCDEF');
  assert.equal(normalizeJoinCode('   '), '');
});
