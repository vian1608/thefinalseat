import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const booking = read('frontend/src/features/bookings/pages/BookingPage.js');
const overrides = read('frontend/src/shared/styles/BookingFlowOverrides.css');
const itinerary = read('frontend/src/features/bookings/components/ItineraryCard.js');
const transition = read('frontend/src/shared/components/PageTransition.js');
const backButton = read('frontend/src/shared/components/CustomerBackButton.js');

assert.match(booking, /YOUR SELECTED ITINERARY/);
assert.match(overrides, /booking-itinerary-top-grid--roundtrip[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
assert.match(overrides, /summary-sticky-card\s*>\s*\.itin-card/);
assert.match(overrides, /summary-card-title/);
assert.match(itinerary, /Return Flight Route Timeline/);
assert.match(itinerary, /Outbound Flight Route Timeline/);
assert.match(transition, /<CustomerBackButton\s*\/>/);
assert.match(backButton, /navigate\(-1\)/);
assert.match(backButton, /pathname === '\/' \|\| pathname\.startsWith\('\/admin'\)/);
assert.match(backButton, /\/return-flight/);
assert.match(backButton, /\/booking/);

console.log('booking itinerary stack + customer back navigation contract: PASS');
