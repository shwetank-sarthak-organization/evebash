import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase.js";
import { toAlbumError } from "./errors.js";

export type PageLayout = "spread" | "single";
export type CommentKind = "replace" | "bigger" | "smaller" | "edit" | "remove" | "note";

export type AlbumRow = {
  id: string;
  eventId: string;
  title: string;
  currentRound: number;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PageRow = {
  id: string;
  albumId: string;
  position: number;
  layout: PageLayout;
  approvedVersion: number | null;
  approvedBy: string | null;
  approvedAt: string | null;
};

export type VersionRow = {
  pageId: string;
  version: number;
  /** 0 until it is sent for review */
  round: number;
  fileName: string | null;
  previewKey: string;
  thumbnailKey: string;
  width: number | null;
  height: number | null;
  bytes: number;
  createdAt: string;
};

export type CommentRow = {
  id: string;
  pageId: string;
  version: number;
  parentId: string | null;
  authorId: string;
  kind: CommentKind;
  pinX: number | null;
  pinY: number | null;
  body: string | null;
  voiceKey: string | null;
  voiceSeconds: number | null;
  voiceBytes: number;
  replacementPhotoId: string | null;
  status: "open" | "done";
  /** null while it is a draft only its author sees */
  sentAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type RoundRow = { number: number; sentBy: string | null; sentAt: string; pageCount: number; updatedPageCount: number };

export type EventPhoto = { id: string; eventId: string; thumbnailUrl: string | null; previewUrl: string | null };

export type PageImage = { fileName: string | null; previewKey: string; thumbnailKey: string; width: number; height: number; bytes: number };

export type NewComment = Pick<CommentRow, "pageId" | "version" | "parentId" | "authorId" | "kind" | "pinX" | "pinY" | "body" | "replacementPhotoId" | "sentAt">;
export type CommentPatch = Partial<Pick<CommentRow, "kind" | "pinX" | "pinY" | "body" | "replacementPhotoId" | "status" | "resolvedBy" | "resolvedAt" | "voiceKey" | "voiceSeconds" | "voiceBytes">>;

export interface AlbumRepository {
  /** The main gallery of a gallery or sub-gallery; null if it doesn't exist. */
  rootEventId(eventId: string): Promise<string | null>;
  listAlbums(eventId: string): Promise<AlbumRow[]>;
  getAlbum(albumId: string): Promise<AlbumRow | null>;
  createAlbum(input: { eventId: string; title: string; createdBy: string }): Promise<AlbumRow>;
  updateAlbum(albumId: string, patch: Partial<Pick<AlbumRow, "title" | "approvedBy" | "approvedAt">>): Promise<void>;
  deleteAlbum(albumId: string): Promise<void>;
  listPages(albumIds: string[]): Promise<PageRow[]>;
  updatePage(pageId: string, patch: Partial<Pick<PageRow, "layout" | "approvedVersion" | "approvedBy" | "approvedAt">>): Promise<void>;
  deletePage(pageId: string): Promise<void>;
  listVersions(pageIds: string[]): Promise<VersionRow[]>;
  listComments(pageIds: string[]): Promise<CommentRow[]>;
  getComment(commentId: string): Promise<CommentRow | null>;
  createComment(input: NewComment): Promise<CommentRow>;
  updateComment(commentId: string, patch: CommentPatch): Promise<void>;
  deleteComment(commentId: string): Promise<void>;
  /** Sends the author's drafts on these pages; returns how many were sent. */
  sendDrafts(pageIds: string[], authorId: string, sentAt: string): Promise<number>;
  listRounds(albumId: string): Promise<RoundRow[]>;
  addPage(albumId: string, layout: PageLayout, image: PageImage, userId: string, maxPages: number): Promise<string>;
  addVersion(pageId: string, image: PageImage, userId: string): Promise<number>;
  sendRound(albumId: string, userId: string): Promise<{ round: number; pages: number; updatedPages: number }>;
  reorder(albumId: string, pageIds: string[]): Promise<void>;
  /** Favourite photos (not videos) of the main gallery and its sub-galleries. */
  listFavourites(rootEventId: string): Promise<EventPhoto[]>;
  getPhotos(ids: string[]): Promise<EventPhoto[]>;
  profileNames(ids: string[]): Promise<Map<string, string>>;
  /** Owner and approved guest admins of the main gallery, as profile ids (for pushes). */
  managerIds(rootEventId: string): Promise<string[]>;
  pushTokens(profileIds: string[]): Promise<{ profileId: string; token: string }[]>;
  listDeletedFiles(limit: number): Promise<{ id: number; storageKey: string }[]>;
  removeDeletedFiles(ids: number[]): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids reach the database only after this check, so a malformed id becomes "not found", not an error. */
export const isAlbumId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw toAlbumError(result.error) ?? result.error;
  return result.data;
}

type Row = Record<string, any>;

const album = (row: Row): AlbumRow => ({
  id: row.id, eventId: row.event_id, title: row.title, currentRound: row.current_round, createdBy: row.created_by,
  approvedBy: row.approved_by, approvedAt: row.approved_at, createdAt: row.created_at, updatedAt: row.updated_at,
});
const page = (row: Row): PageRow => ({
  id: row.id, albumId: row.album_id, position: row.position, layout: row.layout,
  approvedVersion: row.approved_version, approvedBy: row.approved_by, approvedAt: row.approved_at,
});
const version = (row: Row): VersionRow => ({
  pageId: row.page_id, version: row.version, round: row.round, fileName: row.file_name, previewKey: row.preview_key,
  thumbnailKey: row.thumbnail_key, width: row.width, height: row.height, bytes: Number(row.bytes || 0), createdAt: row.created_at,
});
const comment = (row: Row): CommentRow => ({
  id: row.id, pageId: row.page_id, version: row.version, parentId: row.parent_id, authorId: row.author_id, kind: row.kind,
  pinX: row.pin_x, pinY: row.pin_y, body: row.body, voiceKey: row.voice_key, voiceSeconds: row.voice_seconds,
  voiceBytes: Number(row.voice_bytes || 0), replacementPhotoId: row.replacement_photo_id, status: row.status,
  sentAt: row.sent_at, resolvedBy: row.resolved_by, resolvedAt: row.resolved_at, createdAt: row.created_at,
});
const photo = (row: Row): EventPhoto => ({
  id: row.id, eventId: row.event_id, thumbnailUrl: row.thumbnail_url || row.preview_url || row.url || null,
  previewUrl: row.preview_url || row.url || row.thumbnail_url || null,
});

const COMMENT_COLUMNS: Record<keyof CommentPatch | keyof NewComment, string> = {
  pageId: "page_id", version: "version", parentId: "parent_id", authorId: "author_id", kind: "kind", pinX: "pin_x",
  pinY: "pin_y", body: "body", replacementPhotoId: "replacement_photo_id", sentAt: "sent_at", status: "status",
  resolvedBy: "resolved_by", resolvedAt: "resolved_at", voiceKey: "voice_key", voiceSeconds: "voice_seconds", voiceBytes: "voice_bytes",
};

function toColumns(patch: Record<string, unknown>, columns: Record<string, string>) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined).map(([key, value]) => [columns[key], value]));
}

