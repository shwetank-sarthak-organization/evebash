// Browser crash and error reporting: off unless NEXT_PUBLIC_SENTRY_DSN is set (see src/lib/sentry.ts). The SDK is
// loaded after the page starts, so it adds nothing to the first load.
import { sentryDsn, sentryOptions } from '@/lib/sentry';

if (sentryDsn) {
  import('@sentry/nextjs')
    .then((Sentry) => Sentry.init(sentryOptions()))
    .catch(() => {
      // Reporting must never break the page.
    });
}
