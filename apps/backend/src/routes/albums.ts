import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { User } from "@supabase/supabase-js";
import { verifySupabaseUser } from "../auth.js";
import { ALBUM_VOICE_TYPES, albumConfig, isAlbumProofingEnabled } from "../albums/config.js";
import { AlbumError, toAlbumError } from "../albums/errors.js";
import { drainRequest, flushDeletedAlbumFiles, receiveUpload, type AlbumFiles } from "../albums/files.js";
import { createLimiter, layoutFor, makeAlbumPageImages } from "../albums/images.js";
import { isAlbumId, type AlbumRepository, type AlbumRow, type CommentKind, type CommentRow, type PageImage, type PageLayout } from "../albums/repository.js";
import { openRequests, pageStatus, presentAlbum, presentAlbumSummary, referencedIds, roleOf, sentVersionOf, type AlbumData } from "../albums/view.js";
import { checkEventUpload, isEventUploadLimitEnabled, type EventUploadDecision } from "../services/eventUploadLimits.js";
import { canPostEventVideo } from "../services/eventVideoPermission.js";
import { getSupabaseAdminClient } from "../supabase.js";
import { sendExpoPush, type ExpoPush } from "./notifications.js";

export type AlbumRouterDeps = {
  repo: AlbumRepository;
  files: AlbumFiles;
  verifyUser?: (request: Request) => Promise<{ user: User } | null>;
  /** Owner and admins of the gallery (the same people who may post videos). */
  canManage?: (user: User, eventId: string) => Promise<boolean>;
  /** The gallery owner's plan storage (EVENT_UPLOAD_LIMITS), checked before anything is stored. */
  checkUpload?: (eventId: string, uploaderId: string) => Promise<EventUploadDecision>;
  enabled?: () => boolean;
  sendPush?: (push: ExpoPush) => Promise<void>;
  processImage?: typeof makeAlbumPageImages;
  now?: () => Date;
};

type Context = { request: Request; response: Response; user: User };

const KINDS = new Set<CommentKind>(["replace", "bigger", "smaller", "edit", "remove", "note"]);

