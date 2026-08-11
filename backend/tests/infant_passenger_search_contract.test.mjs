import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const home = read('frontend/src/features/flights/pages/Home.js');
const sharedSearch = read('frontend/src/features/flights/components/FlightSearchPanel.js');
const modifyModal = read('frontend/src/features/flights/components/ModifySearchModal.js');
const results = read('frontend/src/features/flights/pages/SearchResultsPage.js');
const returnPage = read('frontend/src/features/flights/pages/ReturnFlightSelectionPage.js');
const bookingPage = read('frontend/src/features/bookings/pages/BookingPage.js');
const controller = read('backend/src/modules/flights/flight.controller.mjs');
const flightService = read('backend/src/modules/flights/flight.service.mjs');
const provider = read('backend/src/integrations/serpapi/serpapi.service.mjs');

// Every customer-facing flight-search entry point must expose the two distinct
// infant choices rather than collapsing both into a generic infant count.
for (const source of [home, sharedSearch, modifyModal]) {
  assert.match(source, /Infants in seat/i);
  assert.match(source, /Infants on lap/i);
  assert.match(source, /infantsInSeat/);
  assert.match(source, /infantsOnLap/);
}

// The home/shared selectors must prevent a lap-infant count that cannot be
// accompanied by the selected number of adults.
assert.match(home, /infantsOnLap\s*>\s*searchData\.adults|searchData\.infantsOnLap\s*>\s*searchData\.adults/);
assert.match(sharedSearch, /searchData\.infantsOnLap\s*>\s*searchData\.adults/);
assert.match(modifyModal, /infantsOnLap\s*>\s*adults/);

// Search URLs and session state retain both specific infant counts. The legacy
// `infants` field remains the TOTAL so existing checkout traveler forms continue
// to create one passenger record for every infant.
for (const source of [home, sharedSearch, results, returnPage]) {
  assert.match(source, /infantsInSeat/);
  assert.match(source, /infantsOnLap/);
}
assert.match(home, /infants:\s*totalInfants/);
assert.match(sharedSearch, /infants:\s*totalInfants/);
assert.match(results, /infants:\s*hasSplitInfants\s*\?\s*infantsInSeat\s*\+\s*infantsOnLap\s*:\s*legacyInfants/);
assert.match(bookingPage, /searchParams\.infants/);
assert.match(bookingPage, /createPassenger\('infant'\)/);

// Old links/clients that only send `infants` are intentionally interpreted as
// lap infants, matching the site's previous "Under 2 (lap)" behavior.
assert.match(results, /infantsOnLap[\s\S]*legacyInfants/);
assert.match(sharedSearch, /legacyInfantsParam/);
assert.match(controller, /legacyInfants/);

// Backend accepts the split contract, validates lap infants against adults, and
// passes both values to the supplier integration.
assert.match(controller, /infantsInSeat/);
assert.match(controller, /infantsOnLap/);
assert.match(controller, /INVALID_LAP_INFANT_COUNT/);
assert.match(controller, /normalizedInfantsInSeat\s*\+\s*normalizedInfantsOnLap/);

// Google Flights/SerpApi receives the exact supplier parameters for each infant
// type instead of sending all infants as lap infants.
assert.match(provider, /params\.append\('infants_in_seat',\s*infantsInSeat\.toString\(\)\)/);
assert.match(provider, /params\.append\('infants_on_lap',\s*infantsOnLap\.toString\(\)\)/);

// Preserve the searched mix on every returned itinerary. BookingPage stores the
// selected flight object, so admin/support can later distinguish a purchased seat
// from an infant traveling on an adult's lap.
assert.match(flightService, /passengerMix/);
assert.match(flightService, /infantsInSeat/);
assert.match(flightService, /infantsOnLap/);
assert.match(flightService, /flights:\s*\(results\.flights\s*\|\|\s*\[\]\)\.map/);
assert.match(bookingPage, /flight:\s*flightObj/);

// Return-flight continuation must preserve the passenger mix so the provider's
// round-trip token is priced for the same travelers selected on the outbound.
assert.match(returnPage, /departureToken:\s*token[\s\S]*infantsInSeat:\s*canonicalParams\.infantsInSeat[\s\S]*infantsOnLap:\s*canonicalParams\.infantsOnLap/);

console.log('seated + lap infant flight-search contract: PASS');
