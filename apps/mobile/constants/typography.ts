/**
 * Type scale for the app's own screens (not event themes).
 * Core screens use only these sizes; pick one instead of a one-off number.
 */
export const FontSize = {
  /** Tiny badges and counters only */
  micro: 10,
  caption: 11,
  footnote: 12,
  small: 13,
  body2: 14,
  body: 15,
  callout: 16,
  headline: 18,
  title3: 20,
  title2: 22,
  title1: 24,
  largeTitle: 28,
  /** Brand wordmarks */
  brand: 32,
  display: 40,
  hero: 48,
} as const;

export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
  /** The EveBash wordmark font */
  brand: 'AkayaKanadakaHeader_400Regular',
} as const;
