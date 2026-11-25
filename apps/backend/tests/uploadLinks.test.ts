import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createEventBucket } from "../src/services/eventBucketS3.js";
import { isLegacyUploadTokenOn, isOneFileUploadLinkOn, ONE_FILE_LINK_SECONDS, oneFileUploadLink, uploadContentType } from "../src/services/uploadLinks.js";

// Issue #318: gallery uploads get a link signed for ONE file (storage key + content type), not Backblaze's any-file link

const env = { B2_BUCKET_NAME: "EveBash-test", B2_KEY_ID: "key-id", B2_APPLICATION_KEY: "secret", B2_S3_ENDPOINT: "s3.ca-east-006.backblazeb2.com" } as NodeJS.ProcessEnv;

afterEach(() => {
  delete process.env.ONE_FILE_UPLOAD_LINKS;
  delete process.env.UPLOAD_LEGACY_B2_TOKEN;
});

test("the one-file link is for exactly this file and type, for 2 hours, with no cache header", async () => {
  const bucket = await createEventBucket(env);
  const key = "events/wedding-1a2b/photos/user-1-1795610000000-0b9c-IMG 001.jpg";
  const link = await oneFileUploadLink(bucket, key, "image/jpeg");
  assert.ok(link);
  const url = new URL(link.putUrl);
  assert.equal(url.host, "s3.ca-east-006.backblazeb2.com");
  assert.equal(decodeURIComponent(url.pathname), `/EveBash-test/${key}`);
  assert.equal(url.searchParams.get("X-Amz-Expires"), String(ONE_FILE_LINK_SECONDS));
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "content-type;host");
  assert.ok(url.searchParams.get("X-Amz-Signature"));
  assert.deepEqual(link.putHeaders, { "Content-Type": "image/jpeg" });
});

test("a link for another file or type has another signature (it can't be reused for a different name)", async () => {
  const bucket = await createEventBucket(env);
  const a = new URL((await oneFileUploadLink(bucket, "events/g/photos/u-1-a.jpg", "image/jpeg"))!.putUrl);
  const b = new URL((await oneFileUploadLink(bucket, "events/g/photos/u-1-b.jpg", "image/jpeg"))!.putUrl);
  const c = new URL((await oneFileUploadLink(bucket, "events/g/photos/u-1-a.jpg", "image/png"))!.putUrl);
  assert.notEqual(a.searchParams.get("X-Amz-Signature"), b.searchParams.get("X-Amz-Signature"));
  assert.notEqual(a.searchParams.get("X-Amz-Signature"), c.searchParams.get("X-Amz-Signature"));
});

test("the signed type is the client's picture/video type, else it comes from the file name", () => {
  assert.equal(uploadContentType("image/heic", "IMG.HEIC", false), "image/heic");
  assert.equal(uploadContentType("Video/QuickTime", "clip.mov", true), "video/quicktime");
  assert.equal(uploadContentType("text/html", "photo.png", false), "image/png");
  assert.equal(uploadContentType(undefined, "clip.mp4", true), "video/mp4");
  assert.equal(uploadContentType("", "noextension", false), "image/jpeg");
  assert.equal(uploadContentType("image/<script>", "a.webp", false), "image/webp");
});

test("switches: one-file links on unless ONE_FILE_UPLOAD_LINKS=false; the old any-file link stays until UPLOAD_LEGACY_B2_TOKEN=false", async () => {
  const bucket = await createEventBucket(env);
  assert.equal(isOneFileUploadLinkOn(), true);
  assert.equal(isLegacyUploadTokenOn(), true);
  process.env.ONE_FILE_UPLOAD_LINKS = "false";
  assert.equal(await oneFileUploadLink(bucket, "events/g/photos/u-1-a.jpg", "image/jpeg"), null);
  process.env.UPLOAD_LEGACY_B2_TOKEN = "false";
  assert.equal(isLegacyUploadTokenOn(), false);
  assert.equal(await oneFileUploadLink(null, "events/g/photos/u-1-a.jpg", "image/jpeg"), null, "no bucket, no link");
});
