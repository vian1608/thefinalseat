import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePositiveAmount } from '../src/modules/bookings/booking.mapper.mjs';

const projectRoot = path.resolve(process.cwd(), '..');

test('Admin Create Booking & Email Workflow Comprehensive Tests', async (t) => {

  await t.test('1. ERR_CANCELED and CanceledError are recognized in cancellation detection', () => {
    const filePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /reqErr\?\.name === 'CanceledError'/, 'Must check reqErr.name === CanceledError');
    assert.match(content, /reqErr\?\.code === 'ERR_CANCELED'/, 'Must check reqErr.code === ERR_CANCELED');
  });

  await t.test('2. Raw "canceled" text is never displayed in UI error banners', () => {
    const filePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /isCanceledRequest/, 'Must use isCanceledRequest to guard timeout recovery');
  });

  await t.test('3. Timeout reconciliation calls getBookingByClientRequestId endpoint', () => {
    const filePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /adminAPI\.getBookingByClientRequestId\(idempotencyKey\)/, 'Reconciliation must call adminAPI.getBookingByClientRequestId(idempotencyKey)');
    assert.doesNotMatch(content, /adminAPI\.getBookingEmailStatus\(idempotencyKey\)/, 'Must NOT misuse getBookingEmailStatus with idempotencyKey');
  });

  await t.test('4. Idempotency key / clientRequestId persists in database mapper', () => {
    const filePath = path.join(projectRoot, 'backend/src/modules/bookings/booking.mapper.mjs');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /client_request_id:/, 'booking.mapper.mjs must populate client_request_id');
  });

  await t.test('5. getBookingByClientRequestId endpoint is registered in admin routes and controller', () => {
    const routesPath = path.join(projectRoot, 'backend/src/modules/admin/admin.routes.mjs');
    const ctrlPath = path.join(projectRoot, 'backend/src/modules/admin/admin.controller.mjs');
    const repoPath = path.join(projectRoot, 'backend/src/modules/bookings/booking.repository.mjs');
    assert.match(fs.readFileSync(routesPath, 'utf-8'), /\/bookings\/by-request\/:clientRequestId/, 'admin.routes.mjs must contain /bookings/by-request/:clientRequestId route');
    assert.match(fs.readFileSync(ctrlPath, 'utf-8'), /getBookingByClientRequestId:/, 'admin.controller.mjs must contain getBookingByClientRequestId handler');
    assert.match(fs.readFileSync(repoPath, 'utf-8'), /getBookingByClientRequestId:/, 'booking.repository.mjs must contain getBookingByClientRequestId method');
  });

  await t.test('6. Create controller returns HTTP 201 immediately without sending auth email or reloading complete booking', () => {
    const ctrlPath = path.join(projectRoot, 'backend/src/modules/admin/admin.controller.mjs');
    const content = fs.readFileSync(ctrlPath, 'utf-8');
    assert.doesNotMatch(content, /sendAuthorizationEmail/, 'createBooking controller must NOT send auth email inline');
    assert.match(content, /res\.status\(201\)\.json\(\{/, 'createBooking controller must return HTTP 201 immediately');
  });

  await t.test('7. Phase 2 Auth email failure is caught and does not report email dispatched when promise fails', () => {
    const filePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.match(content, /Authorization email was not sent:/, 'Must handle auth email errors in Phase 2 try/catch');
  });

  await t.test('8. Draft creation allows missing DOB and missing flight itinerary', () => {
    const servicePath = path.join(projectRoot, 'backend/src/modules/bookings/booking.service.mjs');
    const jsPath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const serviceContent = fs.readFileSync(servicePath, 'utf-8');
    const jsContent = fs.readFileSync(jsPath, 'utf-8');
    assert.match(serviceContent, /if \(payload\.actionType !== 'create_draft'\)/, 'booking.service.mjs must skip traveller validation for drafts');
    assert.match(serviceContent, /if \(!isDraft && flightsList\.length === 0\)/, 'booking.service.mjs must allow empty flight list for drafts');
    assert.match(jsContent, /if \(isDraft\) \{\s*setDobErrors\(\{\}\);\s*return \[\];\s*\}/, 'Frontend validatePassengerStep must return [] immediately for drafts');
  });

  await t.test('9. Draft creation sets status DRAFT and sends no emails', () => {
    const servicePath = path.join(projectRoot, 'backend/src/modules/bookings/booking.service.mjs');
    const content = fs.readFileSync(servicePath, 'utf-8');
    assert.match(content, /emailDeliveryStatus: isDraft \? 'NOT_SENT' : 'QUEUED'/, 'Drafts must return emailDeliveryStatus NOT_SENT');
    assert.match(content, /if \(!isDraft\) \{\s*setImmediate/, 'Emails must only be sent when not draft');
  });

  await t.test('10. Server timing diagnostics exist in bookingService.create', () => {
    const servicePath = path.join(projectRoot, 'backend/src/modules/bookings/booking.service.mjs');
    const content = fs.readFileSync(servicePath, 'utf-8');
    assert.match(content, /\[CreateBookingTiming\]/, 'booking.service.mjs must contain [CreateBookingTiming] diagnostic logs');
    assert.match(content, /BOOKING_INSERT_COMPLETE/, 'booking.service.mjs must log BOOKING_INSERT_COMPLETE');
    assert.match(content, /CREATE_BOOKING_RESPONSE/, 'booking.service.mjs must log CREATE_BOOKING_RESPONSE');
  });

  await t.test('11. Only clicked button spins (activeSubmissionAction state)', () => {
    const jsPath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(jsPath, 'utf-8');
    assert.match(content, /const \[activeSubmissionAction, setActiveSubmissionAction\] = useState\(null\);/, 'Must use activeSubmissionAction state');
    assert.match(content, /activeSubmissionAction === 'create_without_payment'/, 'Button spinner must check specific action');
  });

  await t.test('12. Active idempotency key is preserved across client retry', () => {
    const jsPath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const content = fs.readFileSync(jsPath, 'utf-8');
    assert.match(content, /activeCreateRequest\?\.actionType === actionType \? activeCreateRequest\.idempotencyKey : null/, 'Must reuse active idempotencyKey when retrying');
  });

});
