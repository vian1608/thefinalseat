import express from 'express';
import adminController from './admin.controller.mjs';
import authenticate from '../../middleware/authenticate.mjs';
import authorize from '../../middleware/authorize.mjs';
import rateLimit from '../../middleware/rate-limit.mjs';

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
router.post('/bookings/export', authenticate, authorize(['admin']), adminController.exportBookingsBulk);
router.post('/bookings/bulk-delete', authenticate, authorize(['admin']), adminController.bulkDeleteBookings);
router.post('/bookings/import-backup', authenticate, authorize(['admin']), adminController.importBookingBackup);

router.get('/bookings', authenticate, authorize(['admin']), adminController.getBookings);
router.get('/bookings/:id', authenticate, authorize(['admin']), adminController.getBookingDetail);
router.delete('/bookings/:bookingId', authenticate, authorize(['admin']), adminController.deleteBooking);
router.delete('/bookings/:id', authenticate, authorize(['admin']), adminController.deleteBooking);

// Field-Isolated Section PATCH Endpoints
router.patch('/bookings/:id/status-notes', authenticate, authorize(['admin']), adminController.updateStatusNotes);
router.patch('/bookings/:id/status', authenticate, authorize(['admin']), bookingController.updateStatus);
router.patch('/bookings/:id/passenger-details', authenticate, authorize(['admin']), adminController.updatePassengerDetails);
router.patch('/bookings/:id/contact-details', authenticate, authorize(['admin']), adminController.updateContactDetails);
router.patch('/bookings/:id/itinerary', authenticate, authorize(['admin']), bookingController.updateItinerary);
router.patch('/bookings/:id/pricing', authenticate, authorize(['admin']), adminController.updatePricing);
router.patch('/bookings/:id/airline-details', authenticate, authorize(['admin']), adminController.saveTicketDetails);
router.patch('/bookings/:id/authorization', authenticate, authorize(['admin']), adminController.updateAuthorizationSettings);
router.patch('/bookings/:id/authorization-settings', authenticate, authorize(['admin']), adminController.updateAuthorizationSettings);
router.patch('/bookings/:id/payment', authenticate, authorize(['admin']), adminController.updatePaymentAuthorization);
router.patch('/bookings/:id/payment-authorization', authenticate, authorize(['admin']), adminController.updatePaymentAuthorization);
router.patch('/bookings/:id/billing-reference', authenticate, authorize(['admin']), adminController.updateBillingDetails);
router.patch('/bookings/:id/billing-details', authenticate, authorize(['admin']), adminController.updateBillingDetails);
router.post('/bookings/:id/import-itinerary', authenticate, authorize(['admin']), bookingController.importItineraryText);
router.patch('/bookings/:id/ticket', authenticate, authorize(['admin']), bookingController.updateTicket);
router.patch('/bookings/:id/notes', authenticate, authorize(['admin']), bookingController.updateNotes);
router.patch('/bookings/:id/restore', authenticate, authorize(['admin']), adminController.restoreBooking);

// Phase 16: Backup, Export & Snapshot Recovery
router.get('/bookings/:id/export', authenticate, authorize(['admin']), adminController.exportBooking);
router.get('/bookings/:id/history', authenticate, authorize(['admin']), adminController.getBookingHistory);
router.post('/bookings/:id/restore-snapshot', authenticate, authorize(['admin']), adminController.restoreFromSnapshot);

router.put('/bookings/:id/save-all', authenticate, authorize(['admin']), adminController.saveAllChanges);
router.put('/bookings/:id', authenticate, authorize(['admin']), adminController.updateBooking);
router.put('/bookings/:id/payment-splits', authenticate, authorize(['admin']), adminController.updatePaymentSplits);
router.patch('/bookings/:id/payment-splits', authenticate, authorize(['admin']), adminController.updatePaymentSplits);
// Dedicated payment-authorization endpoint (preferred over payment-splits)
router.patch('/bookings/:id/payment-authorization', authenticate, authorize(['admin']), adminController.updatePaymentAuthorization);

// Dedicated billing & card reference endpoint — never modifies itinerary or amounts
router.patch('/bookings/:id/billing-details', authenticate, authorize(['admin']), adminController.updateBillingDetails);

router.put('/bookings/:id/ticket-details', authenticate, authorize(['admin']), adminController.saveTicketDetails);
router.patch('/bookings/:id/airline-details', authenticate, authorize(['admin']), adminController.saveTicketDetails);
router.post('/bookings/:id/send-final-ticket', authenticate, authorize(['admin']), adminController.sendFinalTicketEmail);
router.post('/bookings/:id/resend-admin-email', authenticate, authorize(['admin']), adminController.resendAdminAcknowledgement);
router.get('/bookings/:id/diagnostic', authenticate, authorize(['admin']), adminController.getBookingDiagnosticData);
router.post('/bookings/:id/process-authorized', authenticate, authorize(['admin']), adminController.processAuthorizedBooking);


router.post('/bookings/:id/itinerary', authenticate, authorize(['admin']), adminController.updateItinerary);
router.post('/bookings/:id/pricing', authenticate, authorize(['admin']), adminController.updatePricing);
router.patch('/bookings/:id/pricing', authenticate, authorize(['admin']), adminController.updatePricing);
router.post('/bookings/:identifier/pricing', authenticate, authorize(['admin']), adminController.updatePricing);
router.patch('/bookings/:identifier/pricing', authenticate, authorize(['admin']), adminController.updatePricing);
router.post('/bookings/:id/payment-action', authenticate, authorize(['admin']), adminController.handlePaymentAction);
router.get('/bookings/:id/authorization-evidence', authenticate, authorize(['admin']), passengerAuthorizationController.getEvidenceExport);
router.get('/bookings/:id/authorization-pdf', authenticate, authorize(['admin']), adminController.downloadAuthorizationPdf);
router.get('/stats', authenticate, authorize(['admin']), adminController.getStats);




router.get('/analytics', authenticate, authorize(['admin']), adminController.getAnalytics);
router.get('/abandoned-bookings', authenticate, authorize(['admin']), adminController.getAbandonedBookings);

export default router;
export { router as adminRouter };
