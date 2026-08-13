import assert from 'node:assert/strict';
import fs from 'node:fs';

const text = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const view = text('src/modules/bookings/booking-current-view.mjs');
const repo = text('src/modules/bookings/booking.repository.mjs');
const admin = text('src/modules/admin/admin.service.mjs');
const publicConfirmation = text('../frontend/src/features/bookings/pages/PaymentSuccessPage.js');
const myBookings = text('../frontend/src/features/bookings/pages/MyBookingsPage.js');
const authController = text('src/modules/authorizations/passenger-authorization.controller.mjs');
const m42 = text('migrations/042_global_booking_consistency.sql');
const m43 = text('migrations/043_normalized_itinerary_sync.sql');
const m44 = text('migrations/044_email_delivery_history.sql');
const m45 = text('migrations/045_authorization_snapshot_immutability.sql');
const m46 = text('migrations/046_global_consistency_trigger_corrections.sql');

assert.match(view, /travellers/);
assert.match(view, /contacts/);
assert.match(view, /buildCanonicalItinerary/);
assert.match(view, /currentVersion/);
assert.match(repo, /booking_itinerary_segments/);
assert.match(repo, /finalSegs = normalizedDbSegs/);
assert.match(admin, /bookingRepository\.getCompleteBookingById\(id\)/);
assert.match(admin, /bookingCurrentView/);
assert.match(publicConfirmation, /bookingAPI\.getConfirmationDTO/);
assert.match(myBookings, /bookingAPI\.search/);
assert.match(m42, /booking_change_events/);
assert.match(m42, /trg_tfs_contacts_sync/);
assert.match(m42, /trg_tfs_travellers_sync/);
assert.match(m42, /trg_tfs_flights_sync/);
assert.match(m43, /booking_itinerary_segments/);
assert.match(m43, /REAUTHORIZATION_REQUIRED/);
assert.match(m44, /email_delivery_history/);
assert.match(m45, /authorization_snapshots are immutable/);
assert.match(m46, /IF TG_OP='DELETE' THEN bid:=OLD\.booking_id/);
assert.match(authController, /AUTHORIZATION_SUPERSEDED/);

console.log('global booking consistency contract: PASS');
