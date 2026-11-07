import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue/400Regular';
import { useLazyFonts, type LazyFontSet } from '@/hooks/use-lazy-fonts';

// Confetti Circle's tall capitals, Bebas Neue, the same as the website (src/components/confetti/confettiFonts.ts).
// Loaded only when a Confetti Circle gallery opens.
const NAMES = {
  display: 'ConfettiBebasNeue',
} as const;

const SOURCES = {
  [NAMES.display]: BebasNeue_400Regular,
};

export type ConfettiFontSet = LazyFontSet<keyof typeof NAMES>;

export function useConfettiFonts(enabled: boolean): ConfettiFontSet {
  return useLazyFonts(NAMES, SOURCES, enabled, 'ConfettiFonts');
}
