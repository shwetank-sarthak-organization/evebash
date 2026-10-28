import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildChain,
  checkStep,
  claimActive,
  dispatchStep,
  executionTimeoutMs,
  isRunpodVideoActive,
  outputFileHeaders,
  releaseActive,
  resetActiveForTests,
  runpodVideoConfig,
  signJobToken,
  verifyJobToken,
  type DispatchState,
  type RunpodDeps,
} from "../src/services/runpodVideo.js";

const ENDPOINTS = { RUNPOD_ENDPOINT_ADA: "ada1", RUNPOD_ENDPOINT_BLACKWELL: "bw1", RUNPOD_ENDPOINT_CPU32: "cpu1" };

test("switch: off unless VIDEO_RUNPOD is test/on with a key and an endpoint", () => {
  const base = { RUNPOD_API_KEY: "k", ...ENDPOINTS } as any;
  assert.equal(isRunpodVideoActive("g1", runpodVideoConfig({ ...base })), false, "default off");
  assert.equal(isRunpodVideoActive("g1", runpodVideoConfig({ ...base, VIDEO_RUNPOD: "yes" })), false, "unknown value = off");
  assert.equal(isRunpodVideoActive("g1", runpodVideoConfig({ ...base, VIDEO_RUNPOD: "on" })), true);
  assert.equal(isRunpodVideoActive("g1", runpodVideoConfig({ ...base, VIDEO_RUNPOD: "test", VIDEO_RUNPOD_TEST_EVENTS: "a, g1" })), true);
  assert.equal(isRunpodVideoActive("g2", runpodVideoConfig({ ...base, VIDEO_RUNPOD: "test", VIDEO_RUNPOD_TEST_EVENTS: "a, g1" })), false);
  assert.equal(isRunpodVideoActive(undefined, runpodVideoConfig({ ...base, VIDEO_RUNPOD: "test", VIDEO_RUNPOD_TEST_EVENTS: "g1" })), false);
  assert.equal(isRunpodVideoActive("g1", runpodVideoConfig({ ...ENDPOINTS, VIDEO_RUNPOD: "on" } as any)), false, "no API key");
  assert.equal(isRunpodVideoActive("g1", runpodVideoConfig({ RUNPOD_API_KEY: "k", VIDEO_RUNPOD: "on" } as any)), false, "no endpoint");
});

test("chain: long videos GPU first, short ones CPU, Modal always last", () => {
  assert.deepEqual(buildChain(true), ["runpod_ada", "runpod_blackwell", "runpod_cpu32", "modal"]);
  assert.deepEqual(buildChain(false), ["runpod_cpu32", "modal"]);
  assert.equal(executionTimeoutMs(60), 900_000);
  assert.equal(executionTimeoutMs(1800), (1800 * 1.5 + 600) * 1000);
  assert.equal(executionTimeoutMs(100_000), 7_200_000);
});

test("job token: signed, bound to its claims, expires", () => {
  const claims = { p: "p1", k: "events/e/videos/v.mp4", e: "e", w: "runpod_ada" as const, n: "n1", x: Date.now() + 60_000 };
  const token = signJobToken(claims, "secret");
  assert.deepEqual(verifyJobToken(token, "secret"), claims);
  assert.equal(verifyJobToken(token, "other-secret"), null);
  const [body, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...claims, k: "events/other.mp4" })).toString("base64url");
  assert.equal(verifyJobToken(`${forged}.${sig}`, "secret"), null, "changed claims");
  assert.equal(verifyJobToken(`${body}.`, "secret"), null);
  assert.equal(verifyJobToken(token, "secret", claims.x + 1), null, "expired");
  assert.equal(verifyJobToken(undefined, "secret"), null);
});

