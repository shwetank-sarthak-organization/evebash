import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaRouter } from "../src/routes/media.js";

const SECRET = "test-internal-secret";

function findHandler(path: string) {
  const layer = (mediaRouter.stack as any[]).find(
    (l) => l.route && l.route.path === path && l.route.methods.post
  );
  if (!layer) throw new Error(`Route not found: ${path}`);
  return layer.route.stack[0].handle;
}

function mockRequestResponse(body: Record<string, any>, authorization = "") {
  const req = {
    method: "POST",
    url: "/internal/video-processed",
    body,
    get: (name: string) => (name.toLowerCase() === "authorization" ? authorization : ""),
    header: () => "",
    headers: {},
  } as any;

  let statusCode = 200;
  let responseData: any = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    setHeader() { return res; },
  } as any;

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

test("video-processed callback validates the caller and input without touching the database", async () => {
  const previousSecret = process.env.INTERNAL_JOB_SECRET;
  const previousFlag = process.env.VIDEO_READY_PUSH;
  process.env.INTERNAL_JOB_SECRET = SECRET;
  delete process.env.VIDEO_READY_PUSH;

  try {
    const handler = findHandler("/internal/video-processed");

    // 1. Rejects calls without the internal job secret
    const noAuth = mockRequestResponse({ photoId: "p1" });
    await handler(noAuth.req, noAuth.res, () => {});
    assert.equal(noAuth.getStatus(), 401);

    const wrongAuth = mockRequestResponse({ photoId: "p1" }, "Bearer not-the-secret");
    await handler(wrongAuth.req, wrongAuth.res, () => {});
    assert.equal(wrongAuth.getStatus(), 401);

    // 2. Rejects a missing photoId
    const noPhoto = mockRequestResponse({}, `Bearer ${SECRET}`);
    await handler(noPhoto.req, noPhoto.res, () => {});
    assert.equal(noPhoto.getStatus(), 400);
    assert.equal(noPhoto.getData()?.error, "Missing photoId");

    // 3. With VIDEO_READY_PUSH off (the default), the callback is accepted and does nothing
    const disabled = mockRequestResponse({ photoId: "p1" }, `Bearer ${SECRET}`);
    await handler(disabled.req, disabled.res, () => {});
    assert.equal(disabled.getStatus(), 200);
    assert.equal(disabled.getData()?.skipped, "disabled");
  } finally {
    if (previousSecret === undefined) delete process.env.INTERNAL_JOB_SECRET;
    else process.env.INTERNAL_JOB_SECRET = previousSecret;
    if (previousFlag === undefined) delete process.env.VIDEO_READY_PUSH;
    else process.env.VIDEO_READY_PUSH = previousFlag;
  }
});
