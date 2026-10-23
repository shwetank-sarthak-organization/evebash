import type { AlbumRow, CommentRow, EventPhoto, PageRow, RoundRow, VersionRow } from "./repository.js";

export type PageStatus = "draft" | "pending" | "approved" | "changes_requested";
export type AlbumStatus = "draft" | "in_review" | "changes_requested" | "approved";

type Lookup = {
  url: (key: string) => string;
  names: Map<string, string>;
  photos: Map<string, EventPhoto>;
};

/** The newest version sent for review, or null while the page has never been sent. */
export function sentVersionOf(versions: VersionRow[]) {
  return versions.reduce<number | null>((latest, v) => (v.round > 0 && (latest === null || v.version > latest) ? v.version : latest), null);
}

/** Comments asking for a change that the photographer hasn't marked done (sent, top-level only). */
export function openRequests(comments: CommentRow[]) {
  return comments.filter((c) => !c.parentId && c.sentAt && c.status === "open");
}

export function pageStatus(page: PageRow, versions: VersionRow[], comments: CommentRow[]): PageStatus {
  const sent = sentVersionOf(versions);
  if (sent === null) return "draft";
  if (openRequests(comments).length) return "changes_requested";
  if (page.approvedVersion === sent) return "approved";
  return "pending";
}

export function albumStatus(album: AlbumRow, pageStatuses: PageStatus[]): AlbumStatus {
  if (album.approvedAt) return "approved";
  if (album.currentRound === 0) return "draft";
  if (pageStatuses.includes("changes_requested")) return "changes_requested";
  return "in_review";
}

const by = <T, K>(items: T[], key: (item: T) => K) => {
  const map = new Map<K, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
};

/** Drafts are shown to their author only. */
export function visibleComments(comments: CommentRow[], viewerId: string) {
  return comments.filter((c) => c.sentAt || c.authorId === viewerId);
}

function presentComment(c: CommentRow, { url, names, photos }: Lookup) {
  const replacement = c.replacementPhotoId ? photos.get(c.replacementPhotoId) ?? null : null;
  return {
    id: c.id,
    version: c.version,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: names.get(c.authorId) ?? "Someone",
    kind: c.kind,
    pinX: c.pinX,
    pinY: c.pinY,
    body: c.body,
    voiceUrl: c.voiceKey ? url(c.voiceKey) : null,
    voiceSeconds: c.voiceSeconds,
    replacementPhoto: replacement,
    status: c.status,
    isDraft: !c.sentAt,
    sentAt: c.sentAt,
    resolvedByName: c.resolvedBy ? names.get(c.resolvedBy) ?? "Someone" : null,
    resolvedAt: c.resolvedAt,
    createdAt: c.createdAt,
  };
}

export type AlbumData = {
  album: AlbumRow;
  pages: PageRow[];
  versions: VersionRow[];
  comments: CommentRow[];
};

/** Summary for the album list: status, progress and a cover thumbnail. */
export function presentAlbumSummary({ album, pages, versions, comments }: AlbumData, lookup: Pick<Lookup, "url" | "names">, viewerId: string) {
  const versionsByPage = by(versions, (v) => v.pageId);
  const commentsByPage = by(visibleComments(comments, viewerId), (c) => c.pageId);
  const statuses = pages.map((p) => pageStatus(p, versionsByPage.get(p.id) ?? [], commentsByPage.get(p.id) ?? []));
  const first = pages[0] ? (versionsByPage.get(pages[0].id) ?? []).at(-1) : undefined;
  return {
    id: album.id,
    eventId: album.eventId,
    title: album.title,
    status: albumStatus(album, statuses),
    currentRound: album.currentRound,
    pageCount: pages.length,
    approvedCount: statuses.filter((s) => s === "approved").length,
    changesCount: statuses.filter((s) => s === "changes_requested").length,
    unsentCount: pages.filter((p) => (versionsByPage.get(p.id) ?? []).some((v) => v.round === 0)).length,
    openRequestCount: openRequests(comments).length,
    myDraftCount: comments.filter((c) => !c.sentAt && c.authorId === viewerId).length,
    coverThumbnailUrl: first ? lookup.url(first.thumbnailKey) : null,
    createdBy: album.createdBy,
    approvedAt: album.approvedAt,
    approvedByName: album.approvedBy ? lookup.names.get(album.approvedBy) ?? "Someone" : null,
    updatedAt: album.updatedAt,
  };
}

/** Everything the album screen shows: pages with every version, comments (drafts only to their author) and rounds. */
export function presentAlbum(data: AlbumData, rounds: RoundRow[], lookup: Lookup, viewerId: string) {
  const versionsByPage = by(data.versions, (v) => v.pageId);
  const commentsByPage = by(visibleComments(data.comments, viewerId), (c) => c.pageId);
  return {
    ...presentAlbumSummary(data, lookup, viewerId),
    viewer: { id: viewerId, isCreator: data.album.createdBy === viewerId },
    rounds: rounds.map((r) => ({ ...r, sentByName: r.sentBy ? lookup.names.get(r.sentBy) ?? "Someone" : null })),
    pages: data.pages.map((p) => {
      const versions = versionsByPage.get(p.id) ?? [];
      const comments = commentsByPage.get(p.id) ?? [];
      return {
        id: p.id,
        position: p.position,
        layout: p.layout,
        status: pageStatus(p, versions, comments),
        sentVersion: sentVersionOf(versions),
        latestVersion: versions.at(-1)?.version ?? 0,
        approvedVersion: p.approvedVersion,
        approvedByName: p.approvedBy ? lookup.names.get(p.approvedBy) ?? "Someone" : null,
        approvedAt: p.approvedAt,
        versions: versions.map((v) => ({
          version: v.version,
          round: v.round,
          fileName: v.fileName,
          previewUrl: lookup.url(v.previewKey),
          thumbnailUrl: lookup.url(v.thumbnailKey),
          width: v.width,
          height: v.height,
          createdAt: v.createdAt,
        })),
        comments: comments.map((c) => presentComment(c, lookup)),
      };
    }),
  };
}

/** Profiles and photos the album screen names or shows. */
export function referencedIds(data: AlbumData, rounds: RoundRow[]) {
  const profiles = new Set<string>();
  const photos = new Set<string>();
  const add = (id: string | null) => { if (id) profiles.add(id); };
  add(data.album.approvedBy);
  data.pages.forEach((p) => add(p.approvedBy));
  data.comments.forEach((c) => { add(c.authorId); add(c.resolvedBy); if (c.replacementPhotoId) photos.add(c.replacementPhotoId); });
  rounds.forEach((r) => add(r.sentBy));
  return { profiles: [...profiles], photos: [...photos] };
}
