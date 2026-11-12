import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes';
import { Cinzel_400Regular, Cinzel_600SemiBold } from '@expo-google-fonts/cinzel';
import { CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond';
import { useLazyFonts, type LazyFontSet } from '@/hooks/use-lazy-fonts';

// Royal Emerald's fonts, the same as the website (src/components/royal/royalFonts.ts). They load only when a Royal
// Emerald gallery opens, under their own names: app start-up maps the shared font names to Inter (app/_layout.tsx),
// and that stays as it is.
const NAMES = {
  script: 'RoyalGreatVibes',
  display: 'RoyalCinzel',
  displayBold: 'RoyalCinzelSemiBold',
  serif: 'RoyalCormorant',
  serifItalic: 'RoyalCormorantItalic',
} as const;

const SOURCES = {
  [NAMES.script]: GreatVibes_400Regular,
  [NAMES.display]: Cinzel_400Regular,
  [NAMES.displayBold]: Cinzel_600SemiBold,
  [NAMES.serif]: CormorantGaramond_500Medium,
  [NAMES.serifItalic]: CormorantGaramond_500Medium_Italic,
};

export type RoyalFontSet = LazyFontSet<keyof typeof NAMES>;

/** Loads the fonts when `enabled`; until they're ready (or if they fail) every name is the system serif font. */
export function useRoyalFonts(enabled: boolean): RoyalFontSet {
  return useLazyFonts(NAMES, SOURCES, enabled, 'RoyalFonts');
}