test("output files: only this video's stream files, each with its storage headers", () => {
  assert.deepEqual(outputFileHeaders("1080p/seg_000.ts"), { "Content-Type": "video/MP2T", "Cache-Control": "public, max-age=31536000, immutable" });
  assert.equal(outputFileHeaders("audio/seg_1234.ts")?.["Content-Type"], "video/MP2T");
  assert.equal(outputFileHeaders("720p/playlist.m3u8")?.["Cache-Control"], "public, max-age=31536000, immutable");
  assert.deepEqual(outputFileHeaders("master.m3u8"), { "Content-Type": "application/x-mpegURL", "Cache-Control": "public, max-age=3600" });
  assert.equal(outputFileHeaders("poster.jpg")?.["Content-Type"], "image/jpeg");
  for (const bad of ["../x.ts", "1080p/../../events/a.mp4", "2160p/seg_000.ts", "1080p/seg_0.ts", "1080p/evil.sh", "/master.m3u8", "master.m3u8/x", ""]) {
    assert.equal(outputFileHeaders(bad), null, bad);
  }
});

function fakeDeps(responses: Record<string, (body: any) => { status: number; json: any }>, overrides: Partial<RunpodDeps> = {}) {
  const calls: { method: string; path: string; body: any }[] = [];
  const scheduled: { state: DispatchState; delay: number }[] = [];
  const modal: DispatchState[] = [];
  let now = 1_000_000;
  const deps: RunpodDeps = {
    config: runpodVideoConfig({ RUNPOD_API_KEY: "k", VIDEO_RUNPOD: "on", RUNPOD_QUEUE_WAIT_S: "180", ...ENDPOINTS } as any),
    fetch: (async (url: string, init: any) => {
      const path = String(url).replace("https://api.runpod.ai/v2/", "");
      const body = init.body ? JSON.parse(init.body) : undefined;
      calls.push({ method: init.method, path, body });
      const key = Object.keys(responses).find((k) => new RegExp(k).test(`${init.method} ${path}`));
      const r = key ? responses[key](body) : { status: 500, json: { error: "unexpected" } };
      return { ok: r.status < 300, status: r.status, text: async () => JSON.stringify(r.json) } as any;
    }) as any,
    now: () => now,
    log: () => {},
    scheduleCheck: async (state, delay) => { scheduled.push({ state, delay }); },
    sendToModal: async (state) => { modal.push(state); return true; },
    signSource: async (key) => `https://b2/${key}?signed`,
    signToken: (claims) => signJobToken(claims, "secret"),
    callbackUrl: "https://api/api/v1/video-worker",
    ...overrides,
  };
  return { deps, calls, scheduled, modal, advance: (ms: number) => { now += ms; } };
}

const baseState = (isLong = true): DispatchState => ({
  photoId: "p1", storageKey: "events/e/videos/v.mp4", eventId: "e", duration: 720, isLongVideo: isLong,
  chain: buildChain(isLong), index: 0, modalPayload: { id: "p1", storage_key: "events/e/videos/v.mp4" },
});

test("dispatch: starts the first worker with a signed source, a job token and a time limit, then schedules a check", async () => {
  const f = fakeDeps({ "^POST ada1/run$": () => ({ status: 200, json: { id: "job-1", status: "IN_QUEUE" } }) });
  const result = await dispatchStep(baseState(), f.deps);
  assert.equal(result.action, "dispatched");
  const input = f.calls[0].body.input;
  assert.equal(input.hardware, "gpu");
  assert.equal(input.worker, "runpod_ada");
  assert.equal(input.source_url, "https://b2/events/e/videos/v.mp4?signed");
  assert.equal(verifyJobToken(input.job_token, "secret", 1_000_001)?.k, "events/e/videos/v.mp4");
  assert.equal(f.calls[0].body.policy.executionTimeout, executionTimeoutMs(720));
  assert.equal(f.scheduled.length, 1);
  assert.equal(f.scheduled[0].state.jobId, "job-1");
  assert.equal(f.scheduled[0].state.endpointId, "ada1");
});

