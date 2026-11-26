// Home (Primary Gallery) shows the event's favourites plus what was uploaded to Home itself (website and app).
// Un-starring takes a photo off Home at once, unless it was uploaded to Home: then it stays, only without its star.

type HomeItem = { id: string; eventId?: string | null };

/** Whether this photo was uploaded to Home itself (its gallery is the main event, by id or legacy id). */
export function isHomeUpload(item: HomeItem, homeIds: Array<string | null | undefined>): boolean {
  return !!item.eventId && homeIds.some(id => !!id && id === item.eventId);
}

/** The Home list after un-starring a photo, and the item taken off (null when it stays or wasn't shown). */
export function homeAfterUnstar<T extends HomeItem>(items: T[], photoId: string, homeIds: Array<string | null | undefined>): { items: T[]; removed: T | null } {
  const item = items.find(entry => entry.id === photoId);
  if (!item || isHomeUpload(item, homeIds)) return { items, removed: null };
  return { items: items.filter(entry => entry.id !== photoId), removed: item };
}
