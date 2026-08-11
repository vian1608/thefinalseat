import express from 'express';
import bookingController from './booking.controller.mjs';
import rateLimit from '../../middleware/rate-limit.mjs';
import { abandonedBookingRouter } from '../abandoned-bookings/abandoned-booking.routes.mjs';
import { normalizeBookingCreateRequest } from './booking-create-normalization.mjs';

const router = express.Router();

const bookingRateLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 10,
  message: 'Too many booking actions. Please wait before attempting again.'
});

const searchRateLimiter = rateLimit({
  windowMs: 60000,
  maxRequests: 30,
  message: 'Too many search requests. Please wait a minute.'
});

router.post('/', bookingRateLimiter, normalizeBookingCreateRequest, bookingController.create);
router.get('/search', searchRateLimiter, bookingController.search);
router.get('/user/:email', bookingController.getByUserEmail);
router.use('/abandoned', abandonedBookingRouter);
router.post('/:id/resend-confirmation', bookingController.resendConfirmation);

router.post('/:id/payment-method', bookingController.savePaymentMethod);
router.patch('/:id/payment-method', bookingController.savePaymentMethod);

// Field-Level Isolated Update Endpoints
router.patch('/:id/payment-splits', bookingController.updatePaymentSplits);
router.put('/:id/payment-splits', bookingController.updatePaymentSplits);
router.patch('/:id/status', bookingController.updateStatus);
router.patch('/:id/payment', bookingController.updatePayment);
router.patch('/:id/itinerary', bookingController.updateItinerary);
router.patch('/:id/ticket', bookingController.updateTicket);
router.patch('/:id/notes', bookingController.updateNotes);

router.get('/confirmation/:confirmationCode', bookingController.getConfirmationDTO);
router.get('/:reference', bookingController.getByReference);

export default router;
export { router as bookingRouter };
