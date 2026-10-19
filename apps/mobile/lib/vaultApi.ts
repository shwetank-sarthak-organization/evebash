import { supabase } from './supabase';

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
  /** Outside the retained 1 GB while a paid plan is expired. */
  atRisk?: boolean;
};

export type VaultTrashEntry = {
  kind: 'file' | 'folder';
  id: string;
  name: string;
  sizeBytes: number | null;
  mimeType: string | null;
  deletedAt: string;
  permanentlyDeletedOn: string;
};

export type VaultUsage = {
  limitBytes: number | null;
  usedBytes: { events: number; vault: number; total: number };
  reservedBytes: number;
  maxFileBytes: number;
  overLimit: boolean;
  uploadsBlocked: null | 'plan_expired' | 'storage_full';
  plan: { state: 'active' | 'grace' | 'hidden' | 'deleting'; expiredOn: string | null; graceEndsOn: string | null; deletionOn: string | null };
};

export type VaultUploadStart =
  | { uploadId: string; mode: 'single'; url: string; headers: Record<string, string> }
  | { uploadId: string; mode: 'multipart'; partSize: number; partCount: number };

export class VaultApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new VaultApiError(401, 'unauthenticated', 'Please sign in to use EB Vault.');

  // Vault belongs to the authenticated backend, never to a media-upload override.
  // Require an explicit environment so private files cannot cross into another backend.
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (!apiBase) {
    throw new VaultApiError(0, 'configuration', 'EB Vault is not configured in this app build. Please contact support.');
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/v1/vault${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new VaultApiError(0, 'network', "Couldn't reach EB Vault. Check your connection and try again.");
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    throw new VaultApiError(response.status, json.code || 'error', json.error || 'Something went wrong. Please try again.');
  }
  return json as T;
}

type ItemList = { items: VaultItem[]; hiddenCount: number };

export const vaultApi = {
  usage: () => request<VaultUsage>('GET', '/usage'),
  children: (folderId: string | null) => request<ItemList & {
    folder: VaultFolder | null;
    breadcrumbs: { id: string; name: string }[];
    folders: VaultFolder[];
  }>('GET', `/folders/${folderId ?? 'root'}/children`),
  recent: () => request<ItemList>('GET', '/recent'),
  starred: () => request<ItemList>('GET', '/starred'),
  search: (q: string) => request<ItemList>('GET', `/search?q=${encodeURIComponent(q)}`),
  trash: () => request<{ entries: VaultTrashEntry[]; retentionDays: number }>('GET', '/trash'),

  createFolder: (name: string, parentFolderId: string | null) =>
    request<{ folder: VaultFolder }>('POST', '/folders', { name, parentFolderId }),
  updateFolder: (id: string, patch: { name?: string; parentFolderId?: string | null }) =>
    request<{ folder: VaultFolder }>('PATCH', `/folders/${id}`, patch),
  trashFolder: (id: string) => request('DELETE', `/folders/${id}`),

  updateItem: (id: string, patch: { filename?: string; folderId?: string | null; isStarred?: boolean }) =>
    request<{ item: VaultItem }>('PATCH', `/items/${id}`, patch),
  copyItem: (id: string, folderId: string | null) => request<{ item: VaultItem }>('POST', `/items/${id}/copy`, { folderId }),
  trashItem: (id: string) => request('DELETE', `/items/${id}`),
  link: (id: string, mode: 'view' | 'download') => request<{ url: string; expiresInSeconds: number }>('GET', `/items/${id}/link?mode=${mode}`),

  restore: (kind: 'file' | 'folder', id: string) => request('POST', '/trash/restore', { kind, id }),
  deleteForever: (kind: 'file' | 'folder', id: string) => request<{ freedBytes: number }>('DELETE', `/trash/${kind}/${id}`),
  emptyTrash: () => request<{ freedBytes: number }>('DELETE', '/trash'),

  /** Copies event photos/videos (by photo id) into the caller's Vault. Only event managers may do this. */
  saveFromEvent: (photoIds: string[], folderId: string | null) =>
    request<{ saved: { photoId: string; item: VaultItem | null }[]; failed: { photoId: string; error: string }[] }>(
      'POST', '/save-from-event', { photoIds, folderId }),

  startUpload: (input: { filename: string; sizeBytes: number; mimeType: string; folderId: string | null }) =>
    request<VaultUploadStart>('POST', '/uploads', input),
  partUrls: (uploadId: string, partNumbers: number[]) =>
    request<{ parts: { partNumber: number; url: string }[] }>('POST', `/uploads/${uploadId}/parts`, { partNumbers }),
  completeUpload: (uploadId: string, parts?: { partNumber: number; etag: string }[]) =>
    request<{ item: VaultItem }>('POST', `/uploads/${uploadId}/complete`, parts ? { parts } : {}),
  abortUpload: (uploadId: string) => request('POST', `/uploads/${uploadId}/abort`),
};

/** Website that hosts the in-app PDF viewer: staging builds use the staging site. */
export function getVaultWebBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').includes('staging') ? 'https://staging.evebash.com' : 'https://www.evebash.com';
}