test("dispatch: a worker that can't start or has no endpoint is skipped; Modal ends the chain", async () => {
  const f = fakeDeps({ "^POST (ada1|bw1|cpu1)/run$": () => ({ status: 503, json: { error: "down" } }) });
  const result = await dispatchStep(baseState(), f.deps);
  assert.equal(result.action, "modal");
  assert.equal(f.modal.length, 1);
  assert.equal(f.calls.length, 3);

  const g = fakeDeps({ "^POST cpu1/run$": () => ({ status: 200, json: { id: "job-c" } }) }, {});
  g.deps.config.endpoints = { runpod_cpu32: "cpu1" };
  const r2 = await dispatchStep(baseState(), g.deps);
  assert.equal(r2.worker, "runpod_cpu32", "Ada and Blackwell skipped without endpoints");
});

test("dispatch: a worker that can't be prepared (signing fails, RunPod unreachable) is skipped, never stuck", async () => {
  const f = fakeDeps({}, {
    signSource: async () => { throw new Error("Event bucket S3 access is not configured"); },
  });
  const r = await dispatchStep(baseState(), f.deps);
  assert.equal(r.action, "modal", "every RunPod worker failed to prepare -> Modal");
  assert.equal(f.modal.length, 1);
  assert.match(f.modal[0].history!.join(), /runpod_ada: could not start \(Event bucket S3 access is not configured\)/);

  const g = fakeDeps({ "^POST cpu1/run$": () => ({ status: 200, json: { id: "job-c" } }) });
  const realFetch = g.deps.fetch;
  g.deps.fetch = (async (url: string, init: any) => {
    if (String(url).includes("ada1") || String(url).includes("bw1")) throw new TypeError("fetch failed");
    return realFetch(url as any, init);
  }) as any;
  const r2 = await dispatchStep(baseState(), g.deps);
  assert.equal(r2.worker, "runpod_cpu32", "network errors on Ada and Blackwell -> CPU 32 vCPU");
});

test("check: waiting within the limit -> check again; past the limit -> cancel, then the next worker", async () => {
  const f = fakeDeps({
    "^GET ada1/status/job-1$": () => ({ status: 200, json: { status: "IN_QUEUE" } }),
    "^POST ada1/cancel/job-1$": () => ({ status: 200, json: { status: "CANCELLED" } }),
    "^POST bw1/run$": () => ({ status: 200, json: { id: "job-2" } }),
  });
  const state = { ...baseState(), jobId: "job-1", endpointId: "ada1", dispatchedAt: 1_000_000 };
  f.advance(60_000);
  assert.equal((await checkStep(state, f.deps)).action, "wait");
  assert.equal(f.scheduled[0].state.checks, 1);
  f.advance(200_000);
  const moved = await checkStep(state, f.deps);
  assert.equal((moved as any).worker, "runpod_blackwell");
  assert.ok(f.calls.some((c) => c.path === "ada1/cancel/job-1"));
  assert.match(f.scheduled.at(-1)!.state.history!.join(), /runpod_ada: no worker within 180 s/);
});

test("check: a job that started just as it was cancelled keeps running", async () => {
  const f = fakeDeps({
    "^GET ada1/status/job-1$": () => ({ status: 200, json: { status: "IN_QUEUE" } }),
    "^POST ada1/cancel/job-1$": () => ({ status: 200, json: { status: "IN_PROGRESS" } }),
  });
  f.advance(500_000);
  const r = await checkStep({ ...baseState(), jobId: "job-1", endpointId: "ada1", dispatchedAt: 1_000_000 }, f.deps);
  assert.equal(r.action, "wait");
  assert.ok(!f.calls.some((c) => c.path.endsWith("/run")), "no second worker started");
});

test("check: running -> wait; completed -> done; failed / timed out / gone -> next worker", async () => {
  const running = { ...baseState(), jobId: "job-1", endpointId: "ada1", dispatchedAt: 1_000_000 };
  for (const [status, http, expect] of [["IN_PROGRESS", 200, "wait"], ["COMPLETED", 200, "done"], ["FAILED", 200, "dispatched"], ["TIMED_OUT", 200, "dispatched"], ["", 404, "dispatched"]] as const) {
    const f = fakeDeps({
      "^GET ada1/status/job-1$": () => ({ status: http, json: { status, error: "boom" } }),
      "^POST bw1/run$": () => ({ status: 200, json: { id: "job-2" } }),
    });
    f.advance(30_000);
    assert.equal((await checkStep(running, f.deps)).action, expect, `${status || http}`);
  }
});

