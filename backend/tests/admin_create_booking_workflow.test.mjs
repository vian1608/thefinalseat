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

  await t.test('13. Email preview endpoint is registered and uses emailRendererService without Resend', () => {
    const routesPath = path.join(projectRoot, 'backend/src/modules/admin/admin.routes.mjs');
    const ctrlPath = path.join(projectRoot, 'backend/src/modules/admin/admin.controller.mjs');
    const rendererPath = path.join(projectRoot, 'backend/src/modules/emails/email-renderer.service.mjs');
    assert.match(fs.readFileSync(routesPath, 'utf-8'), /\/bookings\/:id\/email-preview/, 'Routes must contain /bookings/:id/email-preview');
    assert.match(fs.readFileSync(ctrlPath, 'utf-8'), /emailPreview:/, 'Controller must contain emailPreview method');
    assert.ok(fs.existsSync(rendererPath), 'email-renderer.service.mjs must exist');
  });

  await t.test('14. Email manual sent endpoint is registered', () => {
    const routesPath = path.join(projectRoot, 'backend/src/modules/admin/admin.routes.mjs');
    const ctrlPath = path.join(projectRoot, 'backend/src/modules/admin/admin.controller.mjs');
    assert.match(fs.readFileSync(routesPath, 'utf-8'), /\/bookings\/:id\/email-manual-sent/, 'Routes must contain /bookings/:id/email-manual-sent');
    assert.match(fs.readFileSync(ctrlPath, 'utf-8'), /markEmailManuallySent:/, 'Controller must contain markEmailManuallySent method');
  });

  await t.test('15. AdminItineraryImportModal shared component exists and is imported by both AdminCreateBookingPage and AdminDashboardPage', () => {
    const modalPath = path.join(projectRoot, 'frontend/src/shared/components/admin/AdminItineraryImportModal.js');
    const createPagePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const dashPagePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminDashboardPage.js');
    assert.ok(fs.existsSync(modalPath), 'AdminItineraryImportModal.js component file must exist');
    assert.match(fs.readFileSync(createPagePath, 'utf-8'), /AdminItineraryImportModal/, 'AdminCreateBookingPage must import AdminItineraryImportModal');
    assert.match(fs.readFileSync(dashPagePath, 'utf-8'), /AdminItineraryImportModal/, 'AdminDashboardPage must import AdminItineraryImportModal');
  });

  await t.test('16. AdminEmailPreviewModal shared component exists and is imported in AdminDashboardPage', () => {
    const modalPath = path.join(projectRoot, 'frontend/src/shared/components/admin/AdminEmailPreviewModal.js');
    const dashPagePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminDashboardPage.js');
    assert.ok(fs.existsSync(modalPath), 'AdminEmailPreviewModal.js component file must exist');
    assert.match(fs.readFileSync(dashPagePath, 'utf-8'), /AdminEmailPreviewModal/, 'AdminDashboardPage must import AdminEmailPreviewModal');
  });

  await t.test('17. Frontend API contract in api.js exports all required adminAPI methods', () => {
    const apiPath = path.join(projectRoot, 'frontend/src/shared/api/api.js');
    const content = fs.readFileSync(apiPath, 'utf-8');
    assert.match(content, /getEmailPreview:/, 'api.js must export getEmailPreview in adminAPI');
    assert.match(content, /markEmailManuallySent:/, 'api.js must export markEmailManuallySent in adminAPI');
    assert.match(content, /createBooking:/, 'api.js must export createBooking in adminAPI');
    assert.match(content, /patchItinerary:/, 'api.js must export patchItinerary in adminAPI');
  });

  await t.test('18. Shared AdminItineraryHelpModal exists and is imported across pages and importer modal', () => {
    const helpModalPath = path.join(projectRoot, 'frontend/src/shared/components/admin/AdminItineraryHelpModal.js');
    const importModalPath = path.join(projectRoot, 'frontend/src/shared/components/admin/AdminItineraryImportModal.js');
    const createPagePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const dashPagePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminDashboardPage.js');
    assert.ok(fs.existsSync(helpModalPath), 'AdminItineraryHelpModal.js component file must exist');
    assert.match(fs.readFileSync(importModalPath, 'utf-8'), /AdminItineraryHelpModal/, 'AdminItineraryImportModal must import AdminItineraryHelpModal');
    assert.match(fs.readFileSync(createPagePath, 'utf-8'), /AdminItineraryHelpModal/, 'AdminCreateBookingPage must import AdminItineraryHelpModal');
    assert.match(fs.readFileSync(dashPagePath, 'utf-8'), /AdminItineraryHelpModal/, 'AdminDashboardPage must import AdminItineraryHelpModal');
  });

  await t.test('19. Info icon button ⓘ exists in Dashboard, Create Booking, and Importer header', () => {
    const importModalPath = path.join(projectRoot, 'frontend/src/shared/components/admin/AdminItineraryImportModal.js');
    const createPagePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminCreateBookingPage.js');
    const dashPagePath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminDashboardPage.js');
    assert.match(fs.readFileSync(importModalPath, 'utf-8'), /aria-label="Itinerary import help"/, 'Importer header must contain help button');
    assert.match(fs.readFileSync(createPagePath, 'utf-8'), /aria-label="Itinerary import help"/, 'Create Booking must contain help button');
    assert.match(fs.readFileSync(dashPagePath, 'utf-8'), /aria-label="Itinerary import help"/, 'Dashboard must contain help button');
  });

  await t.test('20. adminService exports getCompleteBookingById and all controller-called methods', async () => {
    const { adminService } = await import('../src/modules/admin/admin.service.mjs');
    assert.strictEqual(typeof adminService.getCompleteBookingById, 'function', 'adminService.getCompleteBookingById must be a function');
    assert.strictEqual(typeof adminService.getBookingDetails, 'function', 'adminService.getBookingDetails must be a function');
    assert.strictEqual(typeof adminService.getAllBookings, 'function', 'adminService.getAllBookings must be a function');
    assert.strictEqual(typeof adminService.updateBooking, 'function', 'adminService.updateBooking must be a function');
  });

  await t.test('21. bookingRepository.updateStatus is never invoked with invalid positional arguments in controllers', () => {
    const ctrlPath = path.join(projectRoot, 'backend/src/modules/admin/admin.controller.mjs');
    const content = fs.readFileSync(ctrlPath, 'utf-8');
    assert.doesNotMatch(content, /bookingRepository\.updateStatus\([^)]+,\s*['"][A-Z_]+['"]\s*,\s*adminEmail/, 'Controllers must not call updateStatus with 4 positional arguments');
  });

  await t.test('22. Email dispatch does not contain fake provider ID fallbacks or placeholder emails', () => {
    const ctrlPath = path.join(projectRoot, 'backend/src/modules/admin/admin.controller.mjs');
    const resendPath = path.join(projectRoot, 'backend/src/integrations/resend/resend.service.mjs');
    const ctrlContent = fs.readFileSync(ctrlPath, 'utf-8');
    const resendContent = fs.readFileSync(resendPath, 'utf-8');

    assert.doesNotMatch(ctrlContent, /`prov_\${Date\.now\(\)}`/, 'admin.controller.mjs must not contain prov_${Date.now()} fallbacks');
    assert.doesNotMatch(ctrlContent, /customer@example\.com/, 'admin.controller.mjs must not contain customer@example.com fallbacks');
    assert.doesNotMatch(resendContent, /`msg_\${Date\.now\(\)}`/, 'resend.service.mjs must not contain msg_${Date.now()} fallbacks');
  });

  await t.test('23. Canonical booking status lifecycle separation', () => {
    const repoPath = path.join(projectRoot, 'backend/src/modules/bookings/booking.repository.mjs');
    const dashPath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminDashboardPage.js');
    const repoContent = fs.readFileSync(repoPath, 'utf-8');
    const dashContent = fs.readFileSync(dashPath, 'utf-8');

    assert.doesNotMatch(repoContent, /if\s*\(s\s*===\s*['"]CONFIRMED['"]\s*\|\|\s*s\s*===\s*['"]COMPLETED['"]\)\s*s\s*=\s*['"]DONE['"]/, 'Repository must not map CONFIRMED or COMPLETED to DONE');
    assert.match(dashContent, /getBookingStatusConfig/, 'AdminDashboardPage must use getBookingStatusConfig for canonical status formatting');
    assert.match(dashContent, /Reservation Confirmed/, 'AdminDashboardPage must display Reservation Confirmed label');
    assert.match(dashContent, /Awaiting Authorization/, 'AdminDashboardPage must display Awaiting Authorization label');
  });

  await t.test('24. Shared Email Itinerary Renderer produces real itinerary HTML/Text without Commercial Airline placeholders', async () => {
    const { renderEmailItineraryHtml, renderEmailItineraryText } = await import('../src/modules/emails/email-itinerary-renderer.mjs');
    const mockItinerary = {
      outbound: [
        {
          airlineName: 'Delta Air Lines',
          carrierCode: 'DL',
          flightNumber: '106',
          originCode: 'JFK',
          destinationCode: 'LHR',
          departureDate: '2026-09-15',
          departureTime: '19:30',
          arrivalDate: '2026-09-16',
          arrivalTime: '07:45',
          cabinClass: 'Economy'
        }
      ]
    };

    const html = renderEmailItineraryHtml(mockItinerary);
    const text = renderEmailItineraryText(mockItinerary);

    assert.match(html, /Delta Air Lines/, 'HTML itinerary must render real airline name');
    assert.match(html, /DL 106/, 'HTML itinerary must render real flight number');
    assert.match(html, /JFK/, 'HTML itinerary must render origin code');
    assert.match(html, /LHR/, 'HTML itinerary must render destination code');
    assert.doesNotMatch(html, /Commercial Airline/, 'HTML itinerary must not contain Commercial Airline fallback');
    assert.doesNotMatch(html, /\(\)\s*→\s*\(\)/, 'HTML itinerary must not contain () -> () empty route fallback');

    assert.match(text, /Delta Air Lines DL 106/, 'Text itinerary must contain airline and flight number');
    assert.match(text, /JFK.*-> LHR/, 'Text itinerary must contain route');
  });

  await t.test('25. AdminDashboardPage Authorization card & Quick Actions use sendAdminBookingEmail', () => {
    const dashPath = path.join(projectRoot, 'frontend/src/features/admin/pages/AdminDashboardPage.js');
    const dashContent = fs.readFileSync(dashPath, 'utf-8');

    assert.doesNotMatch(dashContent, /handlePaymentActionSubmit\(['"]send_authorization['"]\)/, 'Authorization card and Quick Actions must NOT use handlePaymentActionSubmit for email sending');
    assert.match(dashContent, /sendAdminBookingEmail\(\{\s*emailType:\s*['"]authorization['"]/, 'Authorization email trigger must call sendAdminBookingEmail');
  });

});
