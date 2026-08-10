import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const appEntry = read('frontend/src/index.js');
const booking = read('frontend/src/features/bookings/pages/BookingPage.js');
const overrides = read('frontend/src/shared/styles/BookingFlowOverrides.css');
const itinerary = read('frontend/src/features/bookings/components/ItineraryCard.js');
const timeline = read('frontend/src/shared/components/ItineraryTimeline.js');
const transition = read('frontend/src/shared/components/PageTransition.js');
const backButton = read('frontend/src/shared/components/CustomerBackButton.js');

assert.match(booking, /YOUR SELECTED ITINERARY/);

// The approved booking layout only works if its override stylesheet is loaded.
// Guard the app entry import so desktop cannot silently fall back to the legacy
// outbound | return | price three-column layout.
assert.match(appEntry, /import ['"]\.\/shared\/styles\/BookingFlowOverrides\.css['"]/);

// Approved Option 1: one full-width itinerary column, then one equally-wide form column.
assert.match(overrides, /booking-itinerary-top-grid--roundtrip[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
assert.match(overrides, /\.booking-itinerary-top-panel__inner,[\s\S]*\.container\.booking-main-container[\s\S]*max-width:\s*1180px\s*!important/);
assert.match(overrides, /\.booking-layout[\s\S]*display:\s*block\s*!important[\s\S]*width:\s*100%\s*!important/);
assert.match(overrides, /\.booking-form-area[\s\S]*width:\s*100%\s*!important[\s\S]*max-width:\s*none\s*!important/);

// The actual sidebar classes used by BookingPage must be hidden so there is no
// second itinerary, second pricing breakdown, or Modify Search block.
assert.match(overrides, /\.booking-summary-sidebar,[\s\S]*\.mobile-summary-toggle-bar[\s\S]*display:\s*none\s*!important/);
assert.doesNotMatch(overrides, /\.booking-sidebar,[\s\S]*\.mobile-summary-toggle\s*\{/);

// Price stays compact in the itinerary header on desktop.
assert.match(overrides, /booking-itinerary-pricing-summary[\s\S]*position:\s*absolute\s*!important[\s\S]*right:\s*2rem\s*!important/);

assert.match(itinerary, /Return Flight Route Timeline/);
assert.match(itinerary, /Outbound Flight Route Timeline/);

// Supplier segments are not guaranteed to use one schema. The visual timeline
// must resolve nested departure/arrival objects rather than showing ORIG/CONN/DEST.
assert.match(timeline, /nested\?\.airport/);
assert.match(timeline, /segment\.departure\?\.airport|segment\.departure/);
assert.match(timeline, /segment\.arrival\?\.airport|segment\.arrival/);
assert.match(timeline, /firstSeg\.origin_airport \|\| '---'/);
assert.match(timeline, /lastSeg\.destination_airport \|\| '---'/);
assert.doesNotMatch(timeline, /\|\| 'ORIG'|\|\| 'CONN'|\|\| 'DEST'/);

assert.match(transition, /<CustomerBackButton\s*\/>/);
assert.match(backButton, /navigate\(-1\)/);
assert.match(backButton, /pathname === '\/' \|\| pathname\.startsWith\('\/admin'\)/);
assert.match(backButton, /document\.querySelector\('\.booking-itinerary-top-panel__inner'\)/);
assert.match(backButton, /createPortal\(button, bookingTarget\)/);
assert.match(backButton, /\/return-flight/);
assert.match(backButton, /\/booking/);

console.log('booking itinerary stack + customer back navigation contract: PASS');
