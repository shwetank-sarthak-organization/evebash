import { createUploadTask, FileSystemUploadType } from 'expo-file-system/legacy';
import { supabase } from './supabase';

// Album proofing: the photographer uploads album page designs, the client reviews them (backend: /api/v1/albums).
// Same API as the website (src/lib/albumApi.ts).

export type AlbumStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved';
export type AlbumPageStatus = 'draft' | 'pending' | 'approved' | 'changes_requested';
export type AlbumPageLayout = 'spread' | 'single';
export type AlbumCommentKind = 'replace' | 'bigger' | 'smaller' | 'edit' | 'remove' | 'note';
/** The photographer uploads and sends rounds, the client reviews, everyone else (host, other admins) only views. */
export type AlbumRole = 'photographer' | 'client' | 'viewer';
/** Someone who can be given a role: the event host or a guest with Admin Access. */
export type AlbumRoleCandidate = { id: string; name: string; email: string | null; isHost: boolean };
export type AlbumRoles = { photographerId: string; clientIds: string[] };

export type AlbumPhoto = { id: string; eventId: string; thumbnailUrl: string | null; previewUrl: string | null };

export type AlbumSummary = {
  id: string;
  eventId: string;
  title: string;
  status: AlbumStatus;
  currentRound: number;
  pageCount: number;
  approvedCount: number;
  changesCount: number;
  unsentCount: number;
  openRequestCount: number;
  myDraftCount: number;
  myRole: AlbumRole;
  rolesAssigned: boolean;
  coverThumbnailUrl: string | null;
  createdBy: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  updatedAt: string;
};

