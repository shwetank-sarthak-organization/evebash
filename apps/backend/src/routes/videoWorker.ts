import { Router, type NextFunction, type Request, type Response } from "express";
import { getInternalJobSecret, verifyInternalJob } from "../auth.js";
import { getSupabaseAdminClient } from "../supabase.js";
import { getBackendBaseUrl, scheduleRunpodCheck, sendVideoToModal } from "../qstash.js";
import { getEventBucket, type EventBucket } from "../services/eventBucketS3.js";
import { notifyVideoProcessed } from "../services/videoProcessedNotify.js";
import {
  checkStep,
  claimActive,
  dispatchStep,
  outputFileHeaders,
  releaseActive,
  runpodVideoConfig,
  signJobToken,
  verifyJobToken,
  WORKER_USD_PER_SECOND,
  type DispatchState,
  type JobClaims,
  type RunpodDeps,
} from "../services/runpodVideo.js";
import { getMediaDomain } from "./media.js";

/**
 * Todo #18: the RunPod video path (see services/runpodVideo.ts). Mounted at /api/v1/video-worker.
 *   /dispatch, /check                  QStash only (the internal job secret, forwarded by QStash)
 *   /start, /upload-urls, /complete    the RunPod worker, with the job token the backend gave that one job
 * Nothing here runs unless VIDEO_RUNPOD sends a video this way.
 */
export const videoWorkerRouter = Router();

const UPLOAD_LINK_SECONDS = 4 * 3600;
const INR_PER_USD = () => Number(process.env.RUNPOD_INR_PER_USD || 88);

function asyncRoute(handler: (request: Request, response: Response) => Promise<unknown>) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}

async function requireBucket(): Promise<EventBucket> {
  const bucket = await getEventBucket();
  if (!bucket) throw new Error("Event bucket S3 access is not configured (B2_BUCKET_NAME, B2_KEY_ID, B2_APPLICATION_KEY)");
  return bucket;
}

export function makeRunpodDeps(): RunpodDeps {
  return {
    config: runpodVideoConfig(),
    fetch,
    now: () => Date.now(),
    log: (message) => console.log(message),
    scheduleCheck: (state, delaySeconds) => scheduleRunpodCheck(state, delaySeconds),
    sendToModal: (state) => sendVideoToModal(state.modalPayload, state.isLongVideo, `fallback-${Date.now()}`),
    signSource: async (key, seconds) => (await requireBucket()).signDownload(key, Math.min(seconds, 7 * 24 * 3600)),
    signToken: (claims) => signJobToken(claims, getInternalJobSecret()),
    callbackUrl: `${getBackendBaseUrl()}/api/v1/video-worker`,
  };
}

function readState(body: unknown): DispatchState | null {
  const state = body as DispatchState;
  if (!state || typeof state !== "object" || !state.photoId || !state.storageKey || !Array.isArray(state.chain)) return null;
  if (typeof state.index !== "number" || state.index < 0 || state.index >= state.chain.length) return null;
  return state;
}

videoWorkerRouter.post("/dispatch", asyncRoute(async (request, response) => {
  if (!verifyInternalJob(request)) return response.status(401).json({ error: "Unauthorized" });
  const state = readState(request.body);
  if (!state) return response.status(400).json({ error: "Bad dispatch state" });
  response.json(await dispatchStep(state, makeRunpodDeps()));
}));

videoWorkerRouter.post("/check", asyncRoute(async (request, response) => {
  if (!verifyInternalJob(request)) return response.status(401).json({ error: "Unauthorized" });
  const state = readState(request.body);
  if (!state) return response.status(400).json({ error: "Bad check state" });
  response.json(await checkStep(state, makeRunpodDeps()));
}));

function jobClaims(request: Request): JobClaims | null {
  return verifyJobToken(request.body?.job_token, getInternalJobSecret());
}

function masterSuffix(storageKey: string) {
  return `/hls/${storageKey}/master.m3u8`;
}

/** The worker asks before downloading: skip videos that are deleted, already playable, or being converted. */
videoWorkerRouter.post("/start", asyncRoute(async (request, response) => {
  const claims = jobClaims(request);
  if (!claims) return response.status(401).json({ error: "Invalid job token" });
  const { data: row, error } = await getSupabaseAdminClient().from("photos").select("id, status, url").eq("id", claims.p).maybeSingle();
  if (error) throw error;
  if (!row) return response.json({ proceed: false, reason: "the video was deleted" });
  if (row.status === "processed" && String(row.url || "").endsWith(masterSuffix(claims.k))) {
    return response.json({ proceed: false, reason: "already processed" });
  }
  if (!claimActive(claims.p, claims.n)) return response.json({ proceed: false, reason: "another worker is converting it" });
  console.log(`[RunPodVideo] ${claims.p}: ${claims.w} started converting`);
  response.json({ proceed: true });
}));