test("check: a job running far past its time limit is cancelled and the next worker starts", async () => {
  const f = fakeDeps({
    "^GET cpu1/status/j$": () => ({ status: 200, json: { status: "IN_PROGRESS" } }),
    "^POST cpu1/cancel/j$": () => ({ status: 200, json: { status: "CANCELLED" } }),
  });
  f.advance(executionTimeoutMs(60) + 16 * 60_000);
  const state = { ...baseState(false), duration: 60, jobId: "j", endpointId: "cpu1", dispatchedAt: 1_000_000 };
  assert.equal((await checkStep(state, f.deps)).action, "modal");
});

test("check: RunPod's API failing throws, so QStash retries the check", async () => {
  const f = fakeDeps({ "^GET ada1/status/job-1$": () => ({ status: 502, json: {} }) });
  await assert.rejects(checkStep({ ...baseState(), jobId: "job-1", endpointId: "ada1", dispatchedAt: 1_000_000 }, f.deps));
});

test("active claims: one RunPod job per video at a time", () => {
  resetActiveForTests();
  assert.equal(claimActive("p1", "a", 0), true);
  assert.equal(claimActive("p1", "a", 1), true, "same job again");
  assert.equal(claimActive("p1", "b", 2), false, "another job");
  releaseActive("p1", "b");
  assert.equal(claimActive("p1", "b", 3), false, "only the owner releases");
  releaseActive("p1", "a");
  assert.equal(claimActive("p1", "b", 4), true);
  assert.equal(claimActive("p2", "c", 0), true);
  assert.equal(claimActive("p2", "d", 4 * 3600 * 1000), true, "a stale claim expires");
});

// ── publishManifestAssemblyTask: switch off = exactly today's Modal call ──────────────────────────────────────

async function captureQstash(env: Record<string, string>, payload: any, failDispatch = false) {
  const saved = { ...process.env };
  const savedFetch = globalThis.fetch;
  Object.assign(process.env, { QSTASH_TOKEN: "qt", INTERNAL_JOB_SECRET: "s", NEXT_PUBLIC_API_URL: "https://api.test", ...env });
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  globalThis.fetch = (async (url: string, init: any) => {
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    const fail = failDispatch && String(url).includes("/video-worker/");
    return { ok: !fail, status: fail ? 500 : 200, json: async () => ({ messageId: "m" }), text: async () => "" } as any;
  }) as any;
  try {
    const { publishManifestAssemblyTask } = await import("../src/qstash.js");
    const ok = await publishManifestAssemblyTask(payload);
    return { ok, calls };
  } finally {
    globalThis.fetch = savedFetch;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

const VIDEO = { id: "p1", photo_id: "p1", storage_key: "events/g1/videos/v.mp4", event_id: "g1", duration: 720, fileSize: 5e8, user_id: "u1" };

test("switch off: the video is queued for the Modal long-video webhook exactly as before", async () => {
  const { ok, calls } = await captureQstash({ VIDEO_RUNPOD: "off", RUNPOD_API_KEY: "k", ...ENDPOINTS }, { ...VIDEO });
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://qstash-us-east-1.upstash.io/v2/enqueue/EveBash/https://shwetank-sarthak--wedding-media-engine-process-video-gpu.modal.run");
  assert.deepEqual(calls[0].headers, {
    Authorization: "Bearer qt",
    "Content-Type": "application/json",
    "Upstash-Timeout": "900s",
    "Upstash-Deduplication-Id": "video-transcode-events-g1-videos-v-mp4",
    "Upstash-Retries": "3",
  });
  assert.equal(calls[0].body.photo_id, "p1");
});

test("switch test, gallery listed: queued for the RunPod dispatcher with the long-video chain", async () => {
  const { ok, calls } = await captureQstash({ VIDEO_RUNPOD: "test", VIDEO_RUNPOD_TEST_EVENTS: "g1", RUNPOD_API_KEY: "k", ...ENDPOINTS }, { ...VIDEO });
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://qstash-us-east-1.upstash.io/v2/publish/https://api.test/api/v1/video-worker/dispatch");
  assert.equal(calls[0].headers["Upstash-Forward-Authorization"], "Bearer s");
  assert.equal(calls[0].headers["Upstash-Deduplication-Id"], "video-runpod-events-g1-videos-v-mp4");
  assert.deepEqual(calls[0].body.chain, ["runpod_ada", "runpod_blackwell", "runpod_cpu32", "modal"]);
  assert.equal(calls[0].body.modalPayload.storage_key, VIDEO.storage_key);
});

test("switch test, another gallery: Modal as before", async () => {
  const { calls } = await captureQstash({ VIDEO_RUNPOD: "test", VIDEO_RUNPOD_TEST_EVENTS: "other", RUNPOD_API_KEY: "k", ...ENDPOINTS }, { ...VIDEO });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /process-video-gpu\.modal\.run$/);
});

test("RunPod dispatch can't be queued: the video still goes to Modal", async () => {
  const { ok, calls } = await captureQstash({ VIDEO_RUNPOD: "on", RUNPOD_API_KEY: "k", ...ENDPOINTS }, { ...VIDEO, duration: 120, fileSize: 1e8 }, true);
  assert.equal(ok, true);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /process-video-cpu\.modal\.run$/);
  assert.equal(calls[1].headers["Upstash-Deduplication-Id"], "video-transcode-events-g1-videos-v-mp4");
});

