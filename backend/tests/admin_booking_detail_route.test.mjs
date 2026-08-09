import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd(), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const wrapper = read('frontend/src/features/admin/pages/AdminDashboardPage.js');
const workspace = read('frontend/src/features/admin/components/AdminBookingWorkspace.js');
const workspaceCss = read('frontend/src/features/admin/components/AdminBookingWorkspace.css');
const app = read('frontend/src/app/App.js');
const routes = read('backend/src/modules/admin/admin.routes.mjs');
const passengerController = read('backend/src/modules/admin/admin.passenger.controller.mjs');

test('admin booking route is a dedicated compact booking workspace', async t => {
  await t.test('direct route stays separate from dashboard list', () => {
    assert.match(app, /path="\/admin\/bookings\/:code"/, 'Direct booking route must exist.');
    assert.match(wrapper, /isBookingDetailRoute\s*=\s*Boolean\(code\)/, 'Booking route must have explicit detail-only mode.');
    assert.match(wrapper, /admin-booking-detail-route \.adv2-toolbar/, 'Detail route must hide dashboard toolbar.');
    assert.match(wrapper, /admin-booking-detail-route \.adv2-kpis/, 'Detail route must hide dashboard KPIs.');
    assert.match(wrapper, /admin-booking-detail-route \.adv2-card/, 'Detail route must hide the Customer Bookings list card.');
    assert.match(wrapper, /window\.open\(bookingUrl, '_blank'\)/, 'View / Edit must open the direct booking route in a new tab.');
    assert.match(wrapper, /<AdminBookingWorkspace \/>/, 'Dedicated route must render the booking workspace.');
  });

  await t.test('booking tab title is distinct from dashboard title', () => {
    assert.match(workspace, /const desiredTitle = `\$\{code\} \| Booking Editor`/, 'Booking editor must enforce a reference-specific browser tab title.');
    assert.match(workspace, /MutationObserver\(enforceTitle\)/, 'Booking title must resist the nested dashboard Helmet title overwriting it.');
  });

  await t.test('passenger editor exposes the stored identity and contact fields', () => {
    [
      'Passenger type', 'Title', 'First name *', 'Middle name', 'Last name *',
      'Date of birth', 'Gender', 'Nationality', 'Passport number', 'Passport expiry',
      'Primary Contact', 'Email', 'Phone', 'Country code', '+ Add Passenger', 'Remove passenger'
    ].forEach(label => assert.ok(workspace.includes(label), `Missing passenger editor field/control: ${label}`));
    assert.match(workspace, /\/passenger-details/, 'Passenger save must use the protected passenger-details endpoint.');
    assert.match(workspace, /AbortController/, 'Passenger save must be bounded and abortable.');
    assert.match(workspace, /finally[\s\S]*?setSaving\(false\)/, 'Passenger save must always release loading state.');
  });

  await t.test('passenger endpoint persists actual traveller rows and primary contact', () => {
    assert.match(routes, /adminPassengerController\.updatePassengerDetails/, 'Passenger route must use durable passenger controller.');
    assert.match(passengerController, /from\('travellers'\)/, 'Passenger editor must persist to travellers table.');
    assert.match(passengerController, /date_of_birth/, 'DOB must persist to traveller row.');
    assert.match(passengerController, /passport_number/, 'Passport number must persist to traveller row.');
    assert.match(passengerController, /passport_expiry/, 'Passport expiry must persist to traveller row.');
    assert.match(passengerController, /from\('contacts'\)/, 'Primary contact must persist to contacts table.');
    assert.match(passengerController, /passenger_name:\s*primaryName/, 'Booking primary passenger summary must stay synchronized.');
    assert.match(passengerController, /REAUTHORIZATION_REQUIRED/, 'Identity changes after authorization must invalidate the old authorization state.');
  });

  await t.test('visual itinerary and compact dropdown behavior are present', () => {
    assert.ok(workspace.includes('Flight Itinerary'), 'Visual itinerary section is required.');
    assert.match(workspace, /function Journey/, 'Itinerary must render route journeys.');
    assert.match(workspace, /className="abx-route-line"/, 'Itinerary must have a visual airport-to-airport route line.');
    assert.match(workspace, /layoverBetween/, 'Multi-segment itinerary should display calculable layovers.');
    assert.match(workspace, /<details className="abx-flight"/, 'Every visual flight segment must be independently collapsible.');
    assert.match(workspace, /adv2-editor-section[\s\S]*?abx-collapsed/, 'Operational booking sections must be collapsed by default.');
    assert.match(workspaceCss, /adv2-editor-section\.abx-collapsed \.adv2-editor-section__body/, 'Collapsed operational sections must hide their body.');
    assert.match(workspaceCss, /adv2-segment-card\.abx-collapsed/, 'Manual itinerary segment cards must also collapse.');
  });
});
