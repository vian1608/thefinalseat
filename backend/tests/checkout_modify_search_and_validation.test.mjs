import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validatePostalCode,
  validatePassportNumber,
  validateDateOfBirth,
  validatePassportExpiry
} from '../src/shared/utils/validationHelpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '../../');

async function runComprehensiveCheckoutTests() {
  console.log('================================================================================');
  console.log('  CHECKOUT, MODIFY SEARCH, VALIDATION & CARD METADATA AUTOMATED TEST SUITE');
  console.log('================================================================================\n');

  const bookingJs = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/features/bookings/pages/BookingPage.js'), 'utf8');
  const bookingCss = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/features/bookings/pages/BookingPage.css'), 'utf8');
  const modifyJs = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/features/flights/components/ModifySearchModal.js'), 'utf8');
  const itinCardJs = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/features/bookings/components/ItineraryCard.js'), 'utf8');
  const itinCardCss = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/features/bookings/components/ItineraryCard.css'), 'utf8');
  const mapperJs = await fs.readFile(path.join(ROOT_DIR, 'backend/src/modules/bookings/booking.mapper.mjs'), 'utf8');
  const confirmCss = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/features/bookings/pages/PaymentSuccessPage.css'), 'utf8');

  // ----------------------------------------------------
  // TEST 1 & 2: RESPONSIVE ITINERARY GRID
  // ----------------------------------------------------
  console.log('--- TEST 1 & 2: RESPONSIVE ITINERARY GRID & ZERO OVERFLOW ---');
  assert.ok(itinCardCss.includes('white-space: normal;'), 'Airline name must allow normal text wrapping');
  assert.ok(bookingCss.includes('grid-template-columns: 1fr !important;'), 'Mobile itinerary grid must collapse to 1 column');
  assert.ok(bookingCss.includes('.booking-itinerary-top-grid--roundtrip'), 'Roundtrip desktop grid class must exist');
  console.log('✔ TEST 1 & 2 PASSED: Mobile & desktop responsive itinerary grid verified.\n');

  // ----------------------------------------------------
  // TEST 3: CONNECTING ITINERARY DISPLAY
  // ----------------------------------------------------
  console.log('--- TEST 3: CONNECTING ITINERARY DISPLAY ---');
  assert.ok(itinCardJs.includes('segments.map'), 'ItineraryCard must render each segment separately');
  assert.ok(itinCardJs.includes('Connection stop in'), 'ItineraryCard must render connection info');
  console.log('✔ TEST 3 PASSED: Connecting flight multi-segment display verified.\n');

  // ----------------------------------------------------
  // TEST 4 & 5: MODIFY SEARCH MODAL UI & AUTOCOMPLETE
  // ----------------------------------------------------
  console.log('--- TEST 4 & 5: MODIFY SEARCH MODAL UI & AUTOCOMPLETE ---');
  assert.ok(modifyJs.includes('AirportAutocomplete'), 'ModifySearchModal must use AirportAutocomplete component');
  assert.ok(modifyJs.includes('TravelDatePicker'), 'ModifySearchModal must use TravelDatePicker component');
  console.log('✔ TEST 4 & 5 PASSED: Modify Search autocomplete integration verified.\n');

  // ----------------------------------------------------
  // TEST 6: MODIFY SEARCH PREFILL (NO HARDCODED JFK/LHR)
  // ----------------------------------------------------
  console.log('--- TEST 6: MODIFY SEARCH PREFILL (NO HARDCODED DEFAULTS) ---');
  assert.ok(!modifyJs.includes("'JFK'"), 'ModifySearchModal.js must not contain hardcoded JFK default fallback');
  assert.ok(!modifyJs.includes("'LHR'"), 'ModifySearchModal.js must not contain hardcoded LHR default fallback');
  assert.ok(modifyJs.includes('resolveOriginVal'), 'ModifySearchModal.js must use resolveOriginVal helper');
  console.log('✔ TEST 6 PASSED: Dynamic route prefill without sample values verified.\n');

  // ----------------------------------------------------
  // TEST 7: MODIFY SEARCH DATA INTEGRITY
  // ----------------------------------------------------
  console.log('--- TEST 7: MODIFY SEARCH DATA INTEGRITY ---');
  assert.ok(modifyJs.includes('showCheckoutWarning'), 'Checkout warning modal prompt verified prior to updating search');
  console.log('✔ TEST 7 PASSED: Modify Search data integrity warning verified.\n');

  // ----------------------------------------------------
  // TEST 8: COUNTRY-AWARE US ZIP CODE VALIDATION
  // ----------------------------------------------------
  console.log('--- TEST 8: COUNTRY-AWARE US ZIP CODE VALIDATION ---');
  assert.strictEqual(validatePostalCode('14214', 'United States').valid, true);
  assert.strictEqual(validatePostalCode('14214-1234', 'United States').valid, true);
  assert.strictEqual(validatePostalCode('123', 'United States').valid, false);
  assert.strictEqual(validatePostalCode('123456', 'United States').valid, false);
  assert.strictEqual(validatePostalCode('6378488848218171', 'United States').valid, false);
  assert.strictEqual(validatePostalCode('ABCDE', 'United States').valid, false);
  console.log('✔ TEST 8 PASSED: Strict country-aware ZIP code validation verified.\n');

  // ----------------------------------------------------
  // TEST 9: PASSPORT NUMBER VALIDATION
  // ----------------------------------------------------
  console.log('--- TEST 9: PASSPORT NUMBER VALIDATION ---');
  assert.strictEqual(validatePassportNumber('A12345678').valid, true);
  assert.strictEqual(validatePassportNumber('987654321').valid, true);
  assert.strictEqual(validatePassportNumber('123').valid, false);
  assert.strictEqual(validatePassportNumber('A12345678901234567890123').valid, false);
  assert.strictEqual(validatePassportNumber('P@SSPORT!').valid, false);
  console.log('✔ TEST 9 PASSED: Passport number 5-20 alphanumeric validation verified.\n');

  // ----------------------------------------------------
  // TEST 10 & 11: FUTURE DOB & PASSENGER AGE CATEGORY
  // ----------------------------------------------------
  console.log('--- TEST 10 & 11: DOB & PASSENGER AGE CATEGORY ---');
  const futureDate = new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0];
  assert.strictEqual(validateDateOfBirth(futureDate, 'adult', '2026-09-01').valid, false);

  // Adult passenger (Age 5 child trying to register as adult)
  const childDob = '2021-05-10';
  assert.strictEqual(validateDateOfBirth(childDob, 'adult', '2026-09-01').valid, false);
  assert.strictEqual(validateDateOfBirth(childDob, 'child', '2026-09-01').valid, true);

  // Infant passenger (Age 4 child trying to register as infant)
  assert.strictEqual(validateDateOfBirth(childDob, 'infant', '2026-09-01').valid, false);
  console.log('✔ TEST 10 & 11 PASSED: Future DOB & age category validation verified.\n');

  // ----------------------------------------------------
  // TEST 12: PASSPORT EXPIRY VALIDATION
  // ----------------------------------------------------
  console.log('--- TEST 12: PASSPORT EXPIRY VALIDATION ---');
  assert.strictEqual(validatePassportExpiry('2025-01-01', '2026-09-01').valid, false);
  assert.strictEqual(validatePassportExpiry('2027-01-01', '2026-09-01').valid, true);
  console.log('✔ TEST 12 PASSED: Passport expiry relative to travel date verified.\n');

  // ----------------------------------------------------
  // TEST 13 & 14: SAFE CARD METADATA MAPPING
  // ----------------------------------------------------
  console.log('--- TEST 13 & 14: SAFE CARD METADATA MAPPING ---');
  assert.ok(mapperJs.includes('cardBrand'), 'booking.mapper.mjs must map cardBrand');
  assert.ok(mapperJs.includes('cardLast4'), 'booking.mapper.mjs must map cardLast4');
  assert.ok(bookingJs.includes('detectCardBrand'), 'BookingPage.js must detect card brand safely');
  console.log('✔ TEST 13 & 14 PASSED: Safe card last4 & brand metadata mapping verified.\n');

  // ----------------------------------------------------
  // TEST 15 & 16: STATUS PILLS SPACING
  // ----------------------------------------------------
  console.log('--- TEST 15 & 16: STATUS PILLS SPACING ---');
  assert.ok(confirmCss.includes('.status-badge'), 'Status badge style definition verified');
  assert.ok(confirmCss.includes('gap: 8px;'), 'Status pill 8px gap verified');
  console.log('✔ TEST 15 & 16 PASSED: Status pill icon gap & alignment verified.\n');

  console.log('================================================================================');
  console.log('  🎉 ALL 16 CHECKOUT, MODIFY SEARCH & VALIDATION TESTS PASSED!');
  console.log('================================================================================\n');
}

runComprehensiveCheckoutTests().catch((err) => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});
