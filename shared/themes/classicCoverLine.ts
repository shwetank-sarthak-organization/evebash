// Classic White (website and app): the fixed line on the cover card, chosen by the gallery's category.
// The host's own gallery message is shown in the gallery header instead.
export function classicCoverLine(category?: string): string {
  if (category === 'Anniversary') return 'Still choosing each other, every year.';
  if (category === 'Wedding') return 'Two hearts, one holy union.';
  return 'Moments worth keeping, forever.';
}
