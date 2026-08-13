import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const currentView = read('src/modules/bookings/booking-current-view.mjs');
const adminService = read('src/modules/admin/admin.service.mjs');
const bookingService = read('src/modules/bookings/booking.service.mjs');
const bookingController = read('src/modules/bookings/booking.controller.mjs');
const adminController = read('src/modules/admin/admin.controller.mjs');
const authController = read('src/modules/authorizations/passenger-authorization.controller.mjs');
const authService = read('src/modules/authorizations/passenger-authorization.service.mjs');
const renderer = read('src/modules/emails/email-renderer.service.mjs');
const resend = read('src/integrations/resend/resend.service.mjs');
const myBookings = read('../frontend/src/features/bookings/pages/MyBookingsPage.js');
const confirmation = read('../frontend/src/features/bookings/pages/PaymentSuccessPage.js');
const m42 = read('migrations/042_global_booking_consistency.sql');
const m43 = read('migrations/043_normalized_itinerary_sync.sql');
const m44 = read('migrations/044_email_delivery_history.sql');
const m45 = read('migrations/045_authorization_snapshot_immutability.sql');
const m46 = read('migrations/046_global_consistency_trigger_corrections.sql');

// One current-booking read model resolves duplicated projections from canonical relations.
assert.match(currentView, /travellers/);
assert.match(currentView, /contacts/);
assert.match(currentView, /buildCanonicalItinerary/);
assert.match(currentView, /customer_price/);
assert.match(currentView, /payment_status/);
assert.match(currentView, /currentVersion/);
assert.match(adminService, /bookingCurrentView\(await adminBookingReadRepository\.getDetail/);

// Customer pages always go back to the API; they do not freeze checkout/session JSON.
assert.match(myBookings, /bookingAPI\.search\(/);
assert.match(confirmation, /bookingAPI\.getConfirmationDTO\(/);
assert.match(bookingController, /bookingService\.getDetailsByCodeOrId\(confirmationCode\)/);
assert.match(bookingService, /bookingRepository\.getCompleteBookingById\(ref\)/);

// Every preview/send starts from a freshly loaded persisted booking.
assert.match(adminController, /emailPreview/);
assert.match(adminController, /bookingRepository\.getCompleteBookingById\(id\)/);
assert.match(resend, /sendBookingConfirmation/);
assert.match(resend, /bookingRepository\.getCompleteBookingById\(rawId\)/);
assert.match(resend, /sendFinalTicketEmail/);
assert.match(resend, /getCompleteBookingById\(bookingId\)/);
assert.match(resend, /renderFlightItineraryHtml\(booking\)/);
assert.match(renderer, /renderBookingRequestEmail/);
assert.match(renderer, /renderAuthorizationEmail/);
assert.match(renderer, /renderFinalTicketEmail/);

// Global database synchronization and version history.
for (const source of [m42, m43, m44, m45, m46]) assert.ok(source.length > 100);
assert.match(m42, /booking_change_events/);
assert.match(m42, /trg_tfs_contacts_sync/);
assert.match(m42, /trg_tfs_travellers_sync/);
assert.match(m42, /trg_tfs_flights_sync/);
assert.match(m42, /trg_tfs_payment_splits_sync/);
assert.match(m42, /trg_tfs_payment_method_sync/);
assert.match(m42, /trg_tfs_payments_sync/);
assert.match(m42, /REAUTHORIZATION_REQUIRED/);
assert.match(m42, /version=b\.version\+1|version = b\.version \+ 1/);
assert.match(m43, /booking_itinerary_segments/);
assert.match(m43, /REAUTHORIZATION_REQUIRED/);
assert.match(m46, /IF TG_OP='DELETE' THEN bid:=OLD\.booking_id/);

// Current email state is mutable; historical delivery events remain append-only history.
assert.match(m44, /email_delivery_history/);
assert.match(m44, /SUPERSEDED/);

// Closed authorization evidence is immutable and old links are explicitly rejected.
assert.match(m45, /authorization_snapshots are immutable/);
assert.match(m45, /tfs_freeze_closed_authorization/);
assert.match(authController, /AUTHORIZATION_SUPERSEDED/);
assert.match(authService, /quote_snapshot/);
assert.match(authService, /itinerary_snapshot/);
assert.match(authService, /authorization_snapshot/);
assert.match(authService, /saveAuthorizationSnapshot/);

console.log('global booking consistency contract: PASS');
