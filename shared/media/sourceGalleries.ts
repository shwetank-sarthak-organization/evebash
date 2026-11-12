// Website and app: the "Source gallery" filter on the host's Home (Primary Gallery). Home lists the favourites from
// every gallery (all loaded at once), then Home's own uploads, which load in pages. While pages are left, Home's
// count is only what's loaded so far, so it is marked "more" and shown as "N+" (issues #176 and #215).

type SourceGallery = { id: string; title?: string | null; legacyId?: string | null };

export interface SourceGalleryOption {
  id: string;
  label: string;
  legacyId?: string | null;
  count: number;
  /** More of this gallery's media may be in pages not loaded yet */
  more: boolean;
}

/** Whether a media item belongs to this gallery (by its id or its legacy id). */
export function isFromSourceGallery(item: { eventId?: string | null }, gallery: { id: string; legacyId?: string | null } | undefined): boolean {
  return !!gallery && (item.eventId === gallery.id || (!!gallery.legacyId && item.eventId === gallery.legacyId));
}

/** Home, then each sub-gallery that has media in `items`, with how many. */
export function buildSourceGalleryOptions(
  home: SourceGallery | null | undefined,
  subGalleries: SourceGallery[],
  items: { eventId?: string | null }[],
  hasMorePages: boolean,
): SourceGalleryOption[] {
  return [home, ...subGalleries]
    .filter((gallery): gallery is SourceGallery => !!gallery)
    .map(gallery => {
      const isHome = gallery.id === home?.id;
      return {
        id: gallery.id,
        label: isHome ? 'Home (Primary Gallery)' : gallery.title || '',
        legacyId: gallery.legacyId,
        count: items.filter(item => isFromSourceGallery(item, gallery)).length,
        more: isHome && hasMorePages,
      };
    })
    .filter(option => option.count > 0);
}

/** "17", or "17+" while more pages are left. */
export function formatSourceCount(count: number, more: boolean): string {
  return `${count}${more ? '+' : ''}`;
}
