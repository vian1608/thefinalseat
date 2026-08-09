import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd(), '..');
const wrapper = fs.readFileSync(
  path.join(root, 'frontend/src/features/admin/pages/AdminDashboardPage.js'),
  'utf8'
);
const app = fs.readFileSync(
  path.join(root, 'frontend/src/app/App.js'),
  'utf8'
);

test('admin booking route is a dedicated detail-only experience', () => {
  assert.match(app, /path="\/admin\/bookings\/:code"/, 'Direct booking route must exist.');
  assert.match(wrapper, /useParams/, 'Wrapper must detect whether a booking code is present.');
  assert.match(wrapper, /isBookingDetailRoute\s*=\s*Boolean\(code\)/, 'Booking route must have explicit detail-only mode.');
  assert.match(wrapper, /admin-booking-detail-route \.adv2-toolbar/, 'Detail route must hide dashboard toolbar.');
  assert.match(wrapper, /admin-booking-detail-route \.adv2-kpis/, 'Detail route must hide dashboard KPIs.');
  assert.match(wrapper, /admin-booking-detail-route \.adv2-card/, 'Detail route must hide the Customer Bookings list card.');
  assert.match(wrapper, /window\.open\(bookingUrl, '_blank'\)/, 'View / Edit must open the direct booking route in a new tab.');
});
