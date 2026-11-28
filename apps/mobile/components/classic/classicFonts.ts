import { PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display/400Regular';
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display/400Regular_Italic';
import { PlayfairDisplay_500Medium } from '@expo-google-fonts/playfair-display/500Medium';
import { useLazyFonts, type LazyFontSet } from '@/hooks/use-lazy-fonts';

// Classic White's serif, Playfair Display, the same as the website. The shared "Playfair" names are mapped to Inter
// at app start-up (app/_layout.tsx), so the real font loads under its own names when a Classic White gallery opens.
const NAMES = {
  serif: 'ClassicPlayfair',
  serifMedium: 'ClassicPlayfairMedium',
  serifItalic: 'ClassicPlayfairItalic',
} as const;

const SOURCES = {
  [NAMES.serif]: PlayfairDisplay_400Regular,
  [NAMES.serifMedium]: PlayfairDisplay_500Medium,
  [NAMES.serifItalic]: PlayfairDisplay_400Regular_Italic,
};

export type ClassicFontSet = LazyFontSet<keyof typeof NAMES>;

export function useClassicFonts(enabled: boolean): ClassicFontSet {
  return useLazyFonts(NAMES, SOURCES, enabled, 'ClassicFonts');
}
