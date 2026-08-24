import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function source(relativePath) {
  return fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const migration = source('../migrations/20260824_trip_addons_normalized.sql');
assert.match(migration, /create table if not exists public\.booking_addons/i);
assert.match(migration, /create table if not exists public\.addon_quotes/i);
assert.match(migration, /create table if not exists public\.addon_payments/i);
assert.match(migration, /create table if not exists public\.addon_fulfillments/i);
assert.match(migration, /create table if not exists public\.flex_change_requests/i);
assert.match(migration, /quantity between 1 and 3/i);
assert.match(migration, /idx_flex_change_requests_booking_addon/i);
assert.match(migration, /revoke all .* anon, authenticated/is);

const repository = source('../src/modules/addons/trip-addon.repository.mjs');
assert.match(repository, /loadNormalizedTripAddonSnapshot/);
assert.match(repository, /upsertNormalizedSnapshot/);
assert.match(repository, /persistLegacySnapshot/, 'legacy snapshots must remain as a compatibility fallback');
assert.match(repository, /booking_addons/);
assert.match(repository, /addon_quotes/);
assert.match(repository, /addon_payments/);
assert.match(repository, /addon_fulfillments/);

const evidence = source('../src/modules/addons/trip-addon.persistence-hardening.mjs');
assert.match(evidence, /flexTermsVersion/);
assert.match(evidence, /flexPrice/);
assert.match(evidence, /baggageDueNow: 0/);
assert.match(evidence, /authorization_snapshot/);
assert.match(evidence, /generateAuditEvidenceExport/);

const workflow = source('../src/modules/addons/trip-addon-workflow-hardening.mjs');
assert.match(workflow, /BAGGAGE_NEGATIVE_MARGIN/);
assert.match(workflow, /BAGGAGE_QUOTE_EXPIRED/);
assert.match(workflow, /BAGGAGE_PAYMENT_REQUIRED/);
assert.match(workflow, /BAGGAGE_SUPPLIER_REFERENCE_REQUIRED/);

const flexService = source('../src/modules/addons/trip-addon-flex.service.mjs');
for (const status of ['REQUESTED','REVIEWING','OPTION_FOUND','CUSTOMER_APPROVAL','REBOOKING','COMPLETED']) {
  assert.match(flexService, new RegExp(status));
}
assert.match(flexService, /BOOKING_EMAIL_VERIFICATION_FAILED/);
assert.match(flexService, /status: 'USED'/);

const flexUi = source('../../frontend/src/features/bookings/addons/installFlexAssistWorkflowUX.js');
assert.match(flexUi, /Request a Change/);
assert.match(flexUi, /Submit Flex Request/);
assert.match(flexUi, /admin\/bookings/);

const email = source('../src/modules/addons/trip-addon-booking-email.service.mjs');
assert.match(email, /TRIP_ADDONS_SUMMARY/);
assert.match(email, /Flex Assist \(10%\)/);
assert.match(email, /\$0\.00 now/);
assert.match(email, /payment receipt is not the same as supplier confirmation/i);

console.log('The Final Seat trip add-ons hardening contract: PASS');
