/**
 * Shared spacing and corner-radius scale for the app's own screens (not event themes).
 * New and refactored UI should pick from these instead of one-off numbers.
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  /** Standard horizontal page margin */
  page: 24,
} as const;

export const Radius = {
  /** Tiny marks, progress tracks */
  xs: 4,
  /** Badges, small chips */
  sm: 8,
  /** Inputs, compact buttons */
  md: 12,
  /** Buttons, cards */
  lg: 16,
  /** Large cards, dialogs */
  xl: 20,
  xxl: 24,
  /** Bottom sheets */
  sheet: 28,
  pill: 999,
} as const;
