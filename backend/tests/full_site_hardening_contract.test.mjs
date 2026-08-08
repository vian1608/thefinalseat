import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

const seoGuard = read('frontend', 'src', 'shared', 'components', 'SeoRouteGuard.js');
const routeDispatcher = read('frontend', 'src', 'features', 'flights', 'pages', 'RouteDispatcher.js');
const airlineAction = read('frontend', 'src', 'features', 'flights', 'pages', 'AirlineActionPage.js');
const flightRoute = read('frontend', 'src', 'features', 'flights', 'pages', 'FlightRoutePage.js');
const trainRoute = read('frontend', 'src', 'features', 'flights', 'pages', 'TrainRoutePage.js');
const travelAssistance = read('frontend', 'src', 'features', 'flights', 'pages', 'TravelAssistancePage.js');
const carResultCard = read('frontend', 'src', 'features', 'cars', 'components', 'CarResultCard.js');
const carResults = read('frontend', 'src', 'features', 'cars', 'pages', 'CarSearchResultsPage.js');
const carHome = read('frontend', 'src', 'features', 'cars', 'pages', 'CarRentalsHomePage.js');
const returnFlights = read('frontend', 'src', 'features', 'flights', 'pages', 'ReturnFlightSelectionPage.js');
const myBookings = read('frontend', 'src', 'features', 'bookings', 'pages', 'MyBookingsPage.js');
const signIn = read('frontend', 'src', 'features', 'customers', 'pages', 'SignInPage.js');
const signUp = read('frontend', 'src', 'features', 'customers', 'pages', 'SignUpPage.js');
const consultingPayment = read('frontend', 'src', 'features', 'payments', 'pages', 'ConsultingPaymentPage.js');
const sensitiveGuard = read('frontend', 'src', 'shared', 'security', 'installSensitiveDataGuards.js');
const indexJs = read('frontend', 'src', 'index.js');
const api = read('frontend', 'src', 'shared', 'api', 'api.js');
const app = read('frontend', 'src', 'app', 'App.js');
const contact = read('frontend', 'src', 'shared', 'pages', 'ContactInfoPage.js');
const terms = read('frontend', 'src', 'shared', 'pages', 'TermsAndConditionsPage.js');
const privacy = read('frontend', 'src', 'shared', 'pages', 'PrivacyPolicyPage.js');
const refund = read('frontend', 'src', 'shared', 'pages', 'RefundPolicyPage.js');

// SEO: dynamic pages must be backed by a known catalog, never an arbitrary prefix.
assert.match(seoGuard, /VALID_ROUTE_PATHS/);
assert.match(seoGuard, /routesData/);
assert.doesNotMatch(seoGuard, /INDEXABLE_PREFIXES/);
assert.match(routeDispatcher, /NotFoundPage/);
assert.doesNotMatch(routeDispatcher, /Navigate to="\/"/);
assert.match(airlineAction, /airlinesData/);
assert.match(airlineAction, /<NotFoundPage \/>/);
assert.match(app, /<Route path="\*" element={<NotFoundPage \/>} \/>/);

