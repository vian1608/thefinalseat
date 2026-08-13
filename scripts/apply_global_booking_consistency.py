from pathlib import Path
import json


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)

# 1) Explicitly normalize every public booking read through the current-booking view.
service_path = Path('backend/src/modules/bookings/booking.service.mjs')
service = service_path.read_text()
service = replace_once(
    service,
    "import bookingMapper, { resolvePositiveAmount } from './booking.mapper.mjs';\n",
    "import bookingMapper, { resolvePositiveAmount } from './booking.mapper.mjs';\nimport bookingCurrentView from './booking-current-view.mjs';\n",
    'booking service current-view import'
)
service = replace_once(
    service,
    "    const results = await bookingRepository.searchBookings(String(query).trim());\n    return bookingMapper.toSummaryList(results);",
    "    const results = await bookingRepository.searchBookings(String(query).trim());\n    return bookingMapper.toSummaryList((results || []).map(bookingCurrentView));",
    'My Bookings current-view normalization'
)
service = replace_once(
    service,
    "    const results = await bookingRepository.findBookingsByEmail(String(email).trim());\n    return bookingMapper.toSummaryList(results);",
    "    const results = await bookingRepository.findBookingsByEmail(String(email).trim());\n    return bookingMapper.toSummaryList((results || []).map(bookingCurrentView));",
    'email booking list current-view normalization'
)
service = replace_once(
    service,
    "    const complete = await bookingRepository.getCompleteBookingById(ref);\n    if (complete) return complete;",
    "    const complete = await bookingRepository.getCompleteBookingById(ref);\n    if (complete) return bookingCurrentView(complete);",
    'booking detail current-view normalization'
)
service = replace_once(
    service,
    "    return bookingMapper.toCanonicalModel(raw, travellers, contacts, flights, payments);",
    "    return bookingCurrentView(bookingMapper.toCanonicalModel(raw, travellers, contacts, flights, payments));",
    'fallback booking detail current-view normalization'
)
service_path.write_text(service)

# 2) Final-ticket previews/resends must render the current itinerary, price and recipient.
email_path = Path('backend/src/modules/emails/email-renderer.service.mjs')
email = email_path.read_text()
marker = "  renderFinalTicketEmail: async (booking) => {"
if marker not in email:
    raise SystemExit('missing final-ticket renderer')
prefix, suffix = email.split(marker, 1)
suffix = replace_once(
    suffix,
    "    const pnr = (booking.pnr || booking.airline_pnrs?.[0] || booking.confirmation_code || '').trim().toUpperCase();",
    "    const pnr = (booking.pnr || booking.airline_confirmation_number || booking.airlineConfirmationNumber || booking.airline_pnrs?.[0] || '').trim().toUpperCase();",
    'final ticket canonical PNR'
)
suffix = replace_once(
    suffix,
    "    const itinerary = buildCanonicalItinerary(booking);\n    if (!itinerary.outbound || itinerary.outbound.length === 0) {",
    "    const itinerary = buildCanonicalItinerary(booking);\n    const itineraryHtml = renderEmailItineraryHtml(itinerary);\n    const itineraryText = renderEmailItineraryText(itinerary);\n    if (!itinerary.outbound || itinerary.outbound.length === 0) {",
    'final ticket itinerary renderers'
)
suffix = replace_once(
    suffix,
    "        customerTotal,\n        currency,\n        supportEmail:",
    "        customerTotal,\n        currency,\n        itineraryHtml,\n        itineraryText,\n        supportEmail:",
    'final ticket template itinerary data'
)
suffix = replace_once(
    suffix,
    "          </ul>\n          <hr />\n          <p style=\"font-size: 12px; color: #64748b;\">The Final Seat Support:",
    "          </ul>\n          <hr />\n          <h3 style=\"color: #8b1236;\">Current Flight Itinerary</h3>\n          ${itineraryHtml}\n          <hr />\n          <p style=\"font-size: 12px; color: #64748b;\">The Final Seat Support:",
    'final ticket fallback HTML itinerary'
)
suffix = replace_once(
    suffix,
    "Customer Total: $${customerTotal} ${currency}\n\nSupport:",
    "Customer Total: $${customerTotal} ${currency}\n\nCurrent Flight Itinerary:\n${itineraryText}\n\nSupport:",
    'final ticket text itinerary'
)
email_path.write_text(prefix + marker + suffix)

