import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Request } from "express";
import { getCachedBackblazeAuth } from "../backblaze.js";
import { deleteB2File, getMediaDomain, uploadBufferToB2 } from "../routes/media.js";
import { AlbumError } from "./errors.js";
import type { AlbumRepository } from "./repository.js";

/** Where album previews, thumbnails and voice notes are kept (the event media bucket, served from the media domain). */
export interface AlbumFiles {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** true once the file is gone (or was never there) */
  delete(key: string): Promise<boolean>;
  url(key: string): string;
}

export function createB2AlbumFiles(): AlbumFiles {
  const bucketId = () => {
    const value = process.env.B2_BUCKET_ID?.trim();
    if (!value) throw new Error("B2_BUCKET_ID is not configured");
    return value;
  };
  return {
    async put(key, body, contentType) {
      await uploadBufferToB2(await getCachedBackblazeAuth(), bucketId(), body, key, contentType);
    },
    async delete(key) {
      return deleteB2File(await getCachedBackblazeAuth(), bucketId(), key);
    },
    url(key) {
      return `https://${getMediaDomain()}/${key.split("/").map(encodeURIComponent).join("/")}`;
    },
  };
}

/**
 * Streams the request body (the raw file) to a temporary file, refusing anything over maxBytes without holding it
 * in memory. A file that turns out too large is read to the end and thrown away, so the client still gets the error
 * rather than a dropped connection. The caller deletes the file.
 */
export async function receiveUpload(request: Request, maxBytes: number, tooLargeMessage: string): Promise<{ path: string; bytes: number }> {
  const declared = Number(request.headers["content-length"] || 0);
  if (declared > maxBytes) throw new AlbumError("file_too_large", tooLargeMessage);
  const path = join(tmpdir(), `album-upload-${randomUUID()}`);
  const out = createWriteStream(path);
  let bytes = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      out.on("error", reject);
      request.on("error", reject);
      request.on("aborted", () => reject(new Error("aborted")));
      request.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maxBytes) return;
        if (!out.write(chunk)) {
          request.pause();
          out.once("drain", () => request.resume());
        }
      });
      request.on("end", () => resolve());
    });
    await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())));
  } catch {
    out.destroy();
    await rm(path, { force: true });
    throw new AlbumError("invalid_input", "The upload was interrupted. Please try again.");
  }
  if (bytes > maxBytes || !bytes) {
    await rm(path, { force: true });
    throw bytes ? new AlbumError("file_too_large", tooLargeMessage) : new AlbumError("invalid_input", "The file is empty.");
  }
  return { path, bytes };
}

/** Reads and discards what is left of a request body (see receiveUpload), giving up after a while. */
export function drainRequest(request: Request, timeoutMs = 120_000) {
  if (request.complete || request.readableEnded) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const done = () => { clearTimeout(timer); resolve(); };
    request.once("end", done);
    request.once("close", done);
    request.once("error", done);
    request.resume();
  });
}

/** Deletes the B2 files the database queued (deleted versions and voice notes, also from deleted albums and events). */
export async function flushDeletedAlbumFiles(repo: AlbumRepository, files: AlbumFiles, batch = 200) {
  let deleted = 0;
  for (;;) {
    const queued = await repo.listDeletedFiles(batch);
    if (!queued.length) return deleted;
    const done: number[] = [];
    for (const file of queued) {
      if (await files.delete(file.storageKey).catch(() => false)) done.push(file.id);
    }
    await repo.removeDeletedFiles(done);
    deleted += done.length;
    // Stop when B2 refused everything this time, so a B2 outage doesn't loop forever
    if (done.length < queued.length) return deleted;
  }
}
