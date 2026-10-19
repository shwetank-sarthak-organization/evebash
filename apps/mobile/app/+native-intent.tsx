import { routeForIncomingLink } from '@/lib/deepLinks';

/**
 * expo-router runs every link that opens the app through here (the launch link with initial=true, later ones
 * with initial=false). Website and evebash:// event links open the event; see lib/deepLinks.ts.
 * Must stay synchronous and never throw: it decides the first screen at launch.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  return routeForIncomingLink(path, initial);
}
