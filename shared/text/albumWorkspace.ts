// Website and app (one copy): the plain-words state of an album and its pages on the album screen.

import type { AlbumNextStepTone } from './albumNextStep';

type Mode = 'photographer' | 'client' | 'viewer';

type PageFacts = {
  status: 'draft' | 'pending' | 'approved' | 'changes_requested';
  sentVersion: number | null;
  latestVersion: number;
  comments: { parentId: string | null; isDraft: boolean; status: string; authorId: string }[];
};

type AlbumFacts = {
  status: 'draft' | 'in_review' | 'changes_requested' | 'approved';
  currentRound: number;
  pageCount: number;
  approvedCount: number;
  unsentCount: number;
  openRequestCount: number;
  myDraftCount: number;
  rolesAssigned: boolean;
  approvedAt: string | null;
  approvedByName: string | null;
  roles: { photographer: { name: string } | null; clients: { name: string }[] };
};

/** One page's state as its viewer should read it. */
export type AlbumPageState = 'approved' | 'unsent' | 'fix' | 'waiting' | 'check' | 'commented';

/** label: on the page and its tab; counted: after a number in the summary line ("3 to check"). */
export const ALBUM_PAGE_STATE: Record<AlbumPageState, { label: string; counted: string; tone: AlbumNextStepTone }> = {
  approved: { label: 'Approved', counted: 'approved', tone: 'done' },
  unsent: { label: 'Not sent', counted: 'not sent', tone: 'waiting' },
  fix: { label: 'To fix', counted: 'to fix', tone: 'urgent' },
  waiting: { label: 'With client', counted: 'with client', tone: 'action' },
  check: { label: 'To check', counted: 'to check', tone: 'action' },
  commented: { label: 'Changes asked', counted: 'with changes asked', tone: 'urgent' },
};

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const names = (people: { name: string }[]) => people.map((p) => p.name.split(' ')[0]).join(' and ');

export const formatAlbumDay = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function albumPageState(page: PageFacts, mode: Mode, viewerId: string): AlbumPageState {
  if (page.status === 'approved') return 'approved';
  if (mode === 'photographer') {
    if (page.latestVersion > (page.sentVersion ?? 0)) return 'unsent';
    return page.status === 'changes_requested' ? 'fix' : 'waiting';
  }
  const myDrafts = page.comments.some((c) => !c.parentId && c.isDraft && c.authorId === viewerId);
  if (page.status === 'changes_requested' || myDrafts) return 'commented';
  return mode === 'client' ? 'check' : 'waiting';
}

/** The tabs above the pages, in order, for each side. "all" is always first. */
export const ALBUM_PAGE_FILTERS: Record<Mode, { id: 'all' | AlbumPageState; label: string }[]> = {
  photographer: [{ id: 'all', label: 'All' }, { id: 'fix', label: 'To fix' }, { id: 'unsent', label: 'Not sent' }, { id: 'waiting', label: 'With client' }, { id: 'approved', label: 'Approved' }],
  client: [{ id: 'all', label: 'All' }, { id: 'check', label: 'To check' }, { id: 'commented', label: 'Changes asked' }, { id: 'approved', label: 'Approved' }],
  viewer: [{ id: 'all', label: 'All' }, { id: 'waiting', label: 'With client' }, { id: 'commented', label: 'Changes asked' }, { id: 'approved', label: 'Approved' }],
};

/** Width over height of a page as uploaded; a guess from its layout when the size is unknown. Kept between 0.5 and 3. */
export function albumPageRatio(version: { width: number | null; height: number | null } | undefined, layout: 'spread' | 'single'): number {
  const ratio = version?.width && version.height ? version.width / version.height : layout === 'spread' ? 2 : 0.75;
  return Math.min(Math.max(ratio, 0.5), 3);
}

export const ALBUM_STEPS = ['Upload pages', 'Send to client', 'Client reviews', 'Approved for print'] as const;

/** Index into ALBUM_STEPS of the step the album is on; ALBUM_STEPS.length when it is approved. */
export function albumStep(album: AlbumFacts): number {
  if (album.status === 'approved') return ALBUM_STEPS.length;
  if (album.currentRound > 0) return 2;
  return album.pageCount === 0 ? 0 : 1;
}

/** The "what now" box at the top of the album: a headline and one line under it. */
export function albumWorkspaceStatus(album: AlbumFacts, mode: Mode, toCheck: number): { title: string; detail: string; tone: AlbumNextStepTone } {
  const client = album.roles.clients.length ? names(album.roles.clients) : 'the client';
  const photographer = album.roles.photographer ? names([album.roles.photographer]) : 'the photographer';

  if (album.status === 'approved') {
    const when = album.approvedAt ? ` on ${formatAlbumDay(album.approvedAt)}` : '';
    return { title: 'Approved for print', detail: `Approved by ${album.approvedByName ?? client}${when}. It can be reopened from the ⋯ menu if something needs to change.`, tone: 'done' };
  }
  if (!album.rolesAssigned) return { title: 'Assign the photographer and the client', detail: 'Nothing can be uploaded or reviewed until then.', tone: 'action' };

  if (mode === 'photographer') {
    if (album.pageCount === 0) return { title: 'Add the album pages', detail: 'Drop the page designs here or use Add pages: one image per page or per spread.', tone: 'action' };
    if (album.openRequestCount > 0) return { title: `${count(album.openRequestCount, 'change')} to make`, detail: `Open each page, upload a new version, then send the pages back to ${client}.`, tone: 'urgent' };
    if (album.unsentCount > 0) {
      return album.currentRound === 0
        ? { title: `Ready to send ${count(album.unsentCount, 'page')}`, detail: `${client} gets a notification and can comment on each page.`, tone: 'action' }
        : { title: `${count(album.unsentCount, 'page')} ready to send back`, detail: `${client} gets a notification and sees which pages changed.`, tone: 'action' };
    }
    return { title: `Waiting for ${client} to review`, detail: "You'll get a notification when they send feedback. Nothing to do right now.", tone: 'waiting' };
  }

  if (mode === 'client') {
    if (album.currentRound === 0) return { title: 'Nothing to review yet', detail: `You'll get a notification when ${photographer} sends the pages.`, tone: 'waiting' };
    if (album.pageCount > 0 && album.approvedCount === album.pageCount && album.unsentCount === 0) {
      return { title: 'Every page is approved', detail: 'Approve the album to lock it for print.', tone: 'done' };
    }
    if (toCheck > 0) return { title: `Check ${count(toCheck, 'page')}`, detail: 'Open a page and tap the photo to leave a note, or approve it. Send your notes when you are done.', tone: 'action' };
    if (album.myDraftCount > 0) return { title: `${count(album.myDraftCount, 'note')} not sent yet`, detail: `Send them so ${photographer} can start on the changes.`, tone: 'action' };
    return { title: 'Waiting for new versions', detail: `${photographer} is working on your changes. You'll get a notification.`, tone: 'waiting' };
  }

  return {
    title: album.currentRound > 0 ? `Round ${album.currentRound} with ${client}` : 'Not sent for review yet',
    detail: "View only: you're not the photographer or the client in this album.",
    tone: 'waiting',
  };
}
