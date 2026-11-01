// Crash and error reporting (todo #6). Imported early in index.js. Off unless EXPO_PUBLIC_SENTRY_DSN is set (only
// the EAS staging profile sets it): the SDK is then never loaded, so nothing changes. Errors and native crashes
// only (no tracing, replays or screenshots), and personal data is removed before an event is sent.
// The SDK has native code: builds made before it was added ignore it, so ship it in a new build, not an OTA update.
import { scrubSentryEvent } from '../../../shared/monitoring/sentryScrub';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
let sentry: typeof import('@sentry/react-native') | null = null;

if (dsn) {
  try {
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() || 'development',
      sendDefaultPii: false,
      // The default rewrites real fetch error messages; only change the copy sent to Sentry.
      enhanceFetchErrorMessages: 'report-only',
      beforeSend: (event) => scrubSentryEvent(event),
      beforeBreadcrumb: (breadcrumb) => scrubSentryEvent(breadcrumb),
    });
    sentry = Sentry;
  } catch (err) {
    console.warn('[Sentry] failed to start; continuing without it:', err);
  }
}

/** Sends an error the app recovered from, which Sentry's crash handler never sees. Does nothing while Sentry is off. */
export function reportError(error: unknown) {
  try {
    sentry?.captureException(error);
  } catch (err) {
    console.warn('[Sentry] failed to send an error:', err);
  }
}
