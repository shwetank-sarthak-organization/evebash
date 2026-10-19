import assert from 'node:assert/strict';
import { eventDateValue, filterEvents, getEventTypes, sortEvents } from './eventSort';

assert.equal(eventDateValue('26 September 2026'), new Date(2026, 8, 26).getTime());
assert.equal(eventDateValue('3 Oct, 2025'), new Date(2025, 9, 3).getTime());
assert.equal(eventDateValue(''), null);
assert.equal(eventDateValue('someday'), null);

const events = [
  { title: 'Rec 10', date: '1 January 2025', category: 'Wedding', createdAt: '2026-10-01T00:00:00Z' },
  { title: 'rec 2', date: 'TBD', category: 'wedding ', createdAt: '2026-10-03T00:00:00Z' },
  { title: 'Birthday', date: '5 March 2026', category: 'Birthday', createdAt: { seconds: 1790899200 } }, // 2026-10-02
];
const titles = (list: typeof events) => list.map(e => e.title);

assert.deepEqual(titles(sortEvents(events, 'recent')), ['rec 2', 'Birthday', 'Rec 10']);
assert.deepEqual(titles(sortEvents(events, 'name')), ['Birthday', 'rec 2', 'Rec 10']);
assert.deepEqual(titles(sortEvents(events, 'date_desc')), ['Birthday', 'Rec 10', 'rec 2']);
assert.deepEqual(titles(sortEvents(events, 'date_asc')), ['Rec 10', 'Birthday', 'rec 2']);
assert.deepEqual(titles(events), ['Rec 10', 'rec 2', 'Birthday'], 'sorting does not change the input');

assert.deepEqual(getEventTypes(events), ['Birthday', 'Wedding']);
assert.deepEqual(titles(filterEvents(events, '', 'wedding')), ['Rec 10', 'rec 2']);
assert.deepEqual(titles(filterEvents(events, ' REC ', 'All')), ['Rec 10', 'rec 2']);
assert.deepEqual(titles(filterEvents(events, 'birth', 'Wedding')), []);

console.log('eventSort: all checks passed');
