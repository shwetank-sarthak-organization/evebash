import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { verifySupabaseUser } from "../auth.js";
import { getStorageContext, isItemAtRisk, isItemHidden, type StorageContext, type VaultUser } from "../vault/access.js";
import { vaultConfig } from "../vault/config.js";
import { toVaultError, VaultError } from "../vault/errors.js";
import { contentDisposition, eventMediaFilename, extensionOf, mimeTypeForExtension, sanitizeMimeType, sanitizeName } from "../vault/names.js";
import { isVaultId, type VaultItem, type VaultRepository } from "../vault/repository.js";
import type { VaultStorage } from "../vault/storage.js";
import type { EventToVaultCopier } from "../vault/eventCopier.js";
import { deletePendingObjects } from "../services/vaultMaintenance.js";

export type VaultRouterDeps = {
  verifyUser?: (request: Request) => Promise<{ user: { id: string; email?: string | null; phone?: string | null } } | null>;
  repo: VaultRepository;
  /** null when Vault is switched off or its bucket isn't configured. */
  storage: VaultStorage | null;
  /** null when the copy key for "Save to EB Vault" isn't configured. */
  copier?: EventToVaultCopier | null;
  now?: () => Date;
};

type Handler = (context: { request: Request; response: Response; user: VaultUser; repo: VaultRepository; storage: VaultStorage }) => Promise<unknown>;

const HIDDEN_MESSAGE = "This file is hidden because your plan expired. Renew your plan to restore it.";

function optionalFolderId(value: unknown): string | null {
  if (value === null || value === undefined || value === "" || value === "root") return null;
  if (!isVaultId(value)) throw new VaultError("not_found", "That folder no longer exists.");
  return value;
}

function requireId(value: unknown, what = "file"): string {
  if (!isVaultId(value)) throw new VaultError("not_found", `That ${what} no longer exists.`);
  return value;
}

function requireKind(value: unknown): "file" | "folder" {
  if (value === "file" || value === "folder") return value;
  throw new VaultError("invalid_input", "Unknown item type.");
}

function requireSize(value: unknown): number {
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size < 0) throw new VaultError("invalid_input", "Invalid file size.");
  return size;
}

function presentItem(item: VaultItem, context: StorageContext | null) {
  return { ...item, atRisk: context ? isItemAtRisk(context, item.id) : false };
}

/** Lists only what the owner may currently see, and says how many items are hidden. */
function visibleItems(items: VaultItem[], context: StorageContext) {
  const visible = items.filter((item) => !isItemHidden(context, item.id));
  return { items: visible.map((item) => presentItem(item, context)), hiddenCount: items.length - visible.length };
}

function assertCanAddStorage(context: StorageContext, sizeBytes: number) {
  if (context.uploadsBlocked === "plan_expired") {
    throw new VaultError("plan_expired", "Uploads are paused because your plan has expired. Renew your plan to upload again.");
  }
  if (sizeBytes > context.maxFileBytes) {
    throw new VaultError("file_too_large", `Files on your plan can be up to ${Math.round(context.maxFileBytes / (1024 * 1024))} MB each.`);
  }
  const used = context.eventBytes + context.vaultUsedBytes + context.vaultReservedBytes;
  if (context.limitBytes !== null && used + sizeBytes > context.limitBytes) {
    throw new VaultError("quota_exceeded", "There isn't enough storage left on your plan for this. Free up space or upgrade your plan.");
  }
}

function linkFor(mode: "view" | "download", item: VaultItem) {
  const inline = mode === "view" && vaultConfig.inlineMimeTypes.has(item.mimeType);
  if (!inline) {
    return {
      contentDisposition: contentDisposition("attachment", item.filename),
      contentType: "application/octet-stream",
      // A download only needs the link at the moment it starts.
      expiresInSeconds: vaultConfig.downloadLinkTtlSeconds,
    };
  }
  // Text is served as plain text so the browser never interprets it as markup.
  const isText = item.mimeType === "text/plain" || item.mimeType === "text/csv";
  return {
    contentDisposition: contentDisposition("inline", item.filename),
    contentType: isText ? "text/plain; charset=utf-8" : item.mimeType,
    expiresInSeconds: vaultConfig.streamingPreviewMimeTypes.has(item.mimeType)
      ? vaultConfig.streamingPreviewLinkTtlSeconds
      : vaultConfig.downloadLinkTtlSeconds,
  };
}