/** Upload links for this job's own output files only (hls/<storage_key>/...), each with the headers to send. */
videoWorkerRouter.post("/upload-urls", asyncRoute(async (request, response) => {
  const claims = jobClaims(request);
  if (!claims) return response.status(401).json({ error: "Invalid job token" });
  const keys = request.body?.keys;
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 1000) return response.status(400).json({ error: "Send 1-1000 keys" });
  const bucket = await requireBucket();
  const links: Record<string, { url: string; headers: Record<string, string> }> = {};
  for (const rel of keys) {
    const headers = typeof rel === "string" ? outputFileHeaders(rel) : null;
    if (!headers) return response.status(400).json({ error: `Not an output file: ${String(rel).slice(0, 80)}` });
    links[rel] = {
      url: await bucket.signUpload(`hls/${claims.k}/${rel}`, headers["Content-Type"], headers["Cache-Control"], UPLOAD_LINK_SECONDS),
      headers,
    };
  }
  response.json({ links });
}));

/**
 * The worker uploaded every file (master.m3u8 last). Same steps as the end of Modal's _transcode_video_core: drop
 * files and old versions the final streams don't use, measure the streaming copy, mark the row processed (poster
 * as thumbnail unless the owner chose one), remove the copy again if the video was deleted meanwhile, send the
 * "new video" push, log the cost.
 */
videoWorkerRouter.post("/complete", asyncRoute(async (request, response) => {
  const claims = jobClaims(request);
  if (!claims) return response.status(401).json({ error: "Invalid job token" });
  const body = request.body || {};
  const files: string[] = Array.isArray(body.files) ? body.files.filter((f: unknown) => typeof f === "string" && outputFileHeaders(f)) : [];
  if (!files.includes("master.m3u8")) return response.status(400).json({ error: "master.m3u8 missing from the files" });

  const prefix = `hls/${claims.k}/`;
  const bucket = await requireBucket();
  const keep = new Set(files.map((f) => prefix + f));
  try {
    const versions = await bucket.listVersions(prefix);
    const extra = versions.filter((v) => !keep.has(v.key) || !v.isLatest);
    if (extra.length) console.log(`[RunPodVideo] ${claims.p}: removed ${await bucket.deleteVersions(extra)} unused file versions`);
  } catch (err) {
    console.warn(`[RunPodVideo] ${claims.p}: could not tidy ${prefix}:`, err);
  }
  const overheadSize = (await bucket.list(prefix)).reduce((sum, item) => sum + item.size, 0);

  const mediaDomain = getMediaDomain();
  const masterUrl = `https://${mediaDomain}/${prefix}master.m3u8`;
  const supabase = getSupabaseAdminClient();
  if (files.includes("poster.jpg")) {
    await supabase.from("photos").update({ thumbnail_url: `https://${mediaDomain}/${prefix}poster.jpg` }).eq("id", claims.p).is("thumbnail_url", null);
  }
  const update: Record<string, unknown> = {
    url: masterUrl,
    overhead_size: overheadSize,
    resource_type: "video",
    media_type: "video",
    status: "processed",
    processing_error: null,
  };
  const duration = Number(body.duration);
  if (Number.isFinite(duration) && duration > 0) update.duration = Math.round(duration * 100) / 100;
  const { data: saved, error } = await supabase.from("photos").update(update).eq("id", claims.p).select("id, user_id, event_id");
  if (error) throw error;
  releaseActive(claims.p, claims.n);

  if (!saved || saved.length === 0) {
    // Deleted while it was converting: the delete already ran, so remove what this job uploaded afterwards
    const removed = await bucket.deleteVersions((await bucket.listVersions(prefix)).map((v) => ({ key: v.key, versionId: v.versionId })));
    console.log(`[RunPodVideo] ${claims.p}: video was deleted while converting; removed ${removed} streaming files`);
    return response.json({ success: true, cancelled: true });
  }

  const notify = await notifyVideoProcessed(claims.p).catch((err) => ({ skipped: `notify failed: ${err?.message || err}` }));

  const seconds = Number(body.timings?.total_s) || 0;
  const usd = seconds * (WORKER_USD_PER_SECOND[claims.w] || 0);
  const log = {
    photo_id: claims.p,
    event_id: saved[0].event_id || claims.e,
    user_id: saved[0].user_id || undefined,
    function_name: `process_video_${claims.w}`,
    worker_type: `RunPod ${claims.w.replace("runpod_", "")} (${body.path || body.hardware || "?"})`,
    media_type: "video",
    media_size: Number(body.source_bytes) || null,
    video_duration_seconds: Number.isFinite(duration) ? duration : null,
    cpu_cores: claims.w === "runpod_cpu32" ? 32 : null,
    memory_gb: null,
    gpu_type: body.gpu_name || (claims.w === "runpod_cpu32" ? null : claims.w),
    execution_time_seconds: seconds,
    estimated_cost_inr: Math.round(usd * INR_PER_USD() * 100000) / 100000,
    faces_detected: 0,
  };
  const { error: logError } = await supabase.from("modal_cost_logs").insert(log);
  if (logError) {
    const { media_type, media_size, video_duration_seconds, worker_type, ...core } = log;
    const { error: coreError } = await supabase.from("modal_cost_logs").insert(core);
    if (coreError) console.warn(`[RunPodVideo] ${claims.p}: cost log failed: ${coreError.message}`);
  }

  console.log(`[RunPodVideo] ${claims.p}: processed by ${claims.w} in ${seconds} s (${body.uploaded_while_encoding ?? "?"}/${body.segments ?? "?"} segments uploaded while encoding), ${overheadSize} bytes`);
  response.json({ success: true, url: masterUrl, overheadSize, notify });
}));
