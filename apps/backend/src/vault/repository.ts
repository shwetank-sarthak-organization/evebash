import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase.js";
import { toVaultError, VaultError } from "./errors.js";
import { extensionOf } from "./names.js";

export type VaultFolder = {
  id: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VaultItem = {
  id: string;
  folderId: string | null;
  filename: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VaultUpload = {
  id: string;
  folderId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  bucket: string;
  objectKey: string;
  uploadMode: "single" | "multipart";
  multipartUploadId: string | null;
  status: "pending" | "completed" | "aborted" | "expired";
  expiresAt: string;
};

export type TrashEntry = {
  kind: "file" | "folder";
  id: string;
  name: string;
  sizeBytes: number | null;
  mimeType: string | null;
  deletedAt: string;
};

/** An event photo/video row, as needed to save it into Vault. */
export type EventMedia = {
  id: string;
  eventId: string;
  storageKey: string;
  mediaType: string | null;
  resourceType: string | null;
  format: string | null;
  status: string | null;
  tags: string[];
};

export type ReserveUploadInput = {
  folderId: string | null;
  filename: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  bucket: string;
  objectKey: string;
  uploadMode: "single" | "multipart";
  expiresAt: Date;
  limitBytes: number | null;
  otherUsedBytes: number;
};

/** Data access for Vault. Every method takes the verified owner id and never returns another user's rows. */
export interface VaultRepository {
  getProfile(ownerId: string): Promise<{ role: string | null; planEndDate: string | null }>;
  getEventStorageBytes(identifiers: string[]): Promise<number>;
  getAccount(ownerId: string): Promise<{ usedBytes: number; reservedBytes: number }>;
  getRetainedItemIds(ownerId: string, identifiers: string[], budgetBytes: number): Promise<Set<string>>;

  reserveUpload(ownerId: string, input: ReserveUploadInput): Promise<string>;
  setMultipartUploadId(ownerId: string, uploadId: string, multipartUploadId: string): Promise<void>;
  getUpload(ownerId: string, uploadId: string): Promise<VaultUpload | null>;
  completeUpload(ownerId: string, uploadId: string, actualSizeBytes: number): Promise<{ status: "ok"; itemId: string } | { status: "size_mismatch" }>;
  releaseUpload(ownerId: string | null, uploadId: string, status: "aborted" | "expired"): Promise<VaultUpload | null>;

  getFolder(ownerId: string, folderId: string): Promise<VaultFolder | null>;
  getBreadcrumbs(ownerId: string, folderId: string): Promise<{ id: string; name: string }[]>;
  listFolder(ownerId: string, folderId: string | null): Promise<{ folders: VaultFolder[]; items: VaultItem[] }>;
  createFolder(ownerId: string, parentFolderId: string | null, name: string): Promise<VaultFolder>;
  renameFolder(ownerId: string, folderId: string, name: string): Promise<VaultFolder>;
  moveFolder(ownerId: string, folderId: string, parentFolderId: string | null): Promise<void>;

  getItem(ownerId: string, itemId: string): Promise<VaultItem | null>;
  getItemObject(ownerId: string, itemId: string): Promise<{ item: VaultItem; bucket: string; objectKey: string } | null>;
  updateItem(ownerId: string, itemId: string, patch: { filename?: string; folderId?: string | null; isStarred?: boolean }): Promise<VaultItem>;
  copyItem(ownerId: string, itemId: string, folderId: string | null, limitBytes: number | null, otherUsedBytes: number): Promise<string>;

  trash(ownerId: string, kind: "file" | "folder", id: string): Promise<void>;
  restore(ownerId: string, kind: "file" | "folder", id: string): Promise<void>;
  purge(ownerId: string, trashRootId: string): Promise<number>;
  listTrash(ownerId: string): Promise<TrashEntry[]>;

  listRecent(ownerId: string, limit: number): Promise<VaultItem[]>;
  listStarred(ownerId: string, limit: number): Promise<VaultItem[]>;
  search(ownerId: string, query: string, limit: number): Promise<VaultItem[]>;

  // "Save to EB Vault" from events.
  canManageEvent(userId: string, email: string | null, eventId: string): Promise<boolean>;
  getEventMedia(photoIds: string[]): Promise<EventMedia[]>;

  // Background maintenance (not scoped to one user).
  listExpiredUploads(limit: number): Promise<{ id: string }[]>;
  purgeExpiredTrash(retentionDays: number, limit: number): Promise<number>;
  listDeletableObjects(limit: number): Promise<{ id: string; bucket: string; objectKey: string }[]>;
  deleteObjectRow(objectId: string): Promise<void>;
}

const FOLDER_COLUMNS = "id,name,parent_folder_id,created_at,updated_at";
const ITEM_COLUMNS = "id,folder_id,filename,extension,mime_type,size_bytes,is_starred,created_at,updated_at";
const UPLOAD_COLUMNS = "id,folder_id,filename,mime_type,size_bytes,bucket,object_key,upload_mode,multipart_upload_id,status,expires_at";

type Row = Record<string, any>;

const toFolder = (row: Row): VaultFolder => ({
  id: row.id,
  name: row.name,
  parentFolderId: row.parent_folder_id ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toItem = (row: Row): VaultItem => ({
  id: row.id,
  folderId: row.folder_id ?? null,
  filename: row.filename,
  extension: row.extension ?? "",
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes) || 0,
  isStarred: Boolean(row.is_starred),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toUpload = (row: Row): VaultUpload => ({
  id: row.id,
  folderId: row.folder_id ?? null,
  filename: row.filename,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes) || 0,
  bucket: row.bucket,
  objectKey: row.object_key,
  uploadMode: row.upload_mode,
  multipartUploadId: row.multipart_upload_id ?? null,
  status: row.status,
  expiresAt: row.expires_at,
});

function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw toVaultError(result.error) ?? result.error;
  return result.data;
}

/** Ids reach the database only after this check, so a malformed id becomes "not found", not an error. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isVaultId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function createSupabaseVaultRepository(getClient: () => SupabaseClient = getSupabaseAdminClient): VaultRepository {
  const db = () => getClient();

  async function uniqueName(ownerId: string, folderId: string | null, name: string, kind: "file" | "folder", excludeId?: string) {
    return check(await db().rpc("vault_unique_name", {
      p_owner: ownerId, p_folder_id: folderId, p_name: name, p_kind: kind, p_exclude_id: excludeId ?? null,
    })) as string;
  }

  async function liveFolderExists(ownerId: string, folderId: string | null) {
    if (folderId === null) return true;
    const { data } = await db().from("vault_folders").select("id").eq("id", folderId).eq("owner_id", ownerId).is("deleted_at", null).maybeSingle();
    return Boolean(data);
  }

  async function listItems(ownerId: string, apply: (query: any) => any, limit: number) {
    const rows = check(await apply(db().from("vault_items").select(ITEM_COLUMNS).eq("owner_id", ownerId).is("deleted_at", null)).limit(limit)) as Row[];
    return rows.map(toItem);
  }

  return {
    async getProfile(ownerId) {
      const row = check(await db().from("profiles").select("role,plan_end_date").eq("id", ownerId).maybeSingle()) as Row | null;
      return { role: row?.role ?? null, planEndDate: row?.plan_end_date ?? null };
    },

    async getEventStorageBytes(identifiers) {
      return Number(check(await db().rpc("vault_event_storage_bytes", { p_identifiers: identifiers }))) || 0;
    },

    async getAccount(ownerId) {
      const row = check(await db().from("vault_accounts").select("used_bytes,reserved_bytes").eq("owner_id", ownerId).maybeSingle()) as Row | null;
      return { usedBytes: Number(row?.used_bytes) || 0, reservedBytes: Number(row?.reserved_bytes) || 0 };
    },

    async getRetainedItemIds(ownerId, identifiers, budgetBytes) {
      const rows = check(await db().rpc("vault_retained_item_ids", { p_owner: ownerId, p_identifiers: identifiers, p_budget: budgetBytes })) as unknown[];
      return new Set(rows.map((row) => (typeof row === "string" ? row : (row as Row).vault_retained_item_ids)));
    },

    async reserveUpload(ownerId, input) {
      return check(await db().rpc("vault_reserve_upload", {
        p_owner: ownerId,
        p_folder_id: input.folderId,
        p_filename: input.filename,
        p_extension: input.extension,
        p_mime_type: input.mimeType,
        p_size_bytes: input.sizeBytes,
        p_bucket: input.bucket,
        p_object_key: input.objectKey,
        p_upload_mode: input.uploadMode,
        p_expires_at: input.expiresAt.toISOString(),
        p_limit_bytes: input.limitBytes,
        p_other_used_bytes: input.otherUsedBytes,
      })) as string;
    },

    async setMultipartUploadId(ownerId, uploadId, multipartUploadId) {
      check(await db().from("vault_uploads").update({ multipart_upload_id: multipartUploadId })
        .eq("id", uploadId).eq("owner_id", ownerId).eq("status", "pending"));
    },

    async getUpload(ownerId, uploadId) {
      if (!isVaultId(uploadId)) return null;
      const row = check(await db().from("vault_uploads").select(UPLOAD_COLUMNS).eq("id", uploadId).eq("owner_id", ownerId).maybeSingle()) as Row | null;
      return row ? toUpload(row) : null;
    },

    async completeUpload(ownerId, uploadId, actualSizeBytes) {
      const result = check(await db().rpc("vault_complete_upload", {
        p_upload_id: uploadId, p_owner: ownerId, p_actual_size: actualSizeBytes, p_content_hash: null,
      })) as Row;
      return result.status === "ok" ? { status: "ok", itemId: result.item_id } : { status: "size_mismatch" };
    },

    async releaseUpload(ownerId, uploadId, status) {
      const rows = check(await db().rpc("vault_release_upload", { p_upload_id: uploadId, p_owner: ownerId, p_status: status })) as Row[];
      return rows?.[0] ? toUpload(rows[0]) : null;
    },

    async getFolder(ownerId, folderId) {
      if (!isVaultId(folderId)) return null;
      const row = check(await db().from("vault_folders").select(FOLDER_COLUMNS)
        .eq("id", folderId).eq("owner_id", ownerId).is("deleted_at", null).maybeSingle()) as Row | null;
      return row ? toFolder(row) : null;
    },

    async getBreadcrumbs(ownerId, folderId) {
      const trail: { id: string; name: string }[] = [];
      let current: string | null = folderId;
      for (let depth = 0; current && depth < 64; depth += 1) {
        const row = check(await db().from("vault_folders").select("id,name,parent_folder_id")
          .eq("id", current).eq("owner_id", ownerId).maybeSingle()) as Row | null;
        if (!row) break;
        trail.unshift({ id: row.id, name: row.name });
        current = row.parent_folder_id;
      }
      return trail;
    },

    async listFolder(ownerId, folderId) {
      const folderQuery = db().from("vault_folders").select(FOLDER_COLUMNS).eq("owner_id", ownerId).is("deleted_at", null).order("name");
      const itemQuery = db().from("vault_items").select(ITEM_COLUMNS).eq("owner_id", ownerId).is("deleted_at", null).order("filename");
      const [folders, items] = await Promise.all([
        folderId ? folderQuery.eq("parent_folder_id", folderId) : folderQuery.is("parent_folder_id", null),
        folderId ? itemQuery.eq("folder_id", folderId) : itemQuery.is("folder_id", null),
      ]);
      return { folders: (check(folders) as Row[]).map(toFolder), items: (check(items) as Row[]).map(toItem) };
    },

    async createFolder(ownerId, parentFolderId, name) {
      if (!(await liveFolderExists(ownerId, parentFolderId))) throw new VaultError("not_found", "That folder no longer exists.");
      const finalName = await uniqueName(ownerId, parentFolderId, name, "folder");
      const row = check(await db().from("vault_folders").insert({ owner_id: ownerId, parent_folder_id: parentFolderId, name: finalName })
        .select(FOLDER_COLUMNS).single()) as Row;
      return toFolder(row);
    },

    async renameFolder(ownerId, folderId, name) {
      const folder = await this.getFolder(ownerId, folderId);
      if (!folder) throw new VaultError("not_found", "That folder no longer exists.");
      const finalName = await uniqueName(ownerId, folder.parentFolderId, name, "folder", folderId);
      const row = check(await db().from("vault_folders").update({ name: finalName })
        .eq("id", folderId).eq("owner_id", ownerId).is("deleted_at", null).select(FOLDER_COLUMNS).single()) as Row;
      return toFolder(row);
    },

    async moveFolder(ownerId, folderId, parentFolderId) {
      check(await db().rpc("vault_move_folder", { p_owner: ownerId, p_folder_id: folderId, p_new_parent_id: parentFolderId }));
    },

    async getItem(ownerId, itemId) {
      if (!isVaultId(itemId)) return null;
      const row = check(await db().from("vault_items").select(ITEM_COLUMNS)
        .eq("id", itemId).eq("owner_id", ownerId).is("deleted_at", null).maybeSingle()) as Row | null;
      return row ? toItem(row) : null;
    },

    async getItemObject(ownerId, itemId) {
      if (!isVaultId(itemId)) return null;
      const row = check(await db().from("vault_items").select(`${ITEM_COLUMNS},vault_objects(bucket,object_key)`)
        .eq("id", itemId).eq("owner_id", ownerId).is("deleted_at", null).maybeSingle()) as Row | null;
      if (!row?.vault_objects) return null;
      return { item: toItem(row), bucket: row.vault_objects.bucket, objectKey: row.vault_objects.object_key };
    },

    async updateItem(ownerId, itemId, patch) {
      const item = await this.getItem(ownerId, itemId);
      if (!item) throw new VaultError("not_found", "That file no longer exists.");
      const update: Row = {};
      const targetFolder = patch.folderId !== undefined ? patch.folderId : item.folderId;
      if (patch.folderId !== undefined && !(await liveFolderExists(ownerId, patch.folderId))) {
        throw new VaultError("not_found", "That folder no longer exists.");
      }
      if (patch.filename !== undefined || patch.folderId !== undefined) {
        const desired = patch.filename ?? item.filename;
        update.filename = await uniqueName(ownerId, targetFolder, desired, "file", itemId);
        update.extension = extensionOf(update.filename);
        update.folder_id = targetFolder;
      }
      if (patch.isStarred !== undefined) update.is_starred = patch.isStarred;
      if (Object.keys(update).length === 0) return item;
      const row = check(await db().from("vault_items").update(update)
        .eq("id", itemId).eq("owner_id", ownerId).is("deleted_at", null).select(ITEM_COLUMNS).single()) as Row;
      return toItem(row);
    },

    async copyItem(ownerId, itemId, folderId, limitBytes, otherUsedBytes) {
      return check(await db().rpc("vault_copy_item", {
        p_owner: ownerId, p_item_id: itemId, p_target_folder_id: folderId, p_limit_bytes: limitBytes, p_other_used_bytes: otherUsedBytes,
      })) as string;
    },

    async trash(ownerId, kind, id) {
      check(await db().rpc("vault_trash", { p_owner: ownerId, p_kind: kind, p_id: id }));
    },

    async restore(ownerId, kind, id) {
      check(await db().rpc("vault_restore", { p_owner: ownerId, p_kind: kind, p_id: id }));
    },

    async purge(ownerId, trashRootId) {
      return Number(check(await db().rpc("vault_purge", { p_owner: ownerId, p_trash_root_id: trashRootId }))) || 0;
    },

    async listTrash(ownerId) {
      // Only what the user deleted directly; contents of a deleted folder travel with it.
      const [items, folders] = await Promise.all([
        db().from("vault_items").select("id,filename,size_bytes,mime_type,deleted_at,trash_root_id")
          .eq("owner_id", ownerId).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(1000),
        db().from("vault_folders").select("id,name,deleted_at,trash_root_id")
          .eq("owner_id", ownerId).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(1000),
      ]);
      const files = (check(items) as Row[]).filter((row) => row.trash_root_id === row.id).map((row): TrashEntry => ({
        kind: "file", id: row.id, name: row.filename, sizeBytes: Number(row.size_bytes) || 0, mimeType: row.mime_type, deletedAt: row.deleted_at,
      }));
      const dirs = (check(folders) as Row[]).filter((row) => row.trash_root_id === row.id).map((row): TrashEntry => ({
        kind: "folder", id: row.id, name: row.name, sizeBytes: null, mimeType: null, deletedAt: row.deleted_at,
      }));
      return [...dirs, ...files].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    },

    listRecent: (ownerId, limit) => listItems(ownerId, (query) => query.order("updated_at", { ascending: false }), limit),
    listStarred: (ownerId, limit) => listItems(ownerId, (query) => query.eq("is_starred", true).order("updated_at", { ascending: false }), limit),
    search(ownerId, query, limit) {
      const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      return listItems(ownerId, (q) => q.ilike("filename", pattern).order("updated_at", { ascending: false }), limit);
    },

    async canManageEvent(userId, email, eventId) {
      return Boolean(check(await db().rpc("vault_user_can_manage_event", { p_user_id: userId, p_email: email, p_event_id: eventId })));
    },

    async getEventMedia(photoIds) {
      if (photoIds.length === 0) return [];
      const rows = check(await db().from("photos").select("id,event_id,storage_key,media_type,resource_type,format,status,tags")
        .in("id", photoIds)) as Row[];
      return rows.map((row) => ({
        id: row.id,
        eventId: row.event_id,
        storageKey: row.storage_key,
        mediaType: row.media_type ?? null,
        resourceType: row.resource_type ?? null,
        format: row.format ?? null,
        status: row.status ?? null,
        tags: Array.isArray(row.tags) ? row.tags : [],
      }));
    },

    async listExpiredUploads(limit) {
      const rows = check(await db().from("vault_uploads").select("id").eq("status", "pending")
        .lt("expires_at", new Date().toISOString()).limit(limit)) as Row[];
      return rows.map((row) => ({ id: row.id }));
    },

    async purgeExpiredTrash(retentionDays, limit) {
      return Number(check(await db().rpc("vault_purge_expired_trash", { p_older_than: `${retentionDays} days`, p_limit: limit }))) || 0;
    },

    async listDeletableObjects(limit) {
      const rows = check(await db().from("vault_objects").select("id,bucket,object_key")
        .not("delete_pending_since", "is", null).eq("ref_count", 0).limit(limit)) as Row[];
      return rows.map((row) => ({ id: row.id, bucket: row.bucket, objectKey: row.object_key }));
    },

    async deleteObjectRow(objectId) {
      check(await db().from("vault_objects").delete().eq("id", objectId).eq("ref_count", 0));
    },
  };
}
