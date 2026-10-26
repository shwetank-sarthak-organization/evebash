// Crash and error reporting (todo #6), used by src/instrumentation.ts (server) and src/instrumentation-client.ts
// (browser). Off unless NEXT_PUBLIC_SENTRY_DSN is set: @sentry/nextjs is then never loaded. Errors only (no tracing
// or replays), and personal data is removed before an event is sent.
import { scrubSentryEvent } from '../../shared/monitoring/sentryScrub';

export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || '';

const PERFORMANCE_INTEGRATIONS = new Set(['BrowserTracing', 'WebVitals', 'SpanStreaming']);

export function sentryOptions() {
  return {
    dsn: sentryDsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() || process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || undefined,
    // No user info, cookies, bodies or auth headers; secrets left in URLs and messages are removed in beforeSend.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpBodies: [],
      httpHeaders: { request: { allow: ['user-agent', 'content-type'] }, response: false },
    },
    // The default rewrites real fetch error messages; only change the copy sent to Sentry.
    enhanceFetchErrorMessages: 'report-only' as const,
    // Errors only: drop the page-speed and tracing integrations @sentry/nextjs adds by default.
    integrations: <T extends { name: string }>(defaults: T[]) => defaults.filter((i) => !PERFORMANCE_INTEGRATIONS.has(i.name)),
    beforeSend: <T extends object>(event: T) => scrubSentryEvent(event),
    beforeBreadcrumb: <T extends object>(breadcrumb: T) => scrubSentryEvent(breadcrumb),
  };
}
