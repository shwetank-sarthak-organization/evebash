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
