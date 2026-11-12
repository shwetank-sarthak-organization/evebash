import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideStuckVideo,
  queueAwareWatchdogEnabled,
  HEARTBEAT_STALE_MS,
  QUEUE_LIMIT_MS,
} from "../src/services/watchdog.js";

const now = Date.parse("2026-10-27T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();
const MIN = 60 * 1000;

test("queue-aware watchdog is off unless the variable is exactly true", () => {
  for (const off of [undefined, "", "false", "1", "yes", "on"]) assert.equal(queueAwareWatchdogEnabled(off), false, String(off));
  for (const on of ["true", " TRUE ", "True"]) assert.equal(queueAwareWatchdogEnabled(on), true, on);
});

test("a recent heartbeat means a worker is running it: leave it", () => {
  const d = decideStuckVideo({ transcode_attempts: 3, transcode_heartbeat_at: ago(2 * MIN), transcode_queued_at: ago(40 * MIN) }, now);
  assert.equal(d.action, "wait");
});

test("queued and never started, within the queue limit: leave it (burst backlog)", () => {
  const d = decideStuckVideo({ transcode_attempts: 0, transcode_queued_at: ago(50 * MIN) }, now);
  assert.equal(d.action, "wait");
  assert.equal(decideStuckVideo({ transcode_attempts: 3, transcode_queued_at: ago(QUEUE_LIMIT_MS - MIN) }, now).action, "wait");
});

test("queued again after the last heartbeat (GPU to 16-core handover): leave it", () => {
  const d = decideStuckVideo({ transcode_heartbeat_at: ago(30 * MIN), transcode_queued_at: ago(25 * MIN) }, now);
  assert.equal(d.action, "wait");
});

test("heartbeat stopped and not queued again: re-send, then fail after 3 attempts", () => {
  const stale = { transcode_heartbeat_at: ago(HEARTBEAT_STALE_MS + MIN), transcode_queued_at: ago(60 * MIN) };
  assert.equal(decideStuckVideo({ ...stale, transcode_attempts: 0 }, now).action, "resend");
  assert.equal(decideStuckVideo({ ...stale, transcode_attempts: 2 }, now).action, "resend");
  const d = decideStuckVideo({ ...stale, transcode_attempts: 3 }, now);
  assert.equal(d.action, "fail");
  assert.match(d.reason, /heartbeats/);
});

test("queued too long without starting: treated as lost", () => {
  const d = decideStuckVideo({ transcode_attempts: 1, transcode_queued_at: ago(QUEUE_LIMIT_MS + MIN) }, now);
  assert.equal(d.action, "resend");
  assert.match(d.reason, /2 hours/);
});

test("no markers at all (Modal switch off or job never accepted): same as the old rule", () => {
  assert.equal(decideStuckVideo({ transcode_attempts: 0 }, now).action, "resend");
  assert.equal(decideStuckVideo({ transcode_attempts: 2 }, now).action, "resend");
  assert.equal(decideStuckVideo({ transcode_attempts: 3 }, now).action, "fail");
  assert.equal(decideStuckVideo({ transcode_attempts: null, transcode_queued_at: "not a date" }, now).action, "resend");
});
