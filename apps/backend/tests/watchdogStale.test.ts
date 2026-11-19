import { test } from "node:test";
import assert from "node:assert/strict";
import {
  failStaleVideosEnabled,
  isStaleProcessingVideo,
  STALE_PROCESSING_MS,
} from "../src/services/watchdog.js";

// Issue #183: videos still 'processing' 24 h after upload are marked failed
const now = Date.parse("2026-11-19T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();
const HOUR = 60 * 60 * 1000;

test("on unless the variable is exactly false", () => {
  assert.equal(failStaleVideosEnabled(undefined), true);
  assert.equal(failStaleVideosEnabled(""), true);
  assert.equal(failStaleVideosEnabled("true"), true);
  assert.equal(failStaleVideosEnabled(" FALSE "), false);
});

test("younger than 24 hours: left alone", () => {
  assert.equal(isStaleProcessingVideo({ uploaded_at: ago(7 * HOUR) }, now), false);
  assert.equal(isStaleProcessingVideo({ uploaded_at: ago(STALE_PROCESSING_MS - 60_000) }, now), false);
});

test("24 hours or older, no worker running it: given up on", () => {
  assert.equal(isStaleProcessingVideo({ uploaded_at: ago(STALE_PROCESSING_MS) }, now), true);
  assert.equal(isStaleProcessingVideo({ uploaded_at: ago(30 * HOUR), transcode_heartbeat_at: ago(5 * HOUR) }, now), true);
});

test("24 hours or older but a worker sent a heartbeat in the last 10 minutes: left alone", () => {
  assert.equal(isStaleProcessingVideo({ uploaded_at: ago(30 * HOUR), transcode_heartbeat_at: ago(2 * 60_000) }, now), false);
});

test("no or broken upload time: left alone", () => {
  assert.equal(isStaleProcessingVideo({ uploaded_at: null }, now), false);
  assert.equal(isStaleProcessingVideo({ uploaded_at: "not a date" }, now), false);
});
