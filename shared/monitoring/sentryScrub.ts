// Website and app: remove personal data from a Sentry event before it leaves the device. Every text in the event
// (messages, stack values, breadcrumbs, URLs) loses emails, sign-in tokens and signed-link parameters, cookies and
// auth headers are dropped, and the user is reduced to their id.
// The backend keeps its own copy in apps/backend/src/sentry.ts because Railway deploys apps/backend on its own and
// cannot import shared/; change both together.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
// Query/fragment values that sign in or unlock something: Supabase auth links, signed B2/S3 URLs, share keys.
const SECRET_PARAM =
  /([?&#](?:access_token|refresh_token|id_token|token|code|key|apikey|signature|sig|x-amz-signature|x-amz-credential|x-amz-security-token|authorization)=)[^&#\s"']*/gi;
const SECRET_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'apikey']);
const MAX_DEPTH = 12;

export function scrubText(text: string): string {
  return text
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(SECRET_PARAM, '$1[removed]')
    .replace(EMAIL, '[email]');
}

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SECRET_HEADERS.has(key.toLowerCase()) ? '[removed]' : scrubValue(item, depth + 1);
  }
  return out;
}

type ScrubbableEvent = {
  user?: { id?: string | number } & Record<string, unknown>;
  request?: { cookies?: unknown; data?: unknown } & Record<string, unknown>;
};

export function scrubSentryEvent<T extends object>(event: T): T {
  const scrubbed = scrubValue(event, 0) as T & ScrubbableEvent;
  if (scrubbed.user) scrubbed.user = scrubbed.user.id != null ? { id: scrubbed.user.id } : {};
  if (scrubbed.request) {
    delete scrubbed.request.cookies;
    delete scrubbed.request.data;
  }
  return scrubbed;
}
