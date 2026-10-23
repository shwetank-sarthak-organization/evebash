import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { isLoaded, loadAsync } from 'expo-font';
import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes';
import { Cinzel_400Regular, Cinzel_600SemiBold } from '@expo-google-fonts/cinzel';
import { CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond';

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

const FALLBACK = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const allLoaded = () => Object.values(NAMES).every((name) => isLoaded(name));

export type RoyalFontSet = Record<keyof typeof NAMES, string> & { loaded: boolean };

/** Loads the fonts when `enabled`; until they're ready (or if they fail) every name is the system serif font. */
export function useRoyalFonts(enabled: boolean): RoyalFontSet {
  const [loaded, setLoaded] = useState(allLoaded);
  useEffect(() => {
    if (!enabled || loaded) return;
    let cancelled = false;
    loadAsync(SOURCES)
      .then(() => { if (!cancelled) setLoaded(true); })
      .catch((error) => console.warn('[RoyalFonts] Failed to load:', error));
    return () => { cancelled = true; };
  }, [enabled, loaded]);
  const pick = (name: string) => (loaded ? name : FALLBACK);
  return {
    loaded,
    script: pick(NAMES.script),
    display: pick(NAMES.display),
    displayBold: pick(NAMES.displayBold),
    serif: pick(NAMES.serif),
    serifItalic: pick(NAMES.serifItalic),
  };
}
