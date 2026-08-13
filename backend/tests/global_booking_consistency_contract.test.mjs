import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const admin = read('src/modules/admin/admin.service.mjs');
const currentView = read('src/modules/bookings/booking-current-view.mjs');
const passengerAdmin = read('src/modules/admin/admin.passenger.controller.mjs');
const itineraryReader = read('src/modules/admin/admin-current-itinerary.repository.mjs');
const migration47 = read('migrations/047_stable_primary_passenger_sequence.sql');

assert.equal(admin.includes('adminBookingReadRepository.getDetail(id)'), true);
assert.equal(admin.includes('adminCurrentItineraryRepository.getByBookingId(detail.id)'), true);
assert.equal(currentView.includes('passenger_sequence'), true);
assert.equal(currentView.includes('is_primary'), true);
assert.equal(passengerAdmin.includes('passenger_sequence: index + 1'), true);
assert.equal(passengerAdmin.includes('is_primary: index === 0'), true);
assert.equal(itineraryReader.includes('booking_itinerary_segments'), true);
assert.equal(migration47.includes('tfs_sync_traveller_change_stable'), true);
assert.equal(migration47.includes('trg_tfs_assign_traveller_sequence'), true);

console.log('global booking consistency contract: PASS');
