import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePositiveAmount } from '../src/modules/bookings/booking.mapper.mjs';

const projectRoot = path.resolve(process.cwd(), '..');

test('Admin Create Booking & Email Workflow Comprehensive Tests', async (t) => {

  await t.test('1. AdminCreateBookingPage uses named import for adminAPI', () => {
    const filePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /import\s+\{\s*adminAPI\s*\}\s+from/, 'AdminCreateBookingPage must use named import { adminAPI }');
    assert.doesNotMatch(content, /import\s+adminAPI\s+from/, 'AdminCreateBookingPage must NOT use default import adminAPI');
  });

  await t.test('2. Fake dev_admin_token fallback is completely removed', () => {
    const filePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.doesNotMatch(content, /dev_admin_token/, 'AdminCreateBookingPage must not use dev_admin_token fallback');
    assert.match(content, /navigate\('\/admin\/login'\)/, 'AdminCreateBookingPage must redirect to /admin/login when missing token');
  });

  await t.test('3. Card Reference inputs are editable in Step 4 without fake tokens or PAN/CVV', () => {
    const filePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.doesNotMatch(content, /tok_\$\{Math\.random/, 'AdminCreateBookingPage must not generate fake tok_ payment tokens');
    assert.match(content, /<select[\s\S]*?value=\{billing\.cardBrand\}/, 'Card Brand must be an editable select dropdown');
    assert.match(content, /inputMode="numeric"/, 'Last 4 input must use inputMode="numeric"');
    assert.match(content, /maxLength=\{4\}/, 'Last 4 input must use maxLength={4}');
  });

  await t.test('4. Centralized email methods exist on adminAPI in api.js', () => {
    const filePath = path.join(projectRoot, 'frontend/src/shared/api/api.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /sendEmailAction:/, 'api.js adminAPI must contain sendEmailAction');
    assert.match(content, /sendBookingRequestEmail:/, 'api.js adminAPI must contain sendBookingRequestEmail');
    assert.match(content, /sendAuthorizationEmail:/, 'api.js adminAPI must contain sendAuthorizationEmail');
    assert.match(content, /sendFinalTicketEmail:/, 'api.js adminAPI must contain sendFinalTicketEmail');
  });

  await t.test('5. Response reader handles confirmation_code, confirmationCode, booking_reference, and id', () => {
    const filePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /resData\?\.confirmation_code/, 'handleCreateBooking must safely check confirmation_code');
    assert.match(content, /resData\?\.confirmationCode/, 'handleCreateBooking must safely check confirmationCode');
    assert.match(content, /resData\?\.booking_reference/, 'handleCreateBooking must safely check booking_reference');
    assert.match(content, /resData\?\.id/, 'handleCreateBooking must safely check id');
  });

  await t.test('6. resolvePositiveAmount correctly extracts positive price from any contract field', () => {
    assert.equal(resolvePositiveAmount('741'), 741);
    assert.equal(resolvePositiveAmount(null, undefined, '850.50'), 850.5);
    assert.equal(resolvePositiveAmount(0, '0', -50, null), 0);
    assert.equal(resolvePositiveAmount(undefined, undefined, 741), 741);
  });

  await t.test('7. AdminCreateBookingPage passes top-level price fields (customer_price: 741, etc.)', () => {
    const filePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /customer_price:\s*finalCustomerTotal/, 'Payload must set top-level customer_price');
    assert.match(content, /total_amount:\s*finalCustomerTotal/, 'Payload must set top-level total_amount');
    assert.match(content, /amount:\s*finalCustomerTotal/, 'Payload must set top-level amount');
  });

  await t.test('8. Booking Request Email button dynamically toggles send vs resend action', () => {
    const filePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminDashboardPage.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /bookingEmailAction\s*=\s*bookingEmailWasSent\s*\?\s*'resend_booking_request_email'\s*:\s*'send_booking_request_email'/, 'Booking Request button must toggle between send_booking_request_email and resend_booking_request_email');
    assert.match(content, /bookingEmailLabel\s*=\s*bookingEmailWasSent\s*\?\s*'Resend Booking Request Email'\s*:\s*'Send Booking Request Email'/, 'Booking Request button label must toggle between Send and Resend');
  });

  await t.test('9. Card Last 4 resolution enforces 4 digits (not 16 digits)', () => {
    const filePath = path.join(projectRoot, 'backend/src/modules/bookings/booking.service.mjs');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /return \/\^\\d\{4\}\$\/\.test\(raw\)/, 'booking.service.mjs must use /^\\d{4}$/ for card_last4 validation');
    assert.doesNotMatch(content, /cvv_code:\s*pmPayload\.cvv_code\s*\|\|\s*1234/, 'booking.service.mjs must NOT hardcode fake CVV 1234');
    assert.doesNotMatch(content, /pm_tok_\$\{Date\.now\(\)\}/, 'booking.service.mjs must NOT generate fake pm_tok_ payment tokens');
  });

});
