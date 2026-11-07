// Website and app (one copy): reading an event's date. Event dates are stored as display text ("26 September 2026").

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Event dates are stored as display text ("26 September 2026"); returns a timestamp, or null if unreadable. */
export function eventDateValue(date?: string): number | null {
  const text = date?.trim();
  if (!text) return null;
  const verbal = text.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (verbal) {
    const month = MONTH_NAMES.findIndex((m) => verbal[2].toLowerCase().startsWith(m));
    if (month !== -1) return new Date(Number(verbal[3]), month, Number(verbal[1])).getTime();
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

/** The date as "2026-11-06" (what the website's date inputs use and save), or "" if unreadable. */
export function eventDateInputValue(date?: string): string {
  const text = date?.trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const value = eventDateValue(text);
  if (value === null) return '';
  const day = new Date(value);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
