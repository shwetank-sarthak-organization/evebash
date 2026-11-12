// Website and app (one copy): the time shown next to a photo comment.

/**
 * "4:05 pm" for today, "3 Nov, 4:05 pm" earlier this year, "3 Nov 2025" for older years.
 * Takes the comment's created_at text; returns "Now" when it is missing or unreadable.
 */
export function formatCommentTime(value?: string | null, now: Date = new Date()): string {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Now';

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) return time;
  if (date.getFullYear() !== now.getFullYear()) {
    return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}