# 3) Replace placeholder contract with a real architecture regression contract.
test_path = Path('backend/tests/global_booking_consistency_contract.test.mjs')
test_path.write_text(r'''import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const currentView = read('src/modules/bookings/booking-current-view.mjs');
const service = read('src/modules/bookings/booking.service.mjs');
const adminService = read('src/modules/admin/admin.service.mjs');
const bookingController = read('src/modules/bookings/booking.controller.mjs');
const adminController = read('src/modules/admin/admin.controller.mjs');
const authController = read('src/modules/authorizations/passenger-authorization.controller.mjs');
const authService = read('src/modules/authorizations/passenger-authorization.service.mjs');
const renderer = read('src/modules/emails/email-renderer.service.mjs');
const resend = read('src/integrations/resend/resend.service.mjs');
const m42 = read('migrations/042_global_booking_consistency.sql');
const m43 = read('migrations/043_normalized_itinerary_sync.sql');
const m44 = read('migrations/044_email_delivery_history.sql');
const m45 = read('migrations/045_authorization_snapshot_immutability.sql');
const m46 = read('migrations/046_global_consistency_trigger_corrections.sql');

assert.match(currentView, /travellers/);
assert.match(currentView, /contacts/);
assert.match(currentView, /buildCanonicalItinerary/);
assert.match(currentView, /customer_price/);
assert.match(currentView, /payment_status/);
assert.match(currentView, /currentVersion/);

assert.match(service, /import bookingCurrentView/);
assert.match(service, /toSummaryList\(\(results \|\| \[\]\)\.map\(bookingCurrentView\)\)/);
assert.match(service, /if \(complete\) return bookingCurrentView\(complete\)/);
assert.match(adminService, /bookingCurrentView\(await adminBookingReadRepository\.getDetail/);

assert.match(bookingController, /getConfirmationDTO/);
assert.match(bookingController, /bookingService\.getDetailsByCodeOrId\(confirmationCode\)/);
assert.match(adminController, /emailPreview/);
assert.match(adminController, /bookingRepository\.getCompleteBookingById\(id\)/);
assert.match(resend, /sendBookingConfirmation/);
assert.match(resend, /bookingRepository\.getCompleteBookingById\(rawId\)/);

assert.match(renderer, /renderFinalTicketEmail/);
assert.match(renderer, /Current Flight Itinerary/);
assert.match(renderer, /\$\{itineraryHtml\}/);
assert.match(renderer, /\$\{itineraryText\}/);

for (const migration of [m42, m43, m44, m45, m46]) assert.ok(migration.length > 100);
assert.match(m42, /booking_change_events/);
assert.match(m42, /trg_tfs_contacts_sync/);
assert.match(m42, /trg_tfs_travellers_sync/);
assert.match(m42, /trg_tfs_flights_sync/);
assert.match(m42, /trg_tfs_payment_splits_sync/);
assert.match(m42, /trg_tfs_payment_method_sync/);
assert.match(m42, /trg_tfs_payments_sync/);
assert.match(m43, /booking_itinerary_segments/);
assert.match(m43, /REAUTHORIZATION_REQUIRED/);
assert.match(m44, /email_delivery_history/);
assert.match(m44, /SUPERSEDED/);
assert.match(m45, /authorization_snapshots are immutable/);
assert.match(m46, /IF TG_OP='DELETE' THEN bid:=OLD\.booking_id/);

assert.match(authController, /AUTHORIZATION_SUPERSEDED/);
assert.match(authService, /quote_snapshot/);
assert.match(authService, /itinerary_snapshot/);
assert.match(authService, /authorization_snapshot/);
assert.match(authService, /saveAuthorizationSnapshot/);

console.log('global booking consistency contract: PASS');
''')

# 4) Make the global synchronization contract part of both release gates.
pkg_path = Path('backend/package.json')
pkg = json.loads(pkg_path.read_text())
for key in ('test', 'verify:production-ready'):
    cmd = pkg['scripts'][key]
    needle = 'node tests/global_booking_consistency_contract.test.mjs'
    if needle not in cmd:
        pkg['scripts'][key] = cmd + ' && ' + needle
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n')

print('global booking consistency source patch complete')