// ── /upload-urls: links only for this job's own files ─────────────────────────────────────────────────────────

test("upload links: signed for hls/<storage_key>/<file> only, with the headers to send; bad token or key refused", async () => {
  Object.assign(process.env, { INTERNAL_JOB_SECRET: "s", B2_BUCKET_NAME: "Bucket", B2_KEY_ID: "kid", B2_APPLICATION_KEY: "key", B2_ENDPOINT: "s3.ca-east-006.backblazeb2.com" });
  const { videoWorkerRouter } = await import("../src/routes/videoWorker.js");
  const layer = (videoWorkerRouter.stack as any[]).find((l) => l.route?.path === "/upload-urls");
  const call = (body: any) => new Promise<{ status: number; data: any }>((resolve, reject) => {
    let status = 200;
    const res: any = { status(c: number) { status = c; return res; }, json(d: any) { resolve({ status, data: d }); return res; } };
    layer.route.stack[0].handle({ body } as any, res, reject);
  });
  const token = signJobToken({ p: "p1", k: "events/g1/videos/v.mp4", e: "g1", w: "runpod_cpu32", n: "n", x: Date.now() + 60_000 }, "s");
  const ok = await call({ job_token: token, keys: ["1080p/seg_000.ts", "master.m3u8"] });
  assert.equal(ok.status, 200);
  const link = ok.data.links["1080p/seg_000.ts"];
  assert.match(link.url, /^https:\/\/s3\.ca-east-006\.backblazeb2\.com\/Bucket\/hls\/events\/g1\/videos\/v\.mp4\/1080p\/seg_000\.ts\?/);
  assert.match(link.url, /X-Amz-SignedHeaders=cache-control%3Bcontent-type%3Bhost/);
  assert.equal(link.headers["Cache-Control"], "public, max-age=31536000, immutable");
  assert.equal(ok.data.links["master.m3u8"].headers["Cache-Control"], "public, max-age=3600");
  assert.equal((await call({ job_token: token, keys: ["../../events/g1/videos/other.mp4"] })).status, 400);
  assert.equal((await call({ job_token: token + "x", keys: ["master.m3u8"] })).status, 401);
  assert.equal((await call({ job_token: token, keys: [] })).status, 400);
});
