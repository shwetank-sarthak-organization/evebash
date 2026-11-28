import { test } from "node:test";
import assert from "node:assert/strict";
import { wantsUploadAlerts } from "../src/routes/notifications.js";

// #63: which notification switches stop the gallery owner's "new photos / new video uploaded" pushes

test("no settings saved: upload alerts are on", () => {
  assert.equal(wantsUploadAlerts(null), true);
  assert.equal(wantsUploadAlerts(undefined), true);
  assert.equal(wantsUploadAlerts({}), true);
});

test("older app builds: Likes & comments off stops upload alerts", () => {
  assert.equal(wantsUploadAlerts({ likesAndComments: false, eventInvites: true }), false);
  assert.equal(wantsUploadAlerts({ likesAndComments: true }), true);
});

test("app builds with the New uploads switch: only that switch counts", () => {
  assert.equal(wantsUploadAlerts({ newUploads: false, likesAndComments: true }), false);
  assert.equal(wantsUploadAlerts({ newUploads: true, likesAndComments: false }), true);
});

test("all pushes off, or the old event_activity key off, still stops them", () => {
  assert.equal(wantsUploadAlerts({ push: false, newUploads: true }), false);
  assert.equal(wantsUploadAlerts({ event_activity: false }), false);
});

test("settings saved as JSON text are read too", () => {
  assert.equal(wantsUploadAlerts(JSON.stringify({ newUploads: false })), false);
  assert.equal(wantsUploadAlerts("not json"), true);
});
