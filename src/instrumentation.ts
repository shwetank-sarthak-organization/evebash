// Server-side crash and error reporting: off unless NEXT_PUBLIC_SENTRY_DSN is set (see src/lib/sentry.ts).
import { sentryDsn, sentryOptions } from '@/lib/sentry';

type CaptureRequestError = typeof import('@sentry/nextjs').captureRequestError;

export async function register() {
  if (!sentryDsn) return;
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init(sentryOptions());
  }
}

export async function onRequestError(...args: Parameters<CaptureRequestError>) {
  if (!sentryDsn) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
}
