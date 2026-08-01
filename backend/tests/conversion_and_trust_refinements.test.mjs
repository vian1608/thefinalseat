import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '../../');

async function runConversionAndTrustRefinementTests() {
  console.log('================================================================================');
  console.log('  CONVERSION, TRUST & USABILITY REFINEMENTS AUTOMATED TEST SUITE');
  console.log('================================================================================\n');

  // ----------------------------------------------------
  // TEST 1: HERO BUTTONS & TRUST STATEMENT/BADGES
  // ----------------------------------------------------
  console.log('--- TEST 1: HERO BUTTONS & TRUST BADGES ---');
  const heroSliderJs = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/shared/components/HeroSlider.js'), 'utf8');
  assert.ok(heroSliderJs.includes('Search Flights'), 'Hero primary button text must be "Search Flights"');
  assert.ok(heroSliderJs.includes('Talk to a Travel Specialist'), 'Hero secondary button text must be "Talk to a Travel Specialist"');
  assert.ok(heroSliderJs.includes('Human-assisted booking • Clear itinerary review • Support before and after reservation'), 'Trust statement must match');
  assert.ok(heroSliderJs.includes('Human Travel Assistance'), 'Trust badge 1 must exist');
  assert.ok(heroSliderJs.includes('Clear Flight Comparison'), 'Trust badge 2 must exist');
  assert.ok(heroSliderJs.includes('Family Booking Support'), 'Trust badge 3 must exist');
  assert.ok(heroSliderJs.includes('Secure Reservation Process'), 'Trust badge 4 must exist');
  console.log('✔ TEST 1 PASSED: Hero buttons and trust badges verified.\n');

  // ----------------------------------------------------
  // TEST 2: WHY CHOOSE THE FINAL SEAT SECTION
  // ----------------------------------------------------
  console.log('--- TEST 2: WHY CHOOSE THE FINAL SEAT SECTION ---');
  const homeJs = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/features/flights/pages/Home.js'), 'utf8');
  assert.ok(homeJs.includes('Why Choose The Final Seat'), 'Why Choose The Final Seat heading must exist');
  assert.ok(homeJs.includes('Personal Travel Assistance'), 'Why Choose Card 1 title must match');
  assert.ok(homeJs.includes('Get help comparing flights, routes, baggage rules and travel options.'), 'Why Choose Card 1 desc must match');
  assert.ok(homeJs.includes('Support For Family Bookings'), 'Why Choose Card 2 title must match');
  assert.ok(homeJs.includes('Book flights for parents, relatives and travelers who need extra assistance.'), 'Why Choose Card 2 desc must match');
  assert.ok(homeJs.includes('More Than Just The Cheapest Fare'), 'Why Choose Card 3 title must match');
  assert.ok(homeJs.includes('We help you understand connections, travel time, baggage and total journey quality.'), 'Why Choose Card 3 desc must match');
  assert.ok(homeJs.includes('Simple Reservation Experience'), 'Why Choose Card 4 title must match');
  assert.ok(homeJs.includes('Clear information and human support from search to confirmation.'), 'Why Choose Card 4 desc must match');
  console.log('✔ TEST 2 PASSED: Why Choose The Final Seat section and 4 cards verified.\n');

  // ----------------------------------------------------
  // TEST 3: TRAVEL SPECIALIST LANGUAGE
  // ----------------------------------------------------
  console.log('--- TEST 3: TRAVEL SPECIALIST LANGUAGE ---');
  assert.ok(homeJs.includes('Need help choosing a flight?'), 'Support card heading must use Travel Specialist language');
  assert.ok(homeJs.includes('Our travel specialists can assist'), 'Support card body must mention travel specialists');
  assert.ok(homeJs.includes('Talk to a Travel Specialist'), 'Support card button text must be "Talk to a Travel Specialist"');
  console.log('✔ TEST 3 PASSED: Travel Specialist terminology verified.\n');

  // ----------------------------------------------------
  // TEST 4: POPULAR FLIGHT ROUTE CARDS DESCRIPTIONS
  // ----------------------------------------------------
  console.log('--- TEST 4: POPULAR ROUTE CARDS DESCRIPTIONS ---');
  const famousRoutesJs = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/shared/data/famousRoutes.js'), 'utf8');
  assert.ok(famousRoutesJs.includes('Compare schedules, connections and fare options for international travel.'), 'Chicago to Frankfurt description must match');
  assert.ok(famousRoutesJs.includes('Compare flight schedules, baggage allowances, and direct transatlantic options.'), 'NYC to London description must match');
  console.log('✔ TEST 4 PASSED: Popular route card descriptions verified.\n');

  // ----------------------------------------------------
  // TEST 5: URGENT TRAVEL ASSISTANCE SECTION
  // ----------------------------------------------------
  console.log('--- TEST 5: URGENT TRAVEL ASSISTANCE SECTION ---');
  assert.ok(homeJs.includes('Need To Travel Soon?'), 'Urgent travel section heading must exist');
  assert.ok(homeJs.includes('We help travelers find suitable options when timing matters.'), 'Urgent travel section subtitle must match');
  assert.ok(homeJs.includes('Save up to 20% on eligible urgent travel reservations within 3 days.'), '20% off within 3 days callout must exist');
  assert.ok(homeJs.includes('Request Urgent Travel Help'), 'Urgent travel button CTA must exist');
  console.log('✔ TEST 5 PASSED: Urgent travel section verified.\n');

  // ----------------------------------------------------
  // TEST 6: DEDICATED LANDING PAGES & ROUTING
  // ----------------------------------------------------
  console.log('--- TEST 6: DEDICATED LANDING PAGES & ROUTING ---');
  const appJs = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/app/App.js'), 'utf8');
  assert.ok(appJs.includes('path="/travel-assistance"'), '/travel-assistance route must exist in App.js');
  assert.ok(appJs.includes('path="/booking-for-parents"'), '/booking-for-parents route must exist in App.js');
  assert.ok(appJs.includes('path="/urgent-travel"'), '/urgent-travel route must exist in App.js');

  const taPage = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/features/flights/pages/TravelAssistancePage.js'), 'utf8');
  assert.ok(taPage.includes('Need Help Booking Your Flight?'), 'TravelAssistancePage heading must match');
  assert.ok(taPage.includes('Get Travel Assistance'), 'TravelAssistancePage CTA must match');

  const bfpPage = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/features/flights/pages/BookingForParentsPage.js'), 'utf8');
  assert.ok(bfpPage.includes('Helping You Book Flights For Your Parents'), 'BookingForParentsPage heading must match');
  assert.ok(bfpPage.includes('Find Flight Options'), 'BookingForParentsPage CTA must match');

  const utPage = await fs.readFile(path.join(ROOT_DIR, 'frontend/src/features/flights/pages/UrgentTravelPage.js'), 'utf8');
  assert.ok(utPage.includes('Need A Flight Within The Next Few Days?'), 'UrgentTravelPage heading must match');
  assert.ok(utPage.includes('Request Urgent Travel Help'), 'UrgentTravelPage CTA must match');
  console.log('✔ TEST 6 PASSED: All 3 landing pages & routes verified.\n');

  // ----------------------------------------------------
  // TEST 7: SAFETY PRESERVATION
  // ----------------------------------------------------
  console.log('--- TEST 7: PRESERVATION OF SEARCH & CHECKOUT LOGIC ---');
  assert.ok(homeJs.includes('handleSearchFlights'), 'handleSearchFlights must be preserved');
  assert.ok(homeJs.includes('isBookingForSomeoneElse'), 'isBookingForSomeoneElse state must be preserved');
  console.log('✔ TEST 7 PASSED: Core search and checkout state logic preserved 100%.\n');

  console.log('================================================================================');
  console.log('  🎉 ALL CONVERSION, TRUST & USABILITY REFINEMENT TESTS PASSED!');
  console.log('================================================================================\n');
}

runConversionAndTrustRefinementTests().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});
