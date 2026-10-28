import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Todo #18 / issue #133: video transcodes on RunPod serverless, with Modal as the backup.
 *
 * Off unless VIDEO_RUNPOD is "test" (only galleries listed in VIDEO_RUNPOD_TEST_EVENTS, comma-separated) or "on"
 * (every gallery), and RUNPOD_API_KEY plus at least one endpoint id are set. Off: publishManifestAssemblyTask sends
 * every video to Modal exactly as before.
 *
 * On: QStash delivers the job to /api/v1/video-worker/dispatch, which starts a RunPod job on the first worker of
 * the video's backup chain and schedules a check (a delayed QStash message to /check, so the state lives in the
 * message and no table is needed). Every check asks RunPod for the job's status:
 *   IN_QUEUE longer than the wait limit  -> cancel; once RunPod confirms, start the next worker
 *   IN_PROGRESS                          -> check again in a minute (cancel + next only past the job's time limit)
 *   FAILED / TIMED_OUT / CANCELLED / gone -> next worker
 *   COMPLETED                            -> done (the worker already reported to /complete)
 * The chain always ends with Modal: the job is then queued for today's Modal webhook, so a video is never lost.
 *   long videos (> 10 min, as today): RunPod RTX 4000 Ada -> Blackwell 24 GB slice -> CPU 32 vCPU -> Modal
 *   other videos:                     RunPod CPU 32 vCPU -> Modal
 * (The plain-1080p order Ada -> CPU 32 vCPU -> Blackwell needs the video's resolution and frame rate, which the
 * backend doesn't know before a worker probes it; see todo #18.)
 */

export type RunpodWorker = "runpod_ada" | "runpod_blackwell" | "runpod_cpu32";
export type ChainStep = RunpodWorker | "modal";

export const WORKER_HARDWARE: Record<RunpodWorker, "gpu" | "cpu"> = {
  runpod_ada: "gpu",
  runpod_blackwell: "gpu",
  runpod_cpu32: "cpu",
};

/** RunPod's billed per-second rates (bills of 2026-10-27), for the cost log. */
export const WORKER_USD_PER_SECOND: Record<RunpodWorker, number> = {
  runpod_ada: 0.000164,
  runpod_blackwell: 0.000194,
  runpod_cpu32: 0.0000971,
};

export interface RunpodConfig {
  mode: "off" | "test" | "on";
  testEvents: Set<string>;
  apiKey: string;
  apiBase: string;
  endpoints: Partial<Record<RunpodWorker, string>>;
  queueWaitMs: number;
}

export function runpodVideoConfig(env: NodeJS.ProcessEnv = process.env): RunpodConfig {
  const raw = (env.VIDEO_RUNPOD || "off").trim().toLowerCase();
  const mode = raw === "on" || raw === "test" ? raw : "off";
  const endpoints: Partial<Record<RunpodWorker, string>> = {};
  const set = (worker: RunpodWorker, value?: string) => {
    if (value?.trim()) endpoints[worker] = value.trim();
  };
  set("runpod_ada", env.RUNPOD_ENDPOINT_ADA);
  set("runpod_blackwell", env.RUNPOD_ENDPOINT_BLACKWELL);
  set("runpod_cpu32", env.RUNPOD_ENDPOINT_CPU32);
  const waitSeconds = Number(env.RUNPOD_QUEUE_WAIT_S || 180);
  return {
    mode,
    testEvents: new Set((env.VIDEO_RUNPOD_TEST_EVENTS || "").split(",").map((s) => s.trim()).filter(Boolean)),
    apiKey: (env.RUNPOD_API_KEY || "").trim(),
    apiBase: (env.RUNPOD_API_BASE || "https://api.runpod.ai/v2").trim().replace(/\/+$/, ""),
    endpoints,
    queueWaitMs: (Number.isFinite(waitSeconds) && waitSeconds > 0 ? waitSeconds : 180) * 1000,
  };
}

/** Whether this gallery's videos go to RunPod first. */
export function isRunpodVideoActive(eventId: string | undefined, config: RunpodConfig = runpodVideoConfig()): boolean {
  if (config.mode === "off" || !config.apiKey || Object.keys(config.endpoints).length === 0) return false;
  return config.mode === "on" || (Boolean(eventId) && config.testEvents.has(String(eventId)));
}

export function buildChain(isLongVideo: boolean): ChainStep[] {
  return isLongVideo ? ["runpod_ada", "runpod_blackwell", "runpod_cpu32", "modal"] : ["runpod_cpu32", "modal"];
}

/** RunPod's time limit for one job: 1.5x the video's length + 10 min, between 15 min and 2 h. */
export function executionTimeoutMs(durationSeconds?: number) {
  const seconds = Math.min(7200, Math.max(900, (durationSeconds && durationSeconds > 0 ? durationSeconds : 600) * 1.5 + 600));
  return Math.round(seconds * 1000);
}

// ── Job tokens: proof that a worker may report on (and upload for) exactly one video ──────────────────────────

export interface JobClaims {
  /** photo id */
  p: string;
  /** storage key of the original */
  k: string;
  /** event id */
  e: string;
  /** worker */
  w: RunpodWorker;
  /** dispatch nonce (one per RunPod job) */
  n: string;
  /** expiry, ms since epoch */
  x: number;
}

const b64 = (data: Buffer | string) => Buffer.from(data).toString("base64url");

export function signJobToken(claims: JobClaims, secret: string): string {
  if (!secret) throw new Error("No secret to sign RunPod job tokens");
  const body = b64(JSON.stringify(claims));
  return `${body}.${b64(createHmac("sha256", secret).update(body).digest())}`;
}

export function verifyJobToken(token: unknown, secret: string, now = Date.now()): JobClaims | null {
  if (typeof token !== "string" || !secret) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as JobClaims;
    if (!claims.p || !claims.k || !claims.w || !claims.n || typeof claims.x !== "number" || claims.x < now) return null;
    return claims;
  } catch {
    return null;
  }
}

export function newNonce() {
  return randomBytes(9).toString("base64url");
}

// ── Output files a worker may upload, and the headers each one is stored with (same as the Modal workers) ─────

const OUTPUT_FILE = /^(?:(?:1080p|720p|480p|audio)\/(?:seg_\d{3,6}\.ts|playlist\.m3u8)|master\.m3u8|poster\.jpg)$/;

export function outputFileHeaders(rel: string): { "Content-Type": string; "Cache-Control": string } | null {
  if (!OUTPUT_FILE.test(rel)) return null;
  if (rel === "poster.jpg") return { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400" };
  if (rel === "master.m3u8") return { "Content-Type": "application/x-mpegURL", "Cache-Control": "public, max-age=3600" };
  if (rel.endsWith(".m3u8")) return { "Content-Type": "application/x-mpegURL", "Cache-Control": "public, max-age=31536000, immutable" };
  return { "Content-Type": "video/MP2T", "Cache-Control": "public, max-age=31536000, immutable" };
}

// ── Dispatch and check ───────────────────────────────────────────────────────────────────────────────────────

export interface DispatchState {
  photoId: string;
  storageKey: string;
  eventId: string;
  userId?: string;
  duration?: number;
  fileSize?: number;
  isLongVideo: boolean;
  chain: ChainStep[];
  index: number;
  /** The payload today's Modal webhook takes, used when the chain reaches Modal. */
  modalPayload: Record<string, unknown>;
  jobId?: string;
  endpointId?: string;
  dispatchedAt?: number;
  checks?: number;
  /** Workers tried so far and how each ended, for the logs. */
  history?: string[];
}

export interface RunpodDeps {
  config: RunpodConfig;
  fetch: typeof fetch;
  now(): number;
  log(message: string): void;
  /** Queues /check for this state after the delay (QStash). */
  scheduleCheck(state: DispatchState, delaySeconds: number): Promise<void>;
  /** Queues the video for today's Modal webhook. */
  sendToModal(state: DispatchState): Promise<boolean>;
  signSource(storageKey: string, expiresInSeconds: number): Promise<string>;
  signToken(claims: JobClaims): string;
  callbackUrl: string;
}

const FIRST_CHECK_S = 30;
const RUNNING_CHECK_S = 60;
const MAX_CHECKS = 600;

async function runpod(deps: RunpodDeps, method: "GET" | "POST", path: string, body?: unknown) {
  const response = await deps.fetch(`${deps.config.apiBase}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${deps.config.apiKey}`,
      "Content-Type": "application/json",
      // RunPod's API refuses some default library user agents (Cloudflare 1010)
      "User-Agent": "evebash-backend/1.0",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json, text };
}

/** Starts the video on the worker at state.index (skipping workers without an endpoint), or hands it to Modal. */
export async function dispatchStep(state: DispatchState, deps: RunpodDeps): Promise<{ action: string; worker?: ChainStep; jobId?: string }> {
  const history = [...(state.history || [])];
  for (let index = state.index; index < state.chain.length; index++) {
    const step = state.chain[index];
    if (step === "modal") {
      const sent = await deps.sendToModal({ ...state, index, history });
      deps.log(`[RunPodVideo] ${state.photoId}: handed to Modal (${history.join("; ") || "no RunPod worker"})`);
      if (!sent) throw new Error("Could not queue the video for Modal"); // QStash retries this delivery
      return { action: "modal", worker: step };
    }
    const endpointId = deps.config.endpoints[step];
    if (!endpointId) continue;

    const now = deps.now();
    const timeoutMs = executionTimeoutMs(state.duration);
    const ttlMs = timeoutMs + deps.config.queueWaitMs + 2 * 3600 * 1000;
    const token = deps.signToken({ p: state.photoId, k: state.storageKey, e: state.eventId, w: step, n: newNonce(), x: now + ttlMs + 3600 * 1000 });
    const sourceUrl = await deps.signSource(state.storageKey, Math.ceil((ttlMs + 3600 * 1000) / 1000));
    const result = await runpod(deps, "POST", `${endpointId}/run`, {
      input: {
        photo_id: state.photoId,
        storage_key: state.storageKey,
        event_id: state.eventId,
        source_url: sourceUrl,
        callback_url: deps.callbackUrl,
        job_token: token,
        hardware: WORKER_HARDWARE[step],
        worker: step,
        duration: state.duration || null,
      },
      policy: { executionTimeout: timeoutMs, ttl: ttlMs },
    });
    if (!result.ok || !result.json?.id) {
      history.push(`${step}: could not start (${result.status} ${String(result.text).slice(0, 120)})`);
      deps.log(`[RunPodVideo] ${state.photoId}: ${history[history.length - 1]}`);
      continue;
    }
    const next: DispatchState = { ...state, index, jobId: result.json.id, endpointId, dispatchedAt: now, checks: 0, history };
    await deps.scheduleCheck(next, FIRST_CHECK_S);
    deps.log(`[RunPodVideo] ${state.photoId}: started on ${step} (job ${result.json.id})`);
    return { action: "dispatched", worker: step, jobId: result.json.id };
  }
  throw new Error(`No worker left for ${state.photoId}`); // unreachable: the chain ends with Modal
}

function moveOn(state: DispatchState, deps: RunpodDeps, why: string) {
  const step = state.chain[state.index];
  deps.log(`[RunPodVideo] ${state.photoId}: ${step} ${why}; trying the next worker`);
  return dispatchStep(
    { ...state, index: state.index + 1, jobId: undefined, endpointId: undefined, dispatchedAt: undefined, checks: 0, history: [...(state.history || []), `${step}: ${why}`] },
    deps,
  );
}

/** One check of a running RunPod job (see the comment at the top). */
export async function checkStep(state: DispatchState, deps: RunpodDeps): Promise<{ action: string; status?: string }> {
  if (!state.jobId || !state.endpointId || !state.dispatchedAt) return dispatchStep(state, deps);
  const now = deps.now();
  const checks = (state.checks || 0) + 1;
  const status = await runpod(deps, "GET", `${state.endpointId}/status/${state.jobId}`);
  if (status.status === 404) return moveOn(state, deps, "job is gone");
  if (!status.ok) throw new Error(`RunPod status ${status.status}: ${String(status.text).slice(0, 200)}`); // QStash retries

  const value = String(status.json?.status || "");
  const age = now - state.dispatchedAt;
  const again = (delay: number) => deps.scheduleCheck({ ...state, checks }, delay).then(() => ({ action: "wait", status: value }));

  if (value === "COMPLETED") {
    deps.log(`[RunPodVideo] ${state.photoId}: ${state.chain[state.index]} finished (${JSON.stringify(status.json?.output || {}).slice(0, 200)})`);
    return { action: "done", status: value };
  }
  if (value === "FAILED" || value === "TIMED_OUT" || value === "CANCELLED") {
    return moveOn(state, deps, `${value.toLowerCase()}${status.json?.error ? ` (${String(status.json.error).slice(0, 200)})` : ""}`);
  }
  if (value === "IN_QUEUE" && age > deps.config.queueWaitMs) {
    const cancel = await runpod(deps, "POST", `${state.endpointId}/cancel/${state.jobId}`);
    const after = cancel.json?.status || (await runpod(deps, "GET", `${state.endpointId}/status/${state.jobId}`)).json?.status;
    if (after === "CANCELLED") return moveOn(state, deps, `no worker within ${Math.round(deps.config.queueWaitMs / 1000)} s`);
    return again(RUNNING_CHECK_S); // it started just now (or the cancel didn't land): keep watching it
  }
  if (value === "IN_PROGRESS" && age > executionTimeoutMs(state.duration) + 15 * 60 * 1000) {
    await runpod(deps, "POST", `${state.endpointId}/cancel/${state.jobId}`);
    return moveOn(state, deps, "ran past its time limit");
  }
  if (checks > MAX_CHECKS) return moveOn(state, deps, "checked too many times");
  return again(value === "IN_QUEUE" ? FIRST_CHECK_S : RUNNING_CHECK_S);
}

// ── Workers converting a video right now (one backend process; best effort against duplicate RunPod jobs) ────

const active = new Map<string, { nonce: string; at: number }>();
const ACTIVE_FOR_MS = 3 * 3600 * 1000;

/** Claims the video for this RunPod job. False when another job of this backend is converting it. */
export function claimActive(photoId: string, nonce: string, now = Date.now()) {
  const current = active.get(photoId);
  if (current && current.nonce !== nonce && now - current.at < ACTIVE_FOR_MS) return false;
  active.set(photoId, { nonce, at: now });
  return true;
}

export function releaseActive(photoId: string, nonce: string) {
  if (active.get(photoId)?.nonce === nonce) active.delete(photoId);
}

export function resetActiveForTests() {
  active.clear();
}
