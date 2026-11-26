import { test } from "node:test";
import assert from "node:assert/strict";
import { homeAfterUnstar, isHomeUpload } from "./homeFavourites";

const homeIds = ["main-id", "main-legacy", undefined];
const home = [
  { id: "fav-from-haldi", eventId: "haldi-id" },
  { id: "home-upload", eventId: "main-id" },
  { id: "old-home-upload", eventId: "main-legacy" },
];

test("un-starring a sub-gallery photo takes it off Home at once", () => {
  const result = homeAfterUnstar(home, "fav-from-haldi", homeIds);
  assert.deepEqual(result.items.map(item => item.id), ["home-upload", "old-home-upload"]);
  assert.equal(result.removed?.id, "fav-from-haldi");
});

test("a photo uploaded to Home stays on Home when un-starred (by id or legacy id)", () => {
  for (const id of ["home-upload", "old-home-upload"]) {
    const result = homeAfterUnstar(home, id, homeIds);
    assert.equal(result.items.length, 3);
    assert.equal(result.removed, null);
  }
});

test("a photo that isn't on Home changes nothing", () => {
  assert.equal(homeAfterUnstar(home, "elsewhere", homeIds).items, home);
});

test("isHomeUpload needs a gallery id", () => {
  assert.equal(isHomeUpload({ id: "x", eventId: null }, homeIds), false);
  assert.equal(isHomeUpload({ id: "x", eventId: "main-id" }, homeIds), true);
});
