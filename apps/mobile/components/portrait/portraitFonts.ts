import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { useLazyFonts, type LazyFontSet } from '@/hooks/use-lazy-fonts';

// Sunlit Portrait's serif, Instrument Serif, the same as the website (src/components/portrait/portraitFonts.ts).
// Loaded only when a Sunlit Portrait gallery opens.
const NAMES = {
  serif: 'PortraitInstrumentSerif',
} as const;

const SOURCES = {
  [NAMES.serif]: InstrumentSerif_400Regular,
};

export type PortraitFontSet = LazyFontSet<keyof typeof NAMES>;

export function usePortraitFonts(enabled: boolean): PortraitFontSet {
  return useLazyFonts(NAMES, SOURCES, enabled, 'PortraitFonts');
}

// The website's palette (src/app/sunlit-portrait.css): warm paper, ink, muted brown, clay
export const PORTRAIT = {
  paper: '#FBF8F3',
  ink: '#1F1B17',
  muted: '#6B6158',
  clay: '#A24E30',
  clayLight: '#E0A487',
  line: '#E7DFD4',
} as const;