function text(value: unknown, max: number, what: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new AlbumError("invalid_input", `Invalid ${what}.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new AlbumError("invalid_input", `The ${what} can be up to ${max} characters.`);
  return trimmed || null;
}

function pin(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new AlbumError("invalid_input", "Invalid pin position.");
  return n;
}

function kind(value: unknown): CommentKind {
  if (value === undefined || value === null) return "note";
  if (typeof value === "string" && KINDS.has(value as CommentKind)) return value as CommentKind;
  throw new AlbumError("invalid_input", "Unknown request type.");
}

function fileNameOf(value: unknown) {
  const name = typeof value === "string" ? value.split(/[\\/]/).pop()!.trim().slice(0, 200) : "";
  return name || null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function createAlbumRouter(deps: AlbumRouterDeps) {
  const repo = deps.repo;
  const files = deps.files;
  const verifyUser = deps.verifyUser ?? verifySupabaseUser;
  const canManage = deps.canManage ?? ((user: User, eventId: string) => canPostEventVideo(getSupabaseAdminClient(), user, eventId));
  const checkUpload = deps.checkUpload ?? (async (eventId: string, uploaderId: string): Promise<EventUploadDecision> =>
    isEventUploadLimitEnabled() ? checkEventUpload({ eventId, uploaderId, bytes: 0, isVideo: false }) : { allowed: true });
  const enabled = deps.enabled ?? isAlbumProofingEnabled;
  const sendPush = deps.sendPush ?? sendExpoPush;
  const processImage = deps.processImage ?? makeAlbumPageImages;
  const now = deps.now ?? (() => new Date());
  const processing = createLimiter(albumConfig.processingConcurrency);
  const router = Router();

  const route = (handler: (context: Context) => Promise<unknown>) => async (request: Request, response: Response, _next: NextFunction) => {
    try {
      if (!enabled()) throw new AlbumError("disabled", "Album proofing isn't available yet.");
      const verified = await verifyUser(request);
      if (!verified) throw new AlbumError("unauthenticated", "Please sign in to use album proofing.");
      await handler({ request, response, user: verified.user });
    } catch (error) {
      const albumError = toAlbumError(error);
      // A refused upload: read the rest of the file so the browser gets this answer instead of a dropped connection
      await drainRequest(request);
      if (albumError) {
        response.status(albumError.status).json({ success: false, code: albumError.code, error: albumError.message });
        return;
      }
      request.log?.error({ err: error }, "Album request failed");
      response.status(500).json({ success: false, code: "server_error", error: "Something went wrong. Please try again." });
    }
  };

  const flush = () => {
    flushDeletedAlbumFiles(repo, files).catch((error) => console.error("[Albums] Deleting files failed:", error));
  };

  async function requireManager(user: User, eventId: string) {
    if (!(await canManage(user, eventId))) {
      throw new AlbumError("forbidden", "Only the event owner and event admins can use album proofing.");
    }
  }

  async function rootOf(eventId: unknown) {
    if (typeof eventId !== "string" || !eventId.trim()) throw new AlbumError("invalid_input", "Missing event.");
    const root = await repo.rootEventId(eventId.trim());
    if (!root) throw new AlbumError("not_found", "That event no longer exists.");
    return root;
  }

  async function albumFor(user: User, albumId: unknown) {
    const album = isAlbumId(albumId) ? await repo.getAlbum(albumId) : null;
    if (!album) throw new AlbumError("not_found", "That album no longer exists.");
    await requireManager(user, album.eventId);
    return album;
  }

  async function dataOf(album: AlbumRow): Promise<AlbumData> {
    const pages = await repo.listPages([album.id]);
    const ids = pages.map((p) => p.id);
    const [versions, comments] = await Promise.all([repo.listVersions(ids), repo.listComments(ids)]);
    return { album, pages, versions, comments };
  }

  async function presentFull(album: AlbumRow, viewerId: string) {
    const data = await dataOf(album);
    const rounds = await repo.listRounds(album.id);
    const refs = referencedIds(data, rounds);
    const [names, photos] = await Promise.all([repo.profileNames(refs.profiles), repo.getPhotos(refs.photos)]);
    return presentAlbum(data, rounds, { url: files.url, names, photos: new Map(photos.map((p) => [p.id, p])) }, viewerId);
  }

  async function pageOf(album: AlbumRow, pageId: unknown) {
    const page = isAlbumId(pageId) ? (await repo.listPages([album.id])).find((p) => p.id === pageId) : undefined;
    if (!page) throw new AlbumError("not_found", "That page no longer exists.");
    return page;
  }

  async function commentOf(album: AlbumRow, commentId: unknown) {
    const comment = isAlbumId(commentId) ? await repo.getComment(commentId) : null;
    if (!comment || !(await repo.listPages([album.id])).some((p) => p.id === comment.pageId)) {
      throw new AlbumError("not_found", "That comment no longer exists.");
    }
    return comment;
  }

  function assertOpen(album: AlbumRow) {
    if (album.approvedAt) throw new AlbumError("album_approved", "This album is approved. Reopen it to make changes.");
  }

  /** Photographer-only and client-only actions; the host and other admins can only view unless given a role. */
  function requireRole(album: AlbumRow, user: User, roles: ("photographer" | "client")[], action: string) {
    if (!album.photographerId || !album.clientIds.length) {
      throw new AlbumError("not_ready", "Assign the photographer and the client first (⋯ > Change roles).");
    }
    const role = roleOf(album, user.id);
    if (role === "viewer" || !roles.includes(role)) {
      const who = roles.length === 2 ? "the album's photographer and client" : roles[0] === "photographer" ? "the album's photographer" : "the client";
      throw new AlbumError("forbidden", `Only ${who} can ${action}.`);
    }
  }

  /** One photographer and at least one client, all from the event's host and approved guest admins. */
  async function checkRoles(eventId: string, photographerId: unknown, clientIds: unknown) {
    if (typeof photographerId !== "string" || !photographerId) throw new AlbumError("invalid_input", "Choose the photographer.");
    if (!Array.isArray(clientIds) || !clientIds.length || !clientIds.every((id) => typeof id === "string" && id)) {
      throw new AlbumError("invalid_input", "Choose at least one client.");
    }
    const clients = [...new Set(clientIds as string[])];
    if (clients.includes(photographerId)) throw new AlbumError("invalid_input", "The photographer can't also be a client.");
    if (clients.length > 10) throw new AlbumError("invalid_input", "Choose up to 10 clients.");
    const allowed = new Set((await repo.roleCandidates(eventId)).map((c) => c.id));
    if (![photographerId, ...clients].every((id) => allowed.has(id))) {
      throw new AlbumError("invalid_input", "Roles can only go to the event host or guests with Admin Access.");
    }
    return { photographerId, clientIds: clients };
  }

  async function assertStorage(eventId: string, userId: string) {
    const decision = await checkUpload(eventId, userId);
    if (!decision.allowed) throw new AlbumError(decision.code, decision.error);
  }

  async function notify(profileIds: string[], push: Omit<ExpoPush, "token">) {
    try {
      for (const { token } of await repo.pushTokens([...new Set(profileIds)])) {
        await sendPush({ ...push, token }).catch((error) => console.warn("[Albums] Push failed:", error));
      }
    } catch (error) {
      console.warn("[Albums] Push lookup failed:", error);
    }
  }

  /** Receives a page design, stores its preview and thumbnail, and hands them to `save`. The original is deleted. */
  async function storePageImage(request: Request, album: AlbumRow, save: (image: PageImage, layout: PageLayout) => Promise<unknown>) {
    const upload = await receiveUpload(request, albumConfig.maxPageBytes,
      `Pages can be up to ${albumConfig.maxPageBytes / (1024 * 1024)} MB. Export the page as a JPEG and try again.`);
    try {
      const images = await processing(() => processImage(upload.path));
      const base = `albums/${album.eventId}/${album.id}/${randomUUID()}`;
      const image: PageImage = {
        fileName: fileNameOf(request.query.fileName),
        previewKey: `${base}-preview.webp`,
        thumbnailKey: `${base}-thumbnail.webp`,
        width: images.width,
        height: images.height,
        bytes: images.preview.length + images.thumbnail.length,
      };
      await files.put(image.previewKey, images.preview, "image/webp");
      await files.put(image.thumbnailKey, images.thumbnail, "image/webp");
      try {
        await save(image, layoutFor(images.width, images.height));
      } catch (error) {
        await Promise.all([files.delete(image.previewKey), files.delete(image.thumbnailKey)].map((p) => p.catch(() => false)));
        throw error;
      }
      return image;
    } finally {
      await rm(upload.path, { force: true });
    }
  }

  router.get("/enabled", (_request, response) => {
    response.json({ success: true, enabled: enabled() });
  });

  // ── Albums ─────────────────────────────────────────────────────────────────
  // Who can be the photographer or the client: the host and approved guest admins
  router.get("/candidates", route(async ({ request, response, user }) => {
    const eventId = await rootOf(request.query.eventId);
    await requireManager(user, eventId);
    response.json({ success: true, candidates: await repo.roleCandidates(eventId) });
  }));

  router.get("/", route(async ({ request, response, user }) => {
    const eventId = await rootOf(request.query.eventId);
    await requireManager(user, eventId);
    const albums = await repo.listAlbums(eventId);
    const pages = await repo.listPages(albums.map((a) => a.id));
    const ids = pages.map((p) => p.id);
    const [versions, comments] = await Promise.all([repo.listVersions(ids), repo.listComments(ids)]);
    const names = await repo.profileNames(albums.map((a) => a.approvedBy).filter((id): id is string => Boolean(id)));
    const pageIdsOf = (albumId: string) => new Set(pages.filter((p) => p.albumId === albumId).map((p) => p.id));
    response.json({
      success: true,
      albums: albums.map((album) => {
        const own = pageIdsOf(album.id);
        return presentAlbumSummary({
          album,
          pages: pages.filter((p) => p.albumId === album.id),
          versions: versions.filter((v) => own.has(v.pageId)),
          comments: comments.filter((c) => own.has(c.pageId)),
        }, { url: files.url, names }, user.id);
      }),
    });
  }));

  router.post("/", route(async ({ request, response, user }) => {
    const eventId = await rootOf(request.body?.eventId);
    await requireManager(user, eventId);
    const title = text(request.body?.title, albumConfig.maxTitleLength, "album name");
    if (!title) throw new AlbumError("invalid_input", "Give the album a name.");
    if ((await repo.listAlbums(eventId)).length >= albumConfig.maxAlbumsPerEvent) {
      throw new AlbumError("limit_reached", `An event can have up to ${albumConfig.maxAlbumsPerEvent} albums.`);
    }
    const roles = await checkRoles(eventId, request.body?.photographerId, request.body?.clientIds);
    const album = await repo.createAlbum({ eventId, title, createdBy: user.id, ...roles });
    response.status(201).json({ success: true, album: await presentFull(album, user.id) });
  }));

  router.get("/:albumId", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    response.json({ success: true, album: await presentFull(album, user.id) });
  }));

  router.patch("/:albumId", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    const title = text(request.body?.title, albumConfig.maxTitleLength, "album name");
    if (!title) throw new AlbumError("invalid_input", "Give the album a name.");
    await repo.updateAlbum(album.id, { title });
    response.json({ success: true, album: await presentFull({ ...album, title }, user.id) });
  }));

  router.put("/:albumId/roles", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    const roles = await checkRoles(album.eventId, request.body?.photographerId, request.body?.clientIds);
    await repo.updateAlbum(album.id, roles);
    response.json({ success: true, album: await presentFull({ ...album, ...roles }, user.id) });
  }));

  router.delete("/:albumId", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    await repo.deleteAlbum(album.id);
    flush();
    response.json({ success: true });
  }));

  router.get("/:albumId/favourites", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    response.json({ success: true, photos: await repo.listFavourites(album.eventId) });
  }));

  // ── Pages (raw image in the request body) ─────────────────────────────────
  router.post("/:albumId/pages", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    requireRole(album, user, ["photographer"], "upload pages");
    assertOpen(album);
    if ((await repo.listPages([album.id])).length >= albumConfig.maxPagesPerAlbum) {
      throw new AlbumError("limit_reached", "This album already has the most pages it can hold.");
    }
    await assertStorage(album.eventId, user.id);
    const requested = request.query.layout === "spread" || request.query.layout === "single" ? request.query.layout : null;
    let pageId = "";
    let layout: PageLayout = "spread";
    const image = await storePageImage(request, album, async (stored, detected) => {
      layout = requested ?? detected;
      pageId = await repo.addPage(album.id, layout, stored, user.id, albumConfig.maxPagesPerAlbum);
    });
    response.status(201).json({ success: true, page: { id: pageId, layout, thumbnailUrl: files.url(image.thumbnailKey), width: image.width, height: image.height } });
  }));

  router.post("/:albumId/pages/:pageId/versions", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    requireRole(album, user, ["photographer"], "upload new versions");
    assertOpen(album);
    const page = await pageOf(album, request.params.pageId);
    await assertStorage(album.eventId, user.id);
    let version = 0;
    const image = await storePageImage(request, album, async (stored) => {
      version = await repo.addVersion(page.id, stored, user.id);
    });
    flush();
    response.status(201).json({ success: true, version: { pageId: page.id, version, thumbnailUrl: files.url(image.thumbnailKey) } });
  }));

  router.patch("/:albumId/pages/:pageId", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    requireRole(album, user, ["photographer"], "change page layouts");
    const page = await pageOf(album, request.params.pageId);
    const layout = request.body?.layout;
    if (layout !== "spread" && layout !== "single") throw new AlbumError("invalid_input", "Choose spread or single page.");
    await repo.updatePage(page.id, { layout });
    response.json({ success: true, album: await presentFull(album, user.id) });
  }));

  router.delete("/:albumId/pages/:pageId", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    requireRole(album, user, ["photographer"], "delete pages");
    assertOpen(album);
    const page = await pageOf(album, request.params.pageId);
    await repo.deletePage(page.id);
    flush();
    response.json({ success: true, album: await presentFull(album, user.id) });
  }));

  router.put("/:albumId/order", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    requireRole(album, user, ["photographer"], "reorder pages");
    const pageIds = request.body?.pageIds;
    if (!Array.isArray(pageIds) || !pageIds.every(isAlbumId)) throw new AlbumError("invalid_input", "Invalid page order.");
    await repo.reorder(album.id, pageIds);
    response.json({ success: true, album: await presentFull(album, user.id) });
  }));

  // ── Review rounds ──────────────────────────────────────────────────────────
  router.post("/:albumId/send", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    requireRole(album, user, ["photographer"], "send pages for review");
    const sent = await repo.sendRound(album.id, user.id);
    await notify(album.clientIds.filter((id) => id !== user.id), {
      title: sent.round === 1 ? "Album ready for review" : `Album round ${sent.round} ready`,
      body: sent.round === 1 || sent.updatedPages === 0
        ? `${album.title}: ${plural(sent.pages, "page")} to review`
        : `${album.title}: ${plural(sent.updatedPages, "updated page")} to review`,
      data: { type: "album_proof", eventId: album.eventId, albumId: album.id },
    });
    const latest = (await repo.getAlbum(album.id)) ?? album;
    response.json({ success: true, round: sent, album: await presentFull(latest, user.id) });
  }));

  router.post("/:albumId/feedback", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    requireRole(album, user, ["client"], "send feedback");
    const data = await dataOf(album);
    // A plain note with nothing in it (left behind when a voice note failed to upload) isn't worth sending
    for (const c of data.comments) {
      if (!c.sentAt && c.authorId === user.id && c.kind === "note" && !c.body && !c.voiceKey && !c.replacementPhotoId) {
        await repo.deleteComment(c.id);
      }
    }
    const sentCount = await repo.sendDrafts(data.pages.map((p) => p.id), user.id, now().toISOString());
    const after = await dataOf(album);
    const statuses = after.pages.map((p) => pageStatus(p, after.versions.filter((v) => v.pageId === p.id), after.comments.filter((c) => c.pageId === p.id)));
    const changes = statuses.filter((s) => s === "changes_requested").length;
    const approved = statuses.filter((s) => s === "approved").length;
    const designer = album.photographerId;
    if (designer && designer !== user.id) {
      const name = (await repo.profileNames([user.id])).get(user.id) ?? "The client";
      await notify([designer], {
        title: `Feedback on ${album.title}`,
        body: changes
          ? `${name}: ${plural(changes, "page")} need${changes === 1 ? "s" : ""} changes, ${approved} approved`
          : `${name} approved ${plural(approved, "page")}`,
        data: { type: "album_proof", eventId: album.eventId, albumId: album.id },
      });
    }
    response.json({ success: true, sent: sentCount, album: await presentFull(album, user.id) });
  }));

  router.post("/:albumId/pages/:pageId/approval", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    requireRole(album, user, ["client"], "approve pages");
    assertOpen(album);
    const page = await pageOf(album, request.params.pageId);
    const [versions, comments] = await Promise.all([repo.listVersions([page.id]), repo.listComments([page.id])]);
    const sent = sentVersionOf(versions);
    if (sent === null) throw new AlbumError("not_ready", "This page hasn't been sent for review yet.");
    if (request.body?.approved === false) {
      await repo.updatePage(page.id, { approvedVersion: null, approvedBy: null, approvedAt: null });
    } else {
      const at = now().toISOString();
      await repo.updatePage(page.id, { approvedVersion: sent, approvedBy: user.id, approvedAt: at });
      // Approving the page settles what was asked of it
      for (const c of openRequests(comments)) await repo.updateComment(c.id, { status: "done", resolvedBy: user.id, resolvedAt: at });
    }
    response.json({ success: true, album: await presentFull(album, user.id) });
  }));

  router.post("/:albumId/approve", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    requireRole(album, user, ["client"], "approve the album");
    assertOpen(album);
    const data = await dataOf(album);
    const ready = data.pages.length > 0
      && !data.versions.some((v) => v.round === 0)
      && data.pages.every((p) => pageStatus(p, data.versions.filter((v) => v.pageId === p.id), data.comments.filter((c) => c.pageId === p.id)) === "approved");
    if (!ready) throw new AlbumError("not_ready", "Approve every page first. The album can be approved once nothing is waiting.");
    const at = now().toISOString();
    await repo.updateAlbum(album.id, { approvedBy: user.id, approvedAt: at });
    const others = [album.photographerId, ...album.clientIds].filter((id): id is string => Boolean(id) && id !== user.id);
    await notify(others, {
      title: "Album approved for print",
      body: `${album.title}: all ${plural(data.pages.length, "page")} approved`,
      data: { type: "album_proof", eventId: album.eventId, albumId: album.id },
    });
    response.json({ success: true, album: await presentFull({ ...album, approvedBy: user.id, approvedAt: at }, user.id) });
  }));

  router.post("/:albumId/reopen", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    await repo.updateAlbum(album.id, { approvedBy: null, approvedAt: null });
    response.json({ success: true, album: await presentFull({ ...album, approvedBy: null, approvedAt: null }, user.id) });
  }));

  // ── Comments ───────────────────────────────────────────────────────────────
  async function presentOne(album: AlbumRow, commentId: string, viewerId: string) {
    const full = await presentFull(album, viewerId);
    return full.pages.flatMap((p) => p.comments).find((c) => c.id === commentId) ?? null;
  }

  async function checkReplacement(album: AlbumRow, photoId: unknown) {
    if (photoId === undefined || photoId === null) return null;
    if (typeof photoId !== "string") throw new AlbumError("invalid_input", "Invalid photo.");
    const [photo] = await repo.getPhotos([photoId]);
    if (!photo || (await repo.rootEventId(photo.eventId)) !== album.eventId) {
      throw new AlbumError("invalid_input", "Pick a photo from this event.");
    }
    return photo.id;
  }

  router.post("/:albumId/pages/:pageId/comments", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    assertOpen(album);
    const page = await pageOf(album, request.params.pageId);
    const body = request.body || {};
    const versions = await repo.listVersions([page.id]);
    const requested = Number(body.version);
    const version = versions.some((v) => v.version === requested) ? requested : sentVersionOf(versions) ?? versions.at(-1)?.version ?? 1;
    const isReply = body.parentId !== undefined && body.parentId !== null;
    // Requests come from the client; both sides can reply
    requireRole(album, user, isReply ? ["photographer", "client"] : ["client"], isReply ? "reply" : "comment on pages");
    let parentId: string | null = null;
    if (isReply) {
      const parent = await commentOf(album, body.parentId);
      if (parent.pageId !== page.id || parent.parentId || !parent.sentAt) throw new AlbumError("invalid_input", "You can only reply to a sent comment.");
      parentId = parent.id;
    }
    const comment = await repo.createComment({
      pageId: page.id,
      version,
      parentId,
      authorId: user.id,
      kind: parentId ? "note" : kind(body.kind),
      pinX: parentId ? null : pin(body.pinX),
      pinY: parentId ? null : pin(body.pinY),
      body: text(body.body, albumConfig.maxCommentLength, "comment"),
      replacementPhotoId: parentId ? null : await checkReplacement(album, body.replacementPhotoId),
      // Replies go out at once; requests wait for "Send feedback" so the photographer gets them together
      sentAt: parentId ? now().toISOString() : null,
    });
    response.status(201).json({ success: true, comment: await presentOne(album, comment.id, user.id) });
  }));

  function ownComment(comment: CommentRow, user: User) {
    if (comment.authorId !== user.id) throw new AlbumError("forbidden", "Only the person who wrote this comment can change it.");
  }

  router.patch("/:albumId/comments/:commentId", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    const comment = await commentOf(album, request.params.commentId);
    const body = request.body || {};
    if (body.status !== undefined) {
      // The photographer or the client marks a sent request done (or open again)
      requireRole(album, user, ["photographer", "client"], "mark requests done");
      if (body.status !== "open" && body.status !== "done") throw new AlbumError("invalid_input", "Invalid status.");
      if (!comment.sentAt || comment.parentId) throw new AlbumError("invalid_input", "Only sent requests can be marked done.");
      const done = body.status === "done";
      await repo.updateComment(comment.id, { status: body.status, resolvedBy: done ? user.id : null, resolvedAt: done ? now().toISOString() : null });
    } else {
      ownComment(comment, user);
      if (comment.sentAt) throw new AlbumError("invalid_input", "Sent comments can't be changed. Add a reply instead.");
      assertOpen(album);
      await repo.updateComment(comment.id, {
        kind: body.kind !== undefined ? kind(body.kind) : undefined,
        pinX: body.pinX !== undefined ? pin(body.pinX) : undefined,
        pinY: body.pinY !== undefined ? pin(body.pinY) : undefined,
        body: body.body !== undefined ? text(body.body, albumConfig.maxCommentLength, "comment") : undefined,
        replacementPhotoId: body.replacementPhotoId !== undefined ? await checkReplacement(album, body.replacementPhotoId) : undefined,
      });
    }
    response.json({ success: true, comment: await presentOne(album, comment.id, user.id) });
  }));

  router.delete("/:albumId/comments/:commentId", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    const comment = await commentOf(album, request.params.commentId);
    ownComment(comment, user);
    await repo.deleteComment(comment.id);
    flush();
    response.json({ success: true });
  }));

  // Voice note: raw audio in the request body, its length in seconds in ?seconds=
  router.put("/:albumId/comments/:commentId/voice", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    const comment = await commentOf(album, request.params.commentId);
    ownComment(comment, user);
    if (comment.sentAt && !comment.parentId) throw new AlbumError("invalid_input", "Sent comments can't be changed. Add a reply instead.");
    const contentType = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    const extension = ALBUM_VOICE_TYPES[contentType];
    if (!extension) throw new AlbumError("unsupported_file", "That recording format isn't supported.");
    const seconds = Number(request.query.seconds);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > albumConfig.maxVoiceSeconds + 5) {
      throw new AlbumError("invalid_input", `Voice notes can be up to ${albumConfig.maxVoiceSeconds / 60} minutes.`);
    }
    await assertStorage(album.eventId, user.id);
    const upload = await receiveUpload(request, albumConfig.maxVoiceBytes, "That voice note is too large.");
    try {
      const key = `albums/${album.eventId}/${album.id}/voice/${randomUUID()}.${extension}`;
      await files.put(key, await readFile(upload.path), contentType);
      await repo.updateComment(comment.id, { voiceKey: key, voiceSeconds: Math.round(seconds * 10) / 10, voiceBytes: upload.bytes });
    } finally {
      await rm(upload.path, { force: true });
    }
    flush();
    response.json({ success: true, comment: await presentOne(album, comment.id, user.id) });
  }));

  router.delete("/:albumId/comments/:commentId/voice", route(async ({ request, response, user }) => {
    const album = await albumFor(user, request.params.albumId);
    const comment = await commentOf(album, request.params.commentId);
    ownComment(comment, user);
    if (comment.sentAt && !comment.parentId) throw new AlbumError("invalid_input", "Sent comments can't be changed. Add a reply instead.");
    await repo.updateComment(comment.id, { voiceKey: null, voiceSeconds: null, voiceBytes: 0 });
    flush();
    response.json({ success: true, comment: await presentOne(album, comment.id, user.id) });
  }));

  return router;
}

/** Hourly sweep for files the database queued for deletion (for example from a deleted event). */
export function startAlbumFileCleanup(repo: AlbumRepository, files: AlbumFiles): () => void {
  const run = (context: string) => flushDeletedAlbumFiles(repo, files)
    .then((deleted) => { if (deleted) console.log(`[Albums] ${context} cleanup deleted ${deleted} files`); })
    .catch((error) => console.error(`[Albums] ${context} cleanup failed:`, error));
  const interval = setInterval(() => void run("Scheduled"), 60 * 60 * 1000);
  const startup = setTimeout(() => void run("Startup"), 90 * 1000);
  return () => {
    clearInterval(interval);
    clearTimeout(startup);
  };
}
