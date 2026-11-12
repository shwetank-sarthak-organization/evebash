// Crash and error reporting (todo #6). Off unless SENTRY_DSN is set: the SDK is not even loaded, so nothing changes.
// Errors only (no tracing), and personal data is removed before an event is sent.

type SentryNode = typeof import("@sentry/node");

let sentry: SentryNode | null = null;

// Same rules as shared/monitoring/sentryScrub.ts (website and app). Railway deploys apps/backend on its own, so the
// backend cannot import shared/; change both together.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const SECRET_PARAM =
  /([?&#](?:access_token|refresh_token|id_token|token|code|key|apikey|signature|sig|x-amz-signature|x-amz-credential|x-amz-security-token|authorization)=)[^&#\s"']*/gi;
const SECRET_HEADERS = new Set(["authorization", "cookie", "set-cookie", "x-api-key", "apikey", "x-internal-job-secret", "x-cron-secret", "x-evebash-secret"]);
const MAX_DEPTH = 12;

export function scrubText(text: string): string {
  return text
    .replace(JWT, "[token]")
    .replace(BEARER, "Bearer [token]")
    .replace(SECRET_PARAM, "$1[removed]")
    .replace(EMAIL, "[email]");
}

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return scrubText(value);
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SECRET_HEADERS.has(key.toLowerCase()) ? "[removed]" : scrubValue(item, depth + 1);
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

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || sentry) return;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT?.trim() || "staging",
      release: process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
      // No user info, cookies, bodies or auth headers; secrets left in URLs and messages are removed in beforeSend.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpBodies: [],
        httpHeaders: { request: { allow: ["user-agent", "content-type"] }, response: false },
      },
      // The default rewrites real fetch error messages; only change the copy sent to Sentry.
      enhanceFetchErrorMessages: "report-only",
      // server.ts already handles these and keeps the process running; Sentry's own handlers could exit it.
      integrations: (defaults) => defaults.filter((i) => i.name !== "OnUncaughtException" && i.name !== "OnUnhandledRejection"),
      beforeSend: (event) => scrubSentryEvent(event),
      beforeBreadcrumb: (breadcrumb) => scrubSentryEvent(breadcrumb),
    });
    sentry = Sentry;
    console.log("[EveBashBackend] Sentry error reporting on");
  } catch (err) {
    console.error("[EveBashBackend] Sentry failed to start; continuing without it:", err);
  }
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentry) return;
  try {
    sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Reporting must never break the request or the process.
  }
}
