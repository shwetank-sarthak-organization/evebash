// Website and app (one copy): the "next step" line on an Album Proofs card.

export type AlbumNextStepTone = 'action' | 'urgent' | 'waiting' | 'done';

export type AlbumNextStep = { label: string; tone: AlbumNextStepTone };

type AlbumCardFacts = {
  status: 'draft' | 'in_review' | 'changes_requested' | 'approved';
  myRole: 'photographer' | 'client' | 'viewer';
  rolesAssigned: boolean;
  currentRound: number;
  pageCount: number;
  approvedCount: number;
  changesCount: number;
  unsentCount: number;
  openRequestCount: number;
  myDraftCount: number;
  approvedAt: string | null;
};

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What the viewer should do next with this album, or what it is waiting on. Null for viewers with nothing to show. */
export function albumNextStep(album: AlbumCardFacts): AlbumNextStep | null {
  if (album.status === 'approved') {
    const date = album.approvedAt ? new Date(album.approvedAt) : null;
    const when = date && !Number.isNaN(date.getTime())
      ? ` ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      : '';
    return { label: `Approved${when} · ready for print`, tone: 'done' };
  }
  if (!album.rolesAssigned) return { label: 'Assign roles to start', tone: 'action' };
  if (album.myRole === 'viewer') return null;
  if (album.myDraftCount > 0) return { label: `Send ${count(album.myDraftCount, 'unsent comment')}`, tone: 'action' };

  const pagesLeft = album.pageCount - album.approvedCount;
  if (album.myRole === 'photographer') {
    if (album.pageCount === 0) return { label: 'Add page designs', tone: 'action' };
    if (album.openRequestCount > 0) return { label: `${count(album.openRequestCount, 'change')} to make`, tone: 'urgent' };
    if (album.unsentCount > 0) {
      return album.currentRound === 0
        ? { label: 'Send round 1 to the client', tone: 'action' }
        : { label: `Send ${count(album.unsentCount, 'new page')} to the client`, tone: 'action' };
    }
    return { label: `Waiting for the client · ${count(pagesLeft, 'page')} left`, tone: 'waiting' };
  }

  if (album.pageCount === 0 || album.currentRound === 0) return { label: 'Waiting for the page designs', tone: 'waiting' };
  const toReview = pagesLeft - album.changesCount;
  if (toReview > 0) return { label: `Review ${count(toReview, 'page')}`, tone: 'action' };
  return { label: 'Waiting for new versions', tone: 'waiting' };
}