export type AlbumComment = {
  id: string;
  version: number;
  parentId: string | null;
  authorId: string;
  authorName: string;
  kind: AlbumCommentKind;
  pinX: number | null;
  pinY: number | null;
  body: string | null;
  voiceUrl: string | null;
  voiceSeconds: number | null;
  replacementPhoto: AlbumPhoto | null;
  status: 'open' | 'done';
  isDraft: boolean;
  sentAt: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type AlbumPageVersion = {
  version: number;
  /** 0 until it is sent for review */
  round: number;
  fileName: string | null;
  previewUrl: string;
  thumbnailUrl: string;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type AlbumPage = {
  id: string;
  position: number;
  layout: AlbumPageLayout;
  status: AlbumPageStatus;
  sentVersion: number | null;
  latestVersion: number;
  approvedVersion: number | null;
  approvedByName: string | null;
  approvedAt: string | null;
  versions: AlbumPageVersion[];
  comments: AlbumComment[];
};

export type AlbumRound = { number: number; sentBy: string | null; sentByName: string | null; sentAt: string; pageCount: number; updatedPageCount: number };

export type AlbumDetail = AlbumSummary & {
  viewer: { id: string; isCreator: boolean; role: AlbumRole };
  roles: { photographer: { id: string; name: string } | null; clients: { id: string; name: string }[] };
  rounds: AlbumRound[];
  pages: AlbumPage[];
};

export type NewAlbumComment = {
  kind?: AlbumCommentKind;
  pinX?: number | null;
  pinY?: number | null;
  body?: string | null;
  replacementPhotoId?: string | null;
  parentId?: string | null;
  version?: number;
};

/** A local file to upload: a page design or a voice note. */
export type LocalFile = { uri: string; name: string; mimeType: string; size?: number | null };

export const ALBUM_MAX_PAGE_BYTES = 60 * 1024 * 1024;
export const ALBUM_MAX_VOICE_SECONDS = 120;

export class AlbumApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function apiBase() {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base) throw new AlbumApiError(0, 'configuration', 'Album proofing is not configured in this app build.');
  return `${base}/api/v1/albums`;
}

async function token() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new AlbumApiError(401, 'unauthenticated', 'Please sign in to use album proofing.');
  return accessToken;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${apiBase()}${path}`;
  const accessToken = await token();
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AlbumApiError(0, 'network', "Couldn't reach EveBash. Check your connection and try again.");
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    throw new AlbumApiError(response.status, json.code || 'error', json.error || 'Something went wrong. Please try again.');
  }
  return json as T;
}

/** Sends a local file as the raw request body, streamed natively, reporting progress from 0 to 1. */
async function uploadFile<T>(method: 'POST' | 'PUT', path: string, file: LocalFile, onProgress?: (fraction: number) => void): Promise<T> {
  const url = `${apiBase()}${path}`;
  const accessToken = await token();
  const task = createUploadTask(
    url,
    file.uri,
    {
      httpMethod: method,
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': file.mimeType || 'application/octet-stream' },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) onProgress?.(totalBytesSent / totalBytesExpectedToSend);
    },
  );
  let result: Awaited<ReturnType<typeof task.uploadAsync>>;
  try {
    result = await task.uploadAsync();
  } catch {
    throw new AlbumApiError(0, 'network', 'The upload stopped. Check your connection and try again.');
  }
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(result?.body || '{}'); } catch { /* not JSON */ }
  if (!result || result.status < 200 || result.status >= 300 || json.success === false) {
    throw new AlbumApiError(result?.status ?? 0, String(json.code || 'error'), String(json.error || 'The upload failed. Please try again.'));
  }
  return json as T;
}

let enabledCheck: Promise<boolean> | null = null;

export const albumApi = {
  /** Whether the backend has album proofing switched on (checked once per app start). */
  enabled: () => {
    enabledCheck ??= (async () => {
      try {
        const response = await fetch(`${apiBase()}/enabled`);
        const json = await response.json();
        return json?.enabled === true;
      } catch {
        enabledCheck = null;
        return false;
      }
    })();
    return enabledCheck;
  },
  list: (eventId: string) => request<{ albums: AlbumSummary[] }>('GET', `/?eventId=${encodeURIComponent(eventId)}`),
  candidates: (eventId: string) => request<{ candidates: AlbumRoleCandidate[] }>('GET', `/candidates?eventId=${encodeURIComponent(eventId)}`),
  create: (eventId: string, title: string, roles: AlbumRoles) => request<{ album: AlbumDetail }>('POST', '/', { eventId, title, ...roles }),
  setRoles: (albumId: string, roles: AlbumRoles) => request<{ album: AlbumDetail }>('PUT', `/${albumId}/roles`, roles),
  get: (albumId: string) => request<{ album: AlbumDetail }>('GET', `/${albumId}`),
  rename: (albumId: string, title: string) => request<{ album: AlbumDetail }>('PATCH', `/${albumId}`, { title }),
  remove: (albumId: string) => request('DELETE', `/${albumId}`),
  favourites: (albumId: string) => request<{ photos: AlbumPhoto[] }>('GET', `/${albumId}/favourites`),

  uploadPage: (albumId: string, file: LocalFile, onProgress?: (fraction: number) => void) =>
    uploadFile<{ page: { id: string } }>('POST', `/${albumId}/pages?fileName=${encodeURIComponent(file.name)}`, file, onProgress),
  uploadVersion: (albumId: string, pageId: string, file: LocalFile, onProgress?: (fraction: number) => void) =>
    uploadFile('POST', `/${albumId}/pages/${pageId}/versions?fileName=${encodeURIComponent(file.name)}`, file, onProgress),
  setLayout: (albumId: string, pageId: string, layout: AlbumPageLayout) =>
    request<{ album: AlbumDetail }>('PATCH', `/${albumId}/pages/${pageId}`, { layout }),
  removePage: (albumId: string, pageId: string) => request<{ album: AlbumDetail }>('DELETE', `/${albumId}/pages/${pageId}`),
  reorder: (albumId: string, pageIds: string[]) => request<{ album: AlbumDetail }>('PUT', `/${albumId}/order`, { pageIds }),

  send: (albumId: string) => request<{ album: AlbumDetail }>('POST', `/${albumId}/send`),
  sendFeedback: (albumId: string) => request<{ album: AlbumDetail; sent: number }>('POST', `/${albumId}/feedback`),
  approvePage: (albumId: string, pageId: string, approved: boolean) =>
    request<{ album: AlbumDetail }>('POST', `/${albumId}/pages/${pageId}/approval`, { approved }),
  approve: (albumId: string) => request<{ album: AlbumDetail }>('POST', `/${albumId}/approve`),
  reopen: (albumId: string) => request<{ album: AlbumDetail }>('POST', `/${albumId}/reopen`),

  addComment: (albumId: string, pageId: string, comment: NewAlbumComment) =>
    request<{ comment: AlbumComment }>('POST', `/${albumId}/pages/${pageId}/comments`, comment),
  setCommentStatus: (albumId: string, commentId: string, status: 'open' | 'done') =>
    request<{ comment: AlbumComment }>('PATCH', `/${albumId}/comments/${commentId}`, { status }),
  removeComment: (albumId: string, commentId: string) => request('DELETE', `/${albumId}/comments/${commentId}`),
  attachVoice: (albumId: string, commentId: string, recording: LocalFile, seconds: number) =>
    uploadFile<{ comment: AlbumComment }>('PUT', `/${albumId}/comments/${commentId}/voice?seconds=${seconds.toFixed(1)}`, recording),
};

/** "Page 3" or "Pages 4–5": a spread shows two album pages. */
export function albumPageLabels(pages: Pick<AlbumPage, 'layout'>[]) {
  let next = 1;
  return pages.map((page) => {
    const first = next;
    next += page.layout === 'spread' ? 2 : 1;
    return page.layout === 'spread' ? `Pages ${first}–${first + 1}` : `Page ${first}`;
  });
}

export const ALBUM_COMMENT_KINDS: { id: AlbumCommentKind; label: string }[] = [
  { id: 'replace', label: 'Replace photo' },
  { id: 'bigger', label: 'Make bigger' },
  { id: 'smaller', label: 'Make smaller' },
  { id: 'edit', label: 'Edit photo' },
  { id: 'remove', label: 'Remove' },
  { id: 'note', label: 'Other' },
];

export const albumCommentKindLabel = (kind: AlbumCommentKind) => ALBUM_COMMENT_KINDS.find((k) => k.id === kind)?.label ?? 'Comment';

/** Numbered pins follow the order requests were made on the page, so "pin 3" means the same thing to everyone. */
export function pinNumbers(comments: AlbumComment[]) {
  const numbers = new Map<string, number>();
  comments
    .filter((c) => !c.parentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((c, i) => numbers.set(c.id, i + 1));
  return numbers;
}

/** Files in the order a designer numbers them: "2.jpg" before "10.jpg". */
export function sortByFileName<T extends { name: string }>(files: T[]) {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

export function formatSeconds(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
