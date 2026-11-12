import assert from "node:assert/strict";
import { test } from "node:test";
import { initSentry, reportError, scrubSentryEvent, scrubText } from "../src/sentry.ts";

test("Sentry stays off without SENTRY_DSN and reportError is a no-op", async () => {
  delete process.env.SENTRY_DSN;
  await initSentry();
  assert.doesNotThrow(() => reportError(new Error("boom"), { url: "/api/x" }));
});

test("scrubText removes emails, tokens and signed-link parameters", () => {
  assert.equal(scrubText("no profile for host@example.com"), "no profile for [email]");
  assert.equal(scrubText("/api/v1/media?token=abc&page=2"), "/api/v1/media?token=[removed]&page=2");
  assert.equal(scrubText("Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc"), "Bearer [token]");
});

test("scrubSentryEvent drops secret headers, bodies and everything but the user id", () => {
  const event = scrubSentryEvent({
    user: { id: "u1", email: "host@example.com", ip_address: "1.2.3.4" },
    request: {
      url: "https://api-staging.evebash.com/api/v1/account",
      headers: { authorization: "Bearer abc", "x-internal-job-secret": "s", "x-cron-secret": "c", "user-agent": "okhttp" },
      data: { email: "host@example.com" },
      cookies: { a: "b" },
    },
  });
  assert.deepEqual(event.user, { id: "u1" });
  assert.deepEqual(event.request.headers, {
    authorization: "[removed]",
    "x-internal-job-secret": "[removed]",
    "x-cron-secret": "[removed]",
    "user-agent": "okhttp",
  });
  assert.equal("data" in event.request, false);
  assert.equal("cookies" in event.request, false);
});
