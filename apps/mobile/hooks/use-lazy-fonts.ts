import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { isLoaded, loadAsync, type FontSource } from 'expo-font';

// A theme's own fonts, loaded only when a gallery in that theme opens, under their own names: app start-up maps
// the shared font names to Inter (app/_layout.tsx), and that stays as it is. Used by Royal Emerald, Classic White and
// Sunlit Portrait.

const FALLBACK = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export type LazyFontSet<K extends string> = Record<K, string> & { loaded: boolean };

/**
 * Loads `sources` when `enabled`; until they're ready (or if they fail) every name in `names` is the system serif
 * font. `names` maps each role (e.g. "serif") to the name its font is registered under in `sources`.
 */
export function useLazyFonts<K extends string>(
  names: Record<K, string>,
  sources: Record<string, FontSource>,
  enabled: boolean,
  label: string,
): LazyFontSet<K> {
  const allLoaded = () => Object.values<string>(names).every((name) => isLoaded(name));
  const [loaded, setLoaded] = useState(allLoaded);
  useEffect(() => {
    if (!enabled || loaded) return;
    let cancelled = false;
    loadAsync(sources)
      .then(() => { if (!cancelled) setLoaded(true); })
      .catch((error) => console.warn(`[${label}] Failed to load:`, error));
    return () => { cancelled = true; };
    // names and sources are module constants
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loaded]);
  const set = { loaded } as LazyFontSet<K>;
  (Object.keys(names) as K[]).forEach((role) => {
    (set as Record<K, string>)[role] = loaded ? names[role] : FALLBACK;
  });
  return set;
}
