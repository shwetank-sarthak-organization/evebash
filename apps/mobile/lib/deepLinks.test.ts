// Run: npx tsx apps/mobile/lib/deepLinks.test.ts
import assert from 'node:assert/strict';
import { routeForIncomingLink } from './deepLinks';

const atLaunch = (link: string) => routeForIncomingLink(link, true);
const whileOpen = (link: string) => routeForIncomingLink(link, false);

// Event links from the website and the app scheme open the event; the ref and query string pass through
assert.equal(atLaunch('https://www.evebash.com/events/AB12CD'), '/events/AB12CD');
assert.equal(whileOpen('https://staging.evebash.com/events/AB12CD?shared=true'), '/events/AB12CD?shared=true');
assert.equal(atLaunch('https://evebash.com/events/AB12CD/'), '/events/AB12CD');
assert.equal(atLaunch('evebash://events/abc-123'), '/events/abc-123');
assert.equal(whileOpen('evebash:///events/abc-123?shared=true#top'), '/events/abc-123?shared=true');
assert.equal(atLaunch('evebash://events/a%20b'), '/events/a%20b');

// Find You opens the Find You tab; Event Partners opens the event
assert.equal(atLaunch('https://www.evebash.com/events/AB12CD/find-you?shared=true'), '/events/AB12CD?shared=true&findYou=1');
assert.equal(whileOpen('evebash://events/AB12CD/find-you'), '/events/AB12CD?findYou=1');
assert.equal(atLaunch('https://www.evebash.com/events/AB12CD/event-partners'), '/events/AB12CD');

// A query param can't replace the event in the path or fake the Find You flag
assert.equal(atLaunch('https://www.evebash.com/events/AB12CD?id=other&findYou=1'), '/events/AB12CD');

// The normal launch link is left exactly as it is
assert.equal(atLaunch('evebash:///'), 'evebash:///');
assert.equal(atLaunch('evebash://'), 'evebash://');
assert.equal(atLaunch('exp+evebash:///'), 'exp+evebash:///');

// Other EveBash links: start screen
for (const link of ['evebash://settings', 'https://www.evebash.com/pricing', 'evebash://events/sub', 'evebash://events/%E0%A4%A', 'evebash://events/x/photos']) {
  assert.equal(atLaunch(link), '/', link);
  assert.equal(whileOpen(link), '/', link);
}

// Other apps' links: start screen at launch, ignored while the app is open (e.g. a sign-in provider's return link)
for (const link of ['com.googleusercontent.apps.123:/oauth2redirect/google', 'https://evebash.com.example.org/events/AB12CD', 'https://example.org/events/AB12CD']) {
  assert.equal(atLaunch(link), '/', link);
  assert.equal(whileOpen(link), null, link);
}
assert.equal(atLaunch(''), '/');

console.log('deepLinks: all checks passed');
