import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd(), '..');

test('Admin Create Booking & Email Workflow Unit Tests', async (t) => {

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

});
