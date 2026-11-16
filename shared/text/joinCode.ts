// Website and app (one copy): event join codes, the "Join ID" guests type in Join Event (issue #277).
// New codes are 8 characters shown as XXXX-XXXX. Older codes (6 to 10 characters, made from the event's name) stay valid.

/** No 0/O or 1/I/L, so a code read off a screen or a printed card can't be mistyped. */
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 8;

/** What the Join Event boxes show as an example. */
export const JOIN_CODE_EXAMPLE = 'K7MP-Q4RX';
/** Room for the longest old code (10) plus a stray space or two. */
export const JOIN_CODE_INPUT_MAX_LENGTH = 12;

type RandomSource = { getRandomValues?: (array: Uint8Array) => Uint8Array };

function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  const source = (globalThis as { crypto?: RandomSource }).crypto;
  if (typeof source?.getRandomValues === 'function') source.getRandomValues(bytes);
  else for (let i = 0; i < count; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** A new random join code, e.g. "K7MP-Q4RX". */
export function newEventJoinCode(): string {
  let code = '';
  while (code.length < JOIN_CODE_LENGTH) {
    for (const byte of randomBytes(16)) {
      // 248 = 8 x 31: higher bytes are skipped so every character is equally likely
      if (byte < 248 && code.length < JOIN_CODE_LENGTH) code += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
    }
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * A typed code as it is saved: capitals, and a code of 8 or more letters and digits typed without its dash (or with
 * spaces) gets the dash back after the 4th character ("k7mp q4rx" -> "K7MP-Q4RX"). Every saved code that long has its
 * dash there. Anything shorter or else is only trimmed and capitalised, so old codes like "ABC-12" still match.
 */
export function normalizeJoinCode(typed: string): string {
  const text = typed.trim().toUpperCase();
  const compact = text.replace(/[\s\-‐-―]/g, '');
  if (compact.length >= JOIN_CODE_LENGTH && /^[A-Z0-9]+$/.test(compact)) return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  return text;
}
