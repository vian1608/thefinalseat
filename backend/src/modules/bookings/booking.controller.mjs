import bookingService from './booking.service.mjs';
import { sendBookingConfirmation, sendBookingRequestReceivedEmail } from '../../integrations/resend/resend.service.mjs';
import logger from '../../config/logger.mjs';

export const bookingController = {
  create: async (req, res, next) => {
    try {
      const result = await bookingService.create(req.body);

      // Trigger idempotent booking request received email after DB commit
      const bookingId = result?.booking?.id || result?.id;
      if (bookingId) {
        sendBookingRequestReceivedEmail(bookingId).catch(err => {
          logger.error(`[Email] Non-blocking sendBookingRequestReceivedEmail error for ${bookingId}: ${err.message}`);
        });
      }

      res.status(201).json({
        success: true,
        message: 'Booking request created successfully.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },


  getByReference: async (req, res, next) => {
    try {
      const { reference } = req.params;
      const booking = await bookingService.getDetailsByCodeOrId(reference);
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }
        });
      }
      res.json({
        success: true,
        data: booking
      });
    } catch (error) {
      next(error);
    }
  },

  getByUserEmail: async (req, res, next) => {
    try {
      const { email } = req.params;
      const bookings = await bookingService.getBookingsForEmail(email);
      res.json({
        success: true,
        data: bookings
      });
    } catch (error) {
      next(error);
    }
  },

  search: async (req, res, next) => {
    try {
      const { query } = req.query;
      if (!query) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Search query parameter is required.' }
        });
      }

      const bookings = await bookingService.search(query);
      res.json({
        success: true,
        data: bookings
      });
    } catch (error) {
      next(error);
    }
  },

  resendConfirmation: async (req, res, next) => {
    try {
      const { id } = req.params;
      const booking = await bookingService.getDetailsByCodeOrId(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }
        });
      }

      const emailResult = await sendBookingConfirmation(booking, { force: true });
      res.json({
        success: true,
        message: 'Confirmation email resend initiated.',
        data: emailResult
      });
    } catch (error) {
      next(error);
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.email || 'admin';
      const updated = await bookingService.updateStatus(id, { ...req.body, adminId });
      res.json({
        success: true,
        message: 'Booking status updated successfully.',
        data: updated
      });
    } catch (error) {
      const statusCode = error.status || (error.code === 'INVALID_STATUS' ? 400 : 500);
      res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'STATUS_UPDATE_FAILED', message: error.message }
      });
    }
  },

  updatePayment: async (req, res, next) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.email || 'admin';
      const updated = await bookingService.updatePayment(id, { ...req.body, adminId });
      res.json({
        success: true,
        message: 'Payment details updated successfully.',
        data: updated
      });
    } catch (error) {
      const statusCode = error.status || 400;
      res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'PAYMENT_UPDATE_FAILED', message: error.message }
      });
    }
  },

  updateItinerary: async (req, res, next) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.email || 'admin';
      const updated = await bookingService.updateItinerary(id, { ...req.body, adminId });
      res.json({
        success: true,
        message: 'Itinerary segments updated successfully.',
        data: updated
      });
    } catch (error) {
      const statusCode = error.status || 400;
      res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'ITINERARY_UPDATE_FAILED', message: error.message }
      });
    }
  },

  updateTicket: async (req, res, next) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.email || 'admin';
      const updated = await bookingService.updateTicket(id, req.body || {}, adminId);
      res.json({
        success: true,
        message: 'Airline ticket details updated successfully.',
        data: updated
      });
    } catch (error) {
      const statusCode = error.status || 400;
      res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'TICKET_UPDATE_FAILED', message: error.message }
      });
    }
  },

  updateNotes: async (req, res, next) => {
    try {
      const { id } = req.params;
      const adminId = req.user?.email || 'admin';
      const updated = await bookingService.updateNotes(id, { ...req.body, adminId });
      res.json({
        success: true,
        message: 'Internal notes updated successfully.',
        data: updated
      });
    } catch (error) {
      const statusCode = error.status || 400;
      res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'NOTES_UPDATE_FAILED', message: error.message }
      });
    }
  },

  savePaymentMethod: async (req, res, next) => {
    try {
      const { id } = req.params;
      const saved = await bookingService.savePaymentMethod(id, req.body || {});
      res.status(200).json({
        success: true,
        message: 'Tokenized payment method and billing metadata saved successfully.',
        data: saved
      });
    } catch (error) {
      const statusCode = error.status || 400;
      res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'PAYMENT_METHOD_SAVE_FAILED', message: error.message }
      });
    }
  },

  updatePaymentSplits: async (req, res, next) => {
    try {
      const { id } = req.params;
      const body = req.body || {};

      // 1. Strict Request Allowlist Guard (Reject payloads containing prohibited keys)
      const PROHIBITED_KEYS = ['flights', 'itinerary', 'itinerarySegments', 'passengers', 'travellers', 'contacts', 'ticket', 'booking', 'route', 'airline'];
      for (const key of PROHIBITED_KEYS) {
        if (body[key] !== undefined) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'PROHIBITED_PAYLOAD_KEY',
              message: `Payment split update payload contains prohibited key '${key}'. Payment split updates cannot modify or touch itinerary/flight records.`
            }
          });
        }
      }

      const splits = body.splits || body.payment_splits || body.paymentSplits;
      if (!splits) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAYMENT_SPLIT',
            message: 'Request body must contain a valid splits array.'
          }
        });
      }

      const adminId = req.user?.email || 'admin';
      const reason = body.reason || 'Payment split breakdown update';

      const updatedBooking = await bookingService.updatePaymentSplits(id, splits, adminId, reason);

      res.status(200).json({
        success: true,
        message: 'Payment splits updated successfully.',
        data: updatedBooking,
        booking: updatedBooking
      });
    } catch (error) {
      const statusCode = error.status || 400;
      res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'PAYMENT_SPLIT_UPDATE_FAILED', message: error.message }
      });
    }
  }
};

export default bookingController;
