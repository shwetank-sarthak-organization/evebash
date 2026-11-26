import { test } from "node:test";
import assert from "node:assert/strict";
import { hasStorageUploadLink, storageUploadRequest } from "./storageUploadRequest";

// Issue #318: website and app upload with the one-file link when the backend sends one, else with Backblaze's link

const key = "events/g/photos/u-1-IMG 1.jpg";

test("the one-file link wins: PUT with exactly the headers the backend signed", () => {
  const request = storageUploadRequest(
    { storageKey: key, putUrl: "https://s3.example/one", putHeaders: { "Content-Type": "image/jpeg" }, uploadUrl: "https://b2.example/any", authorizationToken: "t" },
    "image/png",
  );
  assert.deepEqual(request, { url: "https://s3.example/one", method: "PUT", headers: { "Content-Type": "image/jpeg" } });
});

test("without it, Backblaze's own upload as before", () => {
  const request = storageUploadRequest({ storageKey: key, uploadUrl: "https://b2.example/any", authorizationToken: "t" }, "");
  assert.equal(request.method, "POST");
  assert.equal(request.url, "https://b2.example/any");
  assert.deepEqual(request.headers, {
    Authorization: "t",
    "Content-Type": "application/octet-stream",
    "X-Bz-File-Name": encodeURIComponent(key),
    "X-Bz-Content-Sha1": "do_not_verify",
  });
});

test("no link at all is an error, and hasStorageUploadLink says so first", () => {
  assert.equal(hasStorageUploadLink({ storageKey: key }), false);
  assert.equal(hasStorageUploadLink({ storageKey: key, uploadUrl: "u" }), false);
  assert.equal(hasStorageUploadLink({ storageKey: key, putUrl: "p" }), true);
  assert.equal(hasStorageUploadLink(null), false);
  assert.throws(() => storageUploadRequest({ storageKey: key }, "image/jpeg"), /no upload link/);
});