export function createVaultRouter(deps: VaultRouterDeps) {
  const verifyUser = deps.verifyUser ?? verifySupabaseUser;
  const now = deps.now ?? (() => new Date());
  const router = Router();

  const route = (handler: Handler) => async (request: Request, response: Response, _next: NextFunction) => {
    try {
      if (!deps.storage) throw new VaultError("disabled", "EB Vault isn't available yet.");
      const verified = await verifyUser(request);
      if (!verified) throw new VaultError("unauthenticated", "Please sign in to use EB Vault.");
      const { id, email, phone } = verified.user;
      await handler({ request, response, user: { id, email, phone }, repo: deps.repo, storage: deps.storage });
    } catch (error) {
      const vaultError = toVaultError(error);
      if (vaultError) {
        response.status(vaultError.status).json({ success: false, code: vaultError.code, error: vaultError.message });
        return;
      }
      request.log?.error({ err: error }, "Vault request failed");
      response.status(500).json({ success: false, code: "server_error", error: "Something went wrong. Please try again." });
    }
  };

  const context = (repo: VaultRepository, user: VaultUser) => getStorageContext(repo, user, now());

  // ── Usage ──────────────────────────────────────────────────────────────────
  router.get("/usage", route(async ({ response, user, repo }) => {
    const ctx = await context(repo, user);
    const vault = ctx.vaultUsedBytes;
    const total = ctx.eventBytes + vault;
    response.json({
      success: true,
      limitBytes: ctx.limitBytes,
      usedBytes: { events: ctx.eventBytes, vault, total },
      reservedBytes: ctx.vaultReservedBytes,
      maxFileBytes: ctx.maxFileBytes,
      overLimit: ctx.limitBytes !== null && total > ctx.limitBytes,
      uploadsBlocked: ctx.uploadsBlocked,
      plan: {
        state: ctx.lifecycle.state,
        expiredOn: ctx.lifecycle.expiredOn,
        graceEndsOn: ctx.lifecycle.graceEndsOn,
        deletionOn: ctx.lifecycle.deletionOn,
      },
    });
  }));

  // ── Folders ────────────────────────────────────────────────────────────────
  router.get("/folders/:folderId/children", route(async ({ request, response, user, repo }) => {
    const folderId = optionalFolderId(request.params.folderId);
    const folder = folderId ? await repo.getFolder(user.id, folderId) : null;
    if (folderId && !folder) throw new VaultError("not_found", "That folder no longer exists.");
    const [listing, breadcrumbs, ctx] = await Promise.all([
      repo.listFolder(user.id, folderId),
      folderId ? repo.getBreadcrumbs(user.id, folderId) : Promise.resolve([]),
      context(repo, user),
    ]);
    response.json({ success: true, folder, breadcrumbs, folders: listing.folders, ...visibleItems(listing.items, ctx) });
  }));

  router.post("/folders", route(async ({ request, response, user, repo }) => {
    const folder = await repo.createFolder(user.id, optionalFolderId(request.body?.parentFolderId), sanitizeName(request.body?.name, "folder"));
    response.status(201).json({ success: true, folder });
  }));

  // Creates the folder tree for a folder upload, e.g. ["Trip", "Trip/Day 1"]. Returns path → folder id.
  router.post("/folders/paths", route(async ({ request, response, user, repo }) => {
    const parentFolderId = optionalFolderId(request.body?.parentFolderId);
    const rawPaths: unknown = request.body?.paths;
    if (!Array.isArray(rawPaths) || rawPaths.length === 0 || rawPaths.length > 1000) {
      throw new VaultError("invalid_input", "Choose a folder with up to 1000 subfolders.");
    }
    // Folder names are cleaned server-side; the reply is keyed by the paths exactly as sent,
    // so the browser can match each file to its folder.
    const cleanOf = new Map(rawPaths.map((path) => [String(path), String(path).split("/").filter(Boolean)
      .map((segment) => sanitizeName(segment, "folder")).join("/")]));
    const paths = Array.from(new Set(cleanOf.values())).filter(Boolean)
      .sort((a, b) => a.split("/").length - b.split("/").length);
    const created: Record<string, string> = {};
    for (const path of paths) {
      const segments = path.split("/");
      const parentPath = segments.slice(0, -1).join("/");
      const parentId = parentPath ? created[parentPath] : parentFolderId;
      if (parentPath && !parentId) continue;
      const folder = await repo.createFolder(user.id, parentId ?? null, segments[segments.length - 1]);
      created[path] = folder.id;
    }
    const folders: Record<string, string> = {};
    for (const [raw, clean] of cleanOf) if (created[clean]) folders[raw] = created[clean];
    response.status(201).json({ success: true, folders });
  }));

  router.patch("/folders/:folderId", route(async ({ request, response, user, repo }) => {
    const folderId = requireId(request.params.folderId, "folder");
    if (!(await repo.getFolder(user.id, folderId))) throw new VaultError("not_found", "That folder no longer exists.");
    if (request.body && "parentFolderId" in request.body) {
      await repo.moveFolder(user.id, folderId, optionalFolderId(request.body.parentFolderId));
    }
    const folder = request.body?.name !== undefined
      ? await repo.renameFolder(user.id, folderId, sanitizeName(request.body.name, "folder"))
      : await repo.getFolder(user.id, folderId);
    response.json({ success: true, folder });
  }));

  router.delete("/folders/:folderId", route(async ({ request, response, user, repo }) => {
    await repo.trash(user.id, "folder", requireId(request.params.folderId, "folder"));
    response.json({ success: true });
  }));

  // ── Uploads ────────────────────────────────────────────────────────────────
  router.post("/uploads", route(async ({ request, response, user, repo, storage }) => {
    const filename = sanitizeName(request.body?.filename, "file");
    const sizeBytes = requireSize(request.body?.sizeBytes);
    const mimeType = sanitizeMimeType(request.body?.mimeType);
    const folderId = optionalFolderId(request.body?.folderId);
    const ctx = await context(repo, user);
    assertCanAddStorage(ctx, sizeBytes);

    // Object keys use ids only, so renaming and moving never touch storage.
    const objectKey = `${user.id}/${randomUUID()}`;
    const uploadMode = sizeBytes > vaultConfig.multipartThresholdBytes ? "multipart" : "single";
    const uploadId = await repo.reserveUpload(user.id, {
      folderId, filename, extension: extensionOf(filename), mimeType, sizeBytes,
      bucket: storage.bucket, objectKey, uploadMode,
      expiresAt: new Date(now().getTime() + vaultConfig.uploadExpiryHours * 60 * 60 * 1000),
      limitBytes: ctx.limitBytes,
      otherUsedBytes: ctx.eventBytes,
    });

    try {
      if (uploadMode === "single") {
        const url = await storage.signSingleUpload(objectKey, sizeBytes, mimeType);
        response.status(201).json({ success: true, uploadId, mode: "single", url, headers: { "Content-Type": mimeType } });
        return;
      }
      const multipartUploadId = await storage.startMultipartUpload(objectKey, mimeType);
      await repo.setMultipartUploadId(user.id, uploadId, multipartUploadId);
      const partSize = Math.max(vaultConfig.minPartBytes, Math.ceil(sizeBytes / vaultConfig.maxParts / (1024 * 1024)) * 1024 * 1024);
      response.status(201).json({ success: true, uploadId, mode: "multipart", partSize, partCount: Math.ceil(sizeBytes / partSize) });
    } catch (error) {
      await repo.releaseUpload(user.id, uploadId, "aborted").catch(() => null);
      throw error;
    }
  }));

  router.post("/uploads/:uploadId/parts", route(async ({ request, response, user, repo, storage }) => {
    const upload = await repo.getUpload(user.id, String(request.params.uploadId));
    if (!upload || upload.status !== "pending" || upload.uploadMode !== "multipart" || !upload.multipartUploadId) {
      throw new VaultError("not_found", "That upload has expired. Please try again.");
    }
    const partNumbers: unknown = request.body?.partNumbers;
    if (!Array.isArray(partNumbers) || partNumbers.length === 0 || partNumbers.length > 100
      || !partNumbers.every((n) => Number.isInteger(n) && n >= 1 && n <= vaultConfig.maxParts)) {
      throw new VaultError("invalid_input", "Invalid upload parts.");
    }
    const urls = await Promise.all((partNumbers as number[]).map(async (partNumber) => ({
      partNumber,
      url: await storage.signUploadPart(upload.objectKey, upload.multipartUploadId!, partNumber),
    })));
    response.json({ success: true, parts: urls });
  }));

  router.post("/uploads/:uploadId/complete", route(async ({ request, response, user, repo, storage }) => {
    const upload = await repo.getUpload(user.id, String(request.params.uploadId));
    if (!upload || upload.status !== "pending") throw new VaultError("not_found", "That upload has expired. Please try again.");

    if (upload.uploadMode === "multipart") {
      const parts: unknown = request.body?.parts;
      if (!Array.isArray(parts) || parts.length === 0 || !parts.every((part) =>
        Number.isInteger(part?.partNumber) && typeof part?.etag === "string" && part.etag.length > 0 && part.etag.length < 200)) {
        throw new VaultError("invalid_input", "Invalid upload parts.");
      }
      await storage.completeMultipartUpload(upload.objectKey, upload.multipartUploadId!, parts
        .map((part) => ({ partNumber: part.partNumber as number, etag: part.etag as string }))
        .sort((a, b) => a.partNumber - b.partNumber));
    }

    // Trust the stored object's real size, not the browser's claim.
    const actualSize = await storage.getObjectSize(upload.objectKey);
    if (actualSize === null) throw new VaultError("upload_incomplete", "The file hasn't finished uploading yet.");
    const result = await repo.completeUpload(user.id, upload.id, actualSize);
    if (result.status === "size_mismatch") {
      await storage.deleteObject(upload.objectKey).catch(() => null);
      throw new VaultError("size_mismatch", "The uploaded file didn't match what was expected. Please try again.");
    }
    const item = await repo.getItem(user.id, result.itemId);
    response.status(201).json({ success: true, item });
  }));

  router.post("/uploads/:uploadId/abort", route(async ({ request, response, user, repo, storage }) => {
    const released = await repo.releaseUpload(user.id, requireId(request.params.uploadId, "upload"), "aborted");
    if (released) {
      if (released.multipartUploadId) await storage.abortMultipartUpload(released.objectKey, released.multipartUploadId).catch(() => null);
      await storage.deleteObject(released.objectKey).catch(() => null);
    }
    response.json({ success: true });
  }));

  // ── Files ──────────────────────────────────────────────────────────────────
  async function visibleItem(repo: VaultRepository, user: VaultUser, itemId: string) {
    const [item, ctx] = await Promise.all([repo.getItem(user.id, requireId(itemId)), context(repo, user)]);
    if (!item) throw new VaultError("not_found", "That file no longer exists.");
    if (isItemHidden(ctx, item.id)) throw new VaultError("plan_expired", HIDDEN_MESSAGE);
    return { item, ctx };
  }

  router.get("/items/:itemId", route(async ({ request, response, user, repo }) => {
    const { item, ctx } = await visibleItem(repo, user, String(request.params.itemId));
    response.json({ success: true, item: presentItem(item, ctx) });
  }));

  router.patch("/items/:itemId", route(async ({ request, response, user, repo }) => {
    const { item: current } = await visibleItem(repo, user, String(request.params.itemId));
    const body = request.body ?? {};
    const patch: { filename?: string; folderId?: string | null; isStarred?: boolean } = {};
    if (body.filename !== undefined) patch.filename = sanitizeName(body.filename, "file");
    if ("folderId" in body) patch.folderId = optionalFolderId(body.folderId);
    if (body.isStarred !== undefined) {
      if (typeof body.isStarred !== "boolean") throw new VaultError("invalid_input", "Invalid star value.");
      patch.isStarred = body.isStarred;
    }
    const item = await repo.updateItem(user.id, current.id, patch);
    response.json({ success: true, item });
  }));

  router.post("/items/:itemId/copy", route(async ({ request, response, user, repo }) => {
    const { item, ctx } = await visibleItem(repo, user, String(request.params.itemId));
    assertCanAddStorage(ctx, item.sizeBytes);
    const folderId = "folderId" in (request.body ?? {}) ? optionalFolderId(request.body.folderId) : item.folderId;
    const copyId = await repo.copyItem(user.id, item.id, folderId, ctx.limitBytes, ctx.eventBytes);
    response.status(201).json({ success: true, item: await repo.getItem(user.id, copyId) });
  }));

  router.delete("/items/:itemId", route(async ({ request, response, user, repo }) => {
    await repo.trash(user.id, "file", requireId(request.params.itemId));
    response.json({ success: true });
  }));

  router.get("/items/:itemId/link", route(async ({ request, response, user, repo, storage }) => {
    const mode = request.query.mode === "download" ? "download" : "view";
    const { item } = await visibleItem(repo, user, String(request.params.itemId));
    const stored = await repo.getItemObject(user.id, item.id);
    if (!stored) throw new VaultError("not_found", "That file no longer exists.");
    const link = linkFor(mode, item);
    const url = await storage.signDownload(stored.objectKey, link);
    response.setHeader("Cache-Control", "no-store");
    response.json({ success: true, url, expiresInSeconds: link.expiresInSeconds });
  }));

  // ── Save to EB Vault (copy event originals into the caller's Vault) ──────────
  router.post("/save-from-event", route(async ({ request, response, user, repo, storage }) => {
    const copier = deps.copier ?? null;
    if (!copier) throw new VaultError("disabled", "Saving from events to EB Vault isn't set up yet.");
    const photoIds: unknown = request.body?.photoIds;
    if (!Array.isArray(photoIds) || photoIds.length === 0 || photoIds.length > vaultConfig.maxSaveFromEventItems
      || !photoIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 300)) {
      throw new VaultError("invalid_input", `Choose between 1 and ${vaultConfig.maxSaveFromEventItems} items to save.`);
    }
    const folderId = optionalFolderId(request.body?.folderId);
    if (folderId && !(await repo.getFolder(user.id, folderId))) throw new VaultError("not_found", "That folder no longer exists.");

    const ids = Array.from(new Set(photoIds as string[]));
    const media = await repo.getEventMedia(ids);
    // Every item must exist and belong to an event the caller manages; otherwise nothing is saved,
    // and the reply doesn't reveal which ids exist.
    if (media.length !== ids.length) throw new VaultError("not_found", "Some of these photos or videos no longer exist.");
    const eventIds = Array.from(new Set(media.map((row) => row.eventId)));
    const allowed = await Promise.all(eventIds.map((eventId) => repo.canManageEvent(user.id, user.email ?? null, eventId)));
    if (allowed.some((ok) => !ok)) throw new VaultError("not_found", "Some of these photos or videos no longer exist.");

    const ctx = await context(repo, user);
    if (ctx.uploadsBlocked === "plan_expired") {
      throw new VaultError("plan_expired", "Saving is paused because your plan has expired. Renew your plan to save to EB Vault again.");
    }

    const saved: { photoId: string; item: VaultItem | null }[] = [];
    const failed: { photoId: string; error: string }[] = [];
    let stopReason: string | null = null;

    for (const row of media) {
      if (stopReason) {
        failed.push({ photoId: row.id, error: stopReason });
        continue;
      }
      if (row.tags.includes("__cover_usage__") || row.status === "uploading" || !row.storageKey) {
        failed.push({ photoId: row.id, error: "This item isn't ready to save yet." });
        continue;
      }
      const isVideo = row.mediaType === "video" || row.resourceType === "video";
      const filename = eventMediaFilename(row.storageKey, isVideo, row.format);
      const extension = extensionOf(filename);
      const mimeType = mimeTypeForExtension(extension, isVideo);
      let uploadId: string | null = null;
      const objectKey = `${user.id}/${randomUUID()}`;
      try {
        const sizeBytes = await copier.getEventObjectSize(row.storageKey);
        if (sizeBytes === null) throw new VaultError("not_found", "The original file for this item is missing.");
        if (sizeBytes > ctx.maxFileBytes) {
          throw new VaultError("file_too_large", `Files on your plan can be up to ${Math.round(ctx.maxFileBytes / (1024 * 1024))} MB each.`);
        }
        // Same atomic storage reservation as a normal upload, so saves can't exceed the shared limit.
        uploadId = await repo.reserveUpload(user.id, {
          folderId, filename, extension, mimeType, sizeBytes,
          bucket: storage.bucket, objectKey, uploadMode: "single",
          expiresAt: new Date(now().getTime() + vaultConfig.uploadExpiryHours * 60 * 60 * 1000),
          limitBytes: ctx.limitBytes,
          otherUsedBytes: ctx.eventBytes,
        });
        await copier.copyToVault(row.storageKey, objectKey, sizeBytes, mimeType);
        const actualSize = await storage.getObjectSize(objectKey);
        if (actualSize === null) throw new VaultError("upload_incomplete", "The copy didn't finish. Please try again.");
        const result = await repo.completeUpload(user.id, uploadId, actualSize);
        if (result.status === "size_mismatch") {
          await storage.deleteObject(objectKey).catch(() => null);
          throw new VaultError("size_mismatch", "The copy didn't match the original. Please try again.");
        }
        uploadId = null;
        saved.push({ photoId: row.id, item: await repo.getItem(user.id, result.itemId) });
      } catch (error) {
        if (uploadId) {
          await repo.releaseUpload(user.id, uploadId, "aborted").catch(() => null);
          await storage.deleteObject(objectKey).catch(() => null);
        }
        const vaultError = toVaultError(error);
        const message = vaultError?.message ?? "This item couldn't be saved. Please try again.";
        failed.push({ photoId: row.id, error: message });
        // Once storage is full every later item would fail the same way.
        if (vaultError?.code === "quota_exceeded") stopReason = message;
        if (!vaultError) request.log?.error({ err: error, photoId: row.id }, "Save to Vault failed");
      }
    }

    response.json({ success: true, saved, failed });
  }));

  // ── Lists ──────────────────────────────────────────────────────────────────
  const listRoute = (load: (repo: VaultRepository, user: VaultUser, request: Request) => Promise<VaultItem[]>) =>
    route(async ({ request, response, user, repo }) => {
      const [items, ctx] = await Promise.all([load(repo, user, request), context(repo, user)]);
      response.json({ success: true, ...visibleItems(items, ctx) });
    });

  router.get("/recent", listRoute((repo, user) => repo.listRecent(user.id, vaultConfig.recentLimit)));
  router.get("/starred", listRoute((repo, user) => repo.listStarred(user.id, vaultConfig.pageSize)));
  router.get("/search", listRoute(async (repo, user, request) => {
    const query = String(request.query.q ?? "").trim().slice(0, 100);
    return query ? repo.search(user.id, query, vaultConfig.searchLimit) : [];
  }));

  // ── Trash ──────────────────────────────────────────────────────────────────
  router.get("/trash", route(async ({ response, user, repo }) => {
    const entries = await repo.listTrash(user.id);
    const retentionMs = vaultConfig.trashRetentionDays * 24 * 60 * 60 * 1000;
    response.json({
      success: true,
      retentionDays: vaultConfig.trashRetentionDays,
      entries: entries.map((entry) => ({ ...entry, permanentlyDeletedOn: new Date(new Date(entry.deletedAt).getTime() + retentionMs).toISOString() })),
    });
  }));

  router.post("/trash/restore", route(async ({ request, response, user, repo }) => {
    await repo.restore(user.id, requireKind(request.body?.kind), requireId(request.body?.id, "item"));
    response.json({ success: true });
  }));

  // Permanent deletion of one Trash entry, or everything in Trash.
  router.delete("/trash/:kind/:id", route(async ({ request, response, user, repo, storage }) => {
    requireKind(request.params.kind);
    const freedBytes = await repo.purge(user.id, requireId(request.params.id, "item"));
    void deletePendingObjects(repo, storage).catch(() => null);
    response.json({ success: true, freedBytes });
  }));

  router.delete("/trash", route(async ({ response, user, repo, storage }) => {
    let freedBytes = 0;
    for (const entry of await repo.listTrash(user.id)) {
      freedBytes += await repo.purge(user.id, entry.id).catch(() => 0);
    }
    void deletePendingObjects(repo, storage).catch(() => null);
    response.json({ success: true, freedBytes });
  }));

  return router;
}
