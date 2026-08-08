import express from 'express';
import adminController from './admin.controller.mjs';
import adminRepairController from './admin.repair.controller.mjs';
import adminDashboardV2Controller from './admin.dashboard-v2.controller.mjs';
import adminBackupController from './admin.backup.controller.mjs';
import adminBulkDeleteController from './admin.bulk-delete.controller.mjs';
import '../bookings/booking.repository.runtime-repair.mjs';
import authenticate from '../../middleware/authenticate.mjs';
import authorize from '../../middleware/authorize.mjs';
import rateLimit from '../../middleware/rate-limit.mjs';

// Keep the long-standing repair-controller route contract while replacing only
// its delete methods with the optimized batched engine. Existing tests and any
// internal imports continue to see the same public route handlers.
adminRepairController.bulkDeleteBookings = adminBulkDeleteController.bulkDeleteBookings;
adminRepairController.deleteBooking = adminBulkDeleteController.deleteBooking;

const router = express.Router();

const loginRateLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 5,
  message: 'Too many admin login attempts. Please try again later.'
});

// Public login
router.post('/login', loginRateLimiter, adminController.login);

import passengerAuthorizationController from '../authorizations/passenger-authorization.controller.mjs';
import bookingController from '../bookings/booking.controller.mjs';

// Protected admin endpoints
// Bulk operations (must be before :id routes to avoid param capture)
router.post('/bookings/export', authenticate, authorize(['admin']), adminBackupController.exportBookingsBulk);
router.post('/bookings/bulk-delete', authenticate, authorize(['admin']), adminRepairController.bulkDeleteBookings);
router.post('/bookings/import-backup', authenticate, authorize(['admin']), adminController.importBookingBackup);

router.get('/bookings', authenticate, authorize(['admin']), adminController.getBookings);
router.get('/bookings/by-request/:clientRequestId', authenticate, authorize(['admin']), adminController.getBookingByClientRequestId);
router.post('/bookings', authenticate, authorize(['admin']), adminController.createBooking);
router.post('/bookings/:id/email-preview', authenticate, authorize(['admin']), adminController.emailPreview);
router.post('/bookings/:id/email-manual-sent', authenticate, authorize(['admin']), adminController.markEmailManuallySent);
router.get('/bookings/:id', authenticate, authorize(['admin']), adminController.getBookingDetail);
router.delete('/bookings/:id', authenticate, authorize(['admin']), adminRepairController.deleteBooking);

// Field-Isolated Section PATCH Endpoints
router.patch('/bookings/:id/status-notes', authenticate, authorize(['admin']), adminController.updateStatusNotes);
router.patch('/bookings/:id/status', authenticate, authorize(['admin']), bookingController.updateStatus);
router.patch('/bookings/:id/passenger-details', authenticate, authorize(['admin']), adminController.updatePassengerDetails);
router.patch('/bookings/:id/contact-details', authenticate, authorize(['admin']), adminController.updateContactDetails);
router.patch('/bookings/:id/itinerary', authenticate, authorize(['admin']), adminRepairController.updateItinerary);
router.patch('/bookings/:id/pricing', authenticate, authorize(['admin']), adminDashboardV2Controller.updatePricing);
router.patch('/bookings/:id/airline-details', authenticate, authorize(['admin']), adminController.saveTicketDetails);
router.patch('/bookings/:id/authorization', authenticate, authorize(['admin']), adminController.updateAuthorizationSettings);
router.patch('/bookings/:id/authorization-settings', authenticate, authorize(['admin']), adminController.updateAuthorizationSettings);
router.patch('/bookings/:id/payment', authenticate, authorize(['admin']), adminController.updatePaymentAuthorization);
router.patch('/bookings/:id/payment-authorization', authenticate, authorize(['admin']), adminController.updatePaymentAuthorization);
router.patch('/bookings/:id/billing-reference', authenticate, authorize(['admin']), adminController.updateBillingDetails);
router.patch('/bookings/:id/billing-details', authenticate, authorize(['admin']), adminController.updateBillingDetails);
router.post('/itineraries/parse', authenticate, authorize(['admin']), adminController.parseItinerary);
router.post('/parse-itinerary', authenticate, authorize(['admin']), adminController.parseItinerary);
router.post('/bookings/:id/import-itinerary', authenticate, authorize(['admin']), bookingController.importItineraryText);
router.patch('/bookings/:id/ticket', authenticate, authorize(['admin']), bookingController.updateTicket);
router.patch('/bookings/:id/notes', authenticate, authorize(['admin']), bookingController.updateNotes);
router.patch('/bookings/:id/restore', authenticate, authorize(['admin']), adminController.restoreBooking);

// Backup, Export & Snapshot Recovery
router.get('/bookings/:id/export', authenticate, authorize(['admin']), adminController.exportBooking);
router.get('/bookings/:id/history', authenticate, authorize(['admin']), adminController.getBookingHistory);
router.post('/bookings/:id/restore-snapshot', authenticate, authorize(['admin']), adminController.restoreFromSnapshot);

router.put('/bookings/:id/save-all', authenticate, authorize(['admin']), adminController.saveAllChanges);
router.put('/bookings/:id', authenticate, authorize(['admin']), adminController.updateBooking);
router.put('/bookings/:id/payment-splits', authenticate, authorize(['admin']), adminController.updatePaymentSplits);
router.patch('/bookings/:id/payment-splits', authenticate, authorize(['admin']), adminController.updatePaymentSplits);
router.put('/bookings/:id/ticket-details', authenticate, authorize(['admin']), adminController.saveTicketDetails);
router.post('/bookings/:id/send-final-ticket', authenticate, authorize(['admin']), adminController.sendFinalTicketEmail);
router.post('/bookings/:id/resend-admin-email', authenticate, authorize(['admin']), adminController.resendAdminAcknowledgement);
router.get('/bookings/:id/diagnostic', authenticate, authorize(['admin']), adminController.getBookingDiagnosticData);
router.post('/bookings/:id/process-authorized', authenticate, authorize(['admin']), adminController.processAuthorizedBooking);

// Canonical itinerary mutation path. Keep POST for legacy callers, but both verbs
// now use the same validated, persistence-verified implementation.
router.post('/bookings/:id/itinerary', authenticate, authorize(['admin']), adminRepairController.updateItinerary);

// Keep legacy pricing verbs compatible, but return a full verified booking snapshot.
router.post('/bookings/:id/pricing', authenticate, authorize(['admin']), adminDashboardV2Controller.updatePricing);
router.post('/bookings/:identifier/pricing', authenticate, authorize(['admin']), adminDashboardV2Controller.updatePricing);
router.patch('/bookings/:identifier/pricing', authenticate, authorize(['admin']), adminDashboardV2Controller.updatePricing);
router.post('/bookings/:id/payment-action', authenticate, authorize(['admin']), adminController.handlePaymentAction);
router.get('/bookings/:id/authorization-evidence', authenticate, authorize(['admin']), passengerAuthorizationController.getEvidenceExport);
router.get('/bookings/:id/authorization-pdf', authenticate, authorize(['admin']), adminController.downloadAuthorizationPdf);
router.get('/stats', authenticate, authorize(['admin']), adminController.getStats);
router.get('/analytics', authenticate, authorize(['admin']), adminController.getAnalytics);
router.get('/abandoned-bookings', authenticate, authorize(['admin']), adminController.getAbandonedBookings);

export default router;
export { router as adminRouter };
