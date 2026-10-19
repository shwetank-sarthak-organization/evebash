/**
 * Links that open the app (app/+native-intent.tsx): website event links (https://www.evebash.com/events/<ref>,
 * .../events/<ref>/find-you) and the app scheme (evebash://events/<ref>). The ref is passed straight through:
 * the event screen resolves event ids, join codes and legacy ids with openGallery, as the website does.
 */

const APP_SCHEMES = new Set(['evebash', 'exp+evebash']);
const WEBSITE_HOST = /^(?:[a-z0-9-]+\.)*evebash\.com$/i;

type ParsedLink = { ours: boolean; path: string; query: string };

function parseLink(link: string): ParsedLink | null {
  const trimmed = link.trim();
  // Already a path (e.g. "/events/abc")
  if (trimmed.startsWith('/')) {
    const [beforeHash] = trimmed.split('#');
    const [path, query = ''] = beforeHash.split('?');
    return { ours: true, path, query };
  }
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?/i.exec(trimmed);
  if (!match) return null;
  const [, rawScheme, authority, rest, query = ''] = match;
  const scheme = rawScheme.toLowerCase();
  if (scheme === 'http' || scheme === 'https') {
    const host = authority.replace(/^[^@]*@/, '').replace(/:\d+$/, '');
    return { ours: WEBSITE_HOST.test(host), path: rest, query };
  }
  // evebash://events/abc puts "events" in the authority; evebash:///events/abc leaves it empty
  return { ours: APP_SCHEMES.has(scheme), path: authority ? `/${authority}${rest}` : rest, query };
}

/** Query string of the link without the params the route sets itself. */
function keptQuery(query: string): string[] {
  return query
    .split('&')
    .filter(Boolean)
    .filter((pair) => {
      const key = pair.split('=')[0];
      let name = key;
      try {
        name = decodeURIComponent(key.replace(/\+/g, ' '));
      } catch {
        return false;
      }
      return name !== 'id' && name !== 'findYou';
    });
}

/**
 * The app route for an event link, or null when the link isn't one.
 * /events/<ref> and /events/<ref>/event-partners open the event; /events/<ref>/find-you opens its Find You tab.
 */
export function eventRouteFromLink(link: string): string | null {
  const parsed = parseLink(link);
  if (!parsed?.ours) return null;
  const match = /^\/events\/([^/]+)(?:\/(find-you|event-partners))?\/?$/.exec(parsed.path);
  if (!match) return null;
  const [, ref, page] = match;
  try {
    // Must decode cleanly and not be a sub-route name
    const decoded = decodeURIComponent(ref);
    if (!decoded.trim() || decoded === 'sub') return null;
  } catch {
    return null;
  }
  const params = keptQuery(parsed.query);
  if (page === 'find-you') params.push('findYou=1');
  return `/events/${ref}${params.length ? `?${params.join('&')}` : ''}`;
}

/** The plain app link the app is started with when no link opened it (e.g. evebash:///). */
export function isAppRootLink(link: string): boolean {
  const parsed = parseLink(link);
  return !!parsed && parsed.ours && !/^https?:/i.test(link.trim()) && (parsed.path === '' || parsed.path === '/') && !parsed.query;
}

/** Whether the link belongs to the app (its scheme or the EveBash website). */
export function isOwnLink(link: string): boolean {
  return !!parseLink(link)?.ours;
}

/**
 * Where an incoming link goes (expo-router's redirectSystemPath). Event links open the event. Anything else:
 * at launch the app starts normally; while it's running, our own links go to the start screen and other apps'
 * links (e.g. a sign-in provider's return link) are left alone. Never throws.
 */
export function routeForIncomingLink(link: string, initial: boolean): string | null {
  try {
    const eventRoute = eventRouteFromLink(link);
    if (eventRoute) return eventRoute;
    if (initial) return isAppRootLink(link) ? link : '/';
    return isOwnLink(link) ? '/' : null;
  } catch {
    return initial ? '/' : null;
  }
}