// Search URL compatibility must preserve return dates and cabin across refresh/share links.
assert.match(seoGuard, /params\.get\('return'\)/);
assert.match(seoGuard, /params\.set\('returnDate'/);
assert.match(seoGuard, /params\.get\('cabin'\)/);
assert.match(seoGuard, /params\.set\('travelClass'/);

// Indexed informational pages must expose unique metadata and the www canonical host.
for (const [name, source] of Object.entries({ contact, terms, privacy, refund })) {
  assert.match(source, /<Helmet>/, `${name} is missing Helmet metadata`);
  assert.match(source, /https:\/\/www\.thefinalseat\.com\//, `${name} is missing www canonical metadata`);
}

// Public route lead forms must only count a real, persisted database lead.
for (const [name, source] of Object.entries({ flightRoute, trainRoute, travelAssistance })) {
  assert.match(source, /clientRequestId/, `${name} is missing idempotency identity`);
  assert.match(source, /result\?\.success === true/, `${name} does not require explicit success`);
  assert.match(source, /result\?\.persisted === true/, `${name} does not verify persistence`);
  assert.match(source, /result\?\.leadId/, `${name} does not require a real lead id`);
  assert.match(source, /trackLeadConversion/, `${name} is not wired to the canonical conversion helper`);
  assert.match(source, /normalizeError/, `${name} does not normalize visible API failures`);
  assert.doesNotMatch(source, /route-inquiry@thefinalseat\.com/, `${name} still fabricates a customer email`);
}
assert.match(flightRoute, /origin: `\$\{oCity\} \(\$\{oCode\}\)`/);
assert.match(flightRoute, /destination: `\$\{dCity\} \(\$\{dCode\}\)`/);
assert.match(trainRoute, /serviceType: 'rail'/);
assert.match(flightRoute, /smsOptIn: formData\.smsOptIn/);
assert.match(trainRoute, /smsOptIn: formData\.smsOptIn/);

// Car provider redirect must never wait for analytics to complete.
assert.match(carResultCard, /void carAPI\.recordClick/);
assert.doesNotMatch(carResultCard, /await carAPI\.recordClick/);
assert.match(carResultCard, /dealError/);
assert.match(carResultCard, /window\.location\.assign/);
assert.match(carResults, /requestSequence/);
assert.match(carResults, /pageToken/);
assert.match(carResults, /normalizeError/);
assert.match(carHome, /pickupDate: futureDate\(7\)/);
assert.match(carHome, /dropoffDate: futureDate\(12\)/);
assert.match(carHome, /SeamlessAdvisorySection variant="flight"/);

// Return-flight API failure must be distinguishable from a genuine zero-result search.
assert.match(returnFlights, /setError\(normalizeError/);
assert.match(returnFlights, /Return Flight Search Failed/);
assert.match(returnFlights, /Retry Search/);
assert.match(returnFlights, /returnDate:/);
assert.match(returnFlights, /travelClass:/);

// My Bookings must honor links generated by the authorization flow and must not
// send a pending booking to checkout without restoring the itinerary context.
assert.match(myBookings, /queryParams\.get\('code'\)/);
assert.match(myBookings, /View Reservation/);
assert.doesNotMatch(myBookings, /Retry Payment \(Card Failed\)/);
assert.doesNotMatch(myBookings, /to="\/booking"/);
assert.match(myBookings, /normalizeError/);

// Authentication must show an error for both thrown failures and success:false responses.
for (const [name, source] of Object.entries({ signIn, signUp })) {
  assert.match(source, /normalizeError/);
  assert.match(source, /if \(loading\) return/);
  assert.match(source, /finally/);
  assert.match(source, /role="alert"/);
}

// Hosted Stripe checkout means raw payment credentials must NOT be collected
// or persisted on The Final Seat's consulting payment form.
assert.doesNotMatch(consultingPayment, /cardNumber/);
assert.doesNotMatch(consultingPayment, /\bcch\b/i);
assert.doesNotMatch(consultingPayment, /CVV/i);
assert.match(consultingPayment, /createStripeSession/);
assert.match(consultingPayment, /new URL\(response\.url\)/);
assert.match(consultingPayment, /checkoutUrl\.protocol !== 'https:'/);
assert.match(consultingPayment, /normalizeError/);

// Defense-in-depth: shared transport/log guards must prevent full PAN/CVV from
// escaping any legacy component and bound same-origin raw fetch calls.
assert.match(indexJs, /installSensitiveDataGuards\(\)/);
for (const forbidden of ['cardnumber', 'card_number', 'pan', 'cvv', 'cvc', 'cid', 'cch']) {
  assert.ok(sensitiveGuard.toLowerCase().includes(`'${forbidden}'`), `Sensitive guard missing ${forbidden}`);
}
assert.match(sensitiveGuard, /slice\(-4\)/);
assert.match(sensitiveGuard, /DEFAULT_FETCH_TIMEOUT_MS = 30000/);
assert.match(sensitiveGuard, /url\.pathname\.startsWith\('\/api\/'\)/);
assert.match(sensitiveGuard, /controller\.abort\(\)/);

// Shared Axios safety timeout remains in force for buttons using canonical API helpers.
assert.match(api, /timeout: DEFAULT_API_TIMEOUT_MS/);
assert.match(api, /DEFAULT_API_TIMEOUT_MS/);

console.log('Full-site hardening contract passed: SEO, leads, search, payments, auth, and async-button safety.');
