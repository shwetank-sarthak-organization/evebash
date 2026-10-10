/**
 * Where to go after logging in from a gallery's "Log in" button. Only gallery screens are allowed, so a
 * crafted link can't send someone elsewhere after login.
 */
export function safeReturnTo(value: unknown): string | null {
  return typeof value === 'string' && /^\/events\/(sub\/)?[^/?#]+$/.test(value) ? value : null;
}