/** Large id lists are queried in chunks so the request URL stays short. */
async function inChunks<T>(ids: string[], run: (chunk: string[]) => Promise<T[]>, size = 150): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...await run(ids.slice(i, i + size)));
  return out;
}

export function createSupabaseAlbumRepository(getClient: () => SupabaseClient = getSupabaseAdminClient): AlbumRepository {
  const db = () => getClient();

  async function childEventIds(rootId: string) {
    const root = check(await db().from("events").select("id,legacy_id").eq("id", rootId).maybeSingle()) as Row | null;
    if (!root) return [];
    const parents = [root.id, root.legacy_id].filter(Boolean);
    const children = check(await db().from("events").select("id").in("parent_id", parents)) as Row[];
    return [root.id as string, ...children.map((row) => row.id as string)];
  }

  return {
    async rootEventId(eventId) {
      const event = check(await db().from("events").select("id,parent_id").eq("id", eventId).maybeSingle()) as Row | null;
      if (!event) return null;
      if (!event.parent_id) return event.id;
      // A sub-gallery's parent_id is its main gallery's id, or for old galleries its legacy_id
      for (const column of ["id", "legacy_id"]) {
        const root = check(await db().from("events").select("id").is("parent_id", null).eq(column, event.parent_id).limit(1).maybeSingle()) as Row | null;
        if (root) return root.id;
      }
      return event.id;
    },
    async listAlbums(eventId) {
      return (check(await db().from("album_proofs").select("*").eq("event_id", eventId).order("created_at")) as Row[]).map(album);
    },
    async getAlbum(albumId) {
      if (!isAlbumId(albumId)) return null;
      const row = check(await db().from("album_proofs").select("*").eq("id", albumId).maybeSingle()) as Row | null;
      return row ? album(row) : null;
    },
    async createAlbum({ eventId, title, createdBy }) {
      return album(check(await db().from("album_proofs").insert({ event_id: eventId, title, created_by: createdBy }).select("*").single()) as Row);
    },
    async updateAlbum(albumId, patch) {
      const columns = toColumns(patch, { title: "title", approvedBy: "approved_by", approvedAt: "approved_at" });
      check(await db().from("album_proofs").update({ ...columns, updated_at: new Date().toISOString() }).eq("id", albumId));
    },
    async deleteAlbum(albumId) {
      check(await db().from("album_proofs").delete().eq("id", albumId));
    },
    async listPages(albumIds) {
      if (!albumIds.length) return [];
      return (check(await db().from("album_proof_pages").select("*").in("album_id", albumIds).order("position")) as Row[]).map(page);
    },
    async updatePage(pageId, patch) {
      const columns = toColumns(patch, { layout: "layout", approvedVersion: "approved_version", approvedBy: "approved_by", approvedAt: "approved_at" });
      check(await db().from("album_proof_pages").update(columns).eq("id", pageId));
    },
    async deletePage(pageId) {
      check(await db().from("album_proof_pages").delete().eq("id", pageId));
    },
    async listVersions(pageIds) {
      return inChunks(pageIds, async (chunk) =>
        (check(await db().from("album_proof_page_versions").select("*").in("page_id", chunk).order("version")) as Row[]).map(version));
    },
    async listComments(pageIds) {
      return inChunks(pageIds, async (chunk) =>
        (check(await db().from("album_proof_comments").select("*").in("page_id", chunk).order("created_at")) as Row[]).map(comment));
    },
    async getComment(commentId) {
      if (!isAlbumId(commentId)) return null;
      const row = check(await db().from("album_proof_comments").select("*").eq("id", commentId).maybeSingle()) as Row | null;
      return row ? comment(row) : null;
    },
    async createComment(input) {
      return comment(check(await db().from("album_proof_comments").insert(toColumns(input, COMMENT_COLUMNS)).select("*").single()) as Row);
    },
    async updateComment(commentId, patch) {
      check(await db().from("album_proof_comments").update(toColumns(patch, COMMENT_COLUMNS)).eq("id", commentId));
    },
    async deleteComment(commentId) {
      check(await db().from("album_proof_comments").delete().eq("id", commentId));
    },
    async sendDrafts(pageIds, authorId, sentAt) {
      const sent = await inChunks(pageIds, async (chunk) =>
        check(await db().from("album_proof_comments").update({ sent_at: sentAt })
          .in("page_id", chunk).eq("author_id", authorId).is("sent_at", null).select("id")) as Row[]);
      return sent.length;
    },
    async listRounds(albumId) {
      const rows = check(await db().from("album_proof_rounds").select("*").eq("album_id", albumId).order("number")) as Row[];
      return rows.map((row) => ({ number: row.number, sentBy: row.sent_by, sentAt: row.sent_at, pageCount: row.page_count, updatedPageCount: row.updated_page_count }));
    },
    async addPage(albumId, layout, image, userId, maxPages) {
      return check(await db().rpc("album_proof_add_page", {
        p_album_id: albumId, p_layout: layout, p_file_name: image.fileName, p_preview_key: image.previewKey,
        p_thumbnail_key: image.thumbnailKey, p_width: image.width, p_height: image.height, p_bytes: image.bytes,
        p_user_id: userId, p_max_pages: maxPages,
      })) as string;
    },
    async addVersion(pageId, image, userId) {
      return check(await db().rpc("album_proof_add_version", {
        p_page_id: pageId, p_file_name: image.fileName, p_preview_key: image.previewKey, p_thumbnail_key: image.thumbnailKey,
        p_width: image.width, p_height: image.height, p_bytes: image.bytes, p_user_id: userId,
      })) as number;
    },
    async sendRound(albumId, userId) {
      return check(await db().rpc("album_proof_send_round", { p_album_id: albumId, p_user_id: userId })) as { round: number; pages: number; updatedPages: number };
    },
    async reorder(albumId, pageIds) {
      check(await db().rpc("album_proof_reorder", { p_album_id: albumId, p_page_ids: pageIds }));
    },
    async listFavourites(rootEventId) {
      const eventIds = await childEventIds(rootEventId);
      if (!eventIds.length) return [];
      const seen = new Set<string>();
      const out: EventPhoto[] = [];
      for (let from = 0; ; from += 1000) {
        const rows = check(await db().from("event_favourite_photos")
          .select("photo_id, created_at, photos(id,event_id,thumbnail_url,preview_url,url,media_type,status)")
          .in("event_id", eventIds).order("created_at").range(from, from + 999)) as Row[];
        for (const row of rows) {
          const p = row.photos as Row | null;
          if (!p || seen.has(p.id) || p.media_type === "video" || p.status === "uploading") continue;
          seen.add(p.id);
          out.push(photo(p));
        }
        if (rows.length < 1000) break;
      }
      return out;
    },
    async getPhotos(ids) {
      return inChunks([...new Set(ids)], async (chunk) =>
        (check(await db().from("photos").select("id,event_id,thumbnail_url,preview_url,url").in("id", chunk)) as Row[]).map(photo));
    },
    async profileNames(ids) {
      const rows = await inChunks([...new Set(ids)], async (chunk) =>
        check(await db().from("profiles").select("id,name,email").in("id", chunk)) as Row[]);
      return new Map(rows.map((row) => [row.id as string, String(row.name || "").trim() || String(row.email || "").split("@")[0] || "Someone"]));
    },
    async managerIds(rootEventId) {
      const event = check(await db().from("events").select("created_by").eq("id", rootEventId).maybeSingle()) as Row | null;
      const ids = new Set<string>();
      const owner = String(event?.created_by || "");
      if (owner) {
        const profile = check(await db().from("profiles").select("id").eq(owner.includes("@") ? "email" : "id", owner).maybeSingle()) as Row | null;
        if (profile?.id) ids.add(profile.id);
      }
      for (const column of ["event_id", "parent_event_id"]) {
        const guests = check(await db().from("guests").select("user_id").eq(column, rootEventId).eq("status", "approved")
          .eq("can_admin", true).not("user_id", "is", null)) as Row[];
        guests.forEach((guest) => ids.add(String(guest.user_id)));
      }
      return [...ids];
    },
    async pushTokens(profileIds) {
      if (!profileIds.length) return [];
      // Only push_token: profiles has no notification_preferences column (#58)
      const rows = check(await db().from("profiles").select("id,push_token").in("id", profileIds).not("push_token", "is", null)) as Row[];
      return rows.map((row) => ({ profileId: row.id, token: row.push_token }));
    },
    async listDeletedFiles(limit) {
      const rows = check(await db().from("album_proof_deleted_files").select("id,storage_key").order("id").limit(limit)) as Row[];
      return rows.map((row) => ({ id: Number(row.id), storageKey: row.storage_key }));
    },
    async removeDeletedFiles(ids) {
      if (ids.length) check(await db().from("album_proof_deleted_files").delete().in("id", ids));
    },
  };
}
