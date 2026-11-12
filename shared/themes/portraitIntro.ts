import { eventDateValue } from '../text/eventDate';

// Sunlit Portrait (website and app): the small line before the date on the cover, by the main event's category. A
// wedding whose date has passed reads "Happily married since <date>"; before it, and on the wedding day itself,
// "We're getting married".

export function portraitIntro(category?: string, mainDate?: string): string {
  if (category === 'Wedding') {
    const weddingDay = eventDateValue(mainDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return weddingDay !== null && weddingDay < today.getTime() ? 'Happily married since' : "We're getting married";
  }
  if (category === 'Anniversary') return 'Still choosing each other';
  return '';
}

/** "Happily married since 29 September 2026" reads as one phrase: no heart between the line and the date */
export function portraitIntroJoinsDate(intro: string): boolean {
  return intro.endsWith('since');
}
