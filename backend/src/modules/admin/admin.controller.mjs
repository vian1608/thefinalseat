import adminService from './admin.service.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';
import bookingMapper from '../bookings/booking.mapper.mjs';
import { sendBookingConfirmation } from '../../integrations/resend/resend.service.mjs';


export const adminController = {
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await adminService.login(email, password);
      res.json({
        success: true,
        message: 'Admin login successful',
        ...result
      });
    } catch (error) {
      next(error);
    }
  },

  getBookings: async (req, res, next) => {
    try {
      const { reference, name, email, date, status } = req.query;
      const bookings = await adminService.getAllBookings({ reference, name, email, date, status });
      res.json({
        success: true,
        data: bookings,
        count: bookings.length
      });
    } catch (error) {
      next(error);
    }
  },

  getBookingDetail: async (req, res, next) => {
    try {
      const booking = await adminService.getBookingDetails(req.params.id);
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

  updateBooking: async (req, res, next) => {
    try {
      const { bookingStatus, internalNotes, customerName, email, phone } = req.body || {};
      const updated = await adminService.updateBooking(req.params.id, {
        status: bookingStatus,
        internal_notes: internalNotes,
        passenger_name: customerName,
        email,
        phone,
      });
      res.json({
        success: true,
        message: 'Booking updated.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  getStats: async (req, res, next) => {
    try {
      const bookings = await adminService.getDashboardStats();
      const stats = {
        totalBookings:  bookings.length,
        pendingCount:   bookings.filter(b => b.status === 'PENDING').length,
        confirmedCount: bookings.filter(b => b.status === 'DONE').length,
        failedCount:    bookings.filter(b => b.status === 'FAILED' || b.status === 'CANCELLED').length,
        incompleteCount: bookings.filter(b => b.status === 'INCOMPLETE').length,
        totalRevenue:   bookings
          .filter(b => b.payment_status === 'paid' && b.status !== 'FAILED' && b.status !== 'CANCELLED')
          .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0),
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  },

  getAnalytics: async (req, res, next) => {
    try {
      const days = parseInt(req.query.days || '30', 10);
      const analytics = await adminService.getAnalytics(days);
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  },

  getAbandonedBookings: async (req, res, next) => {
    try {
      const abandoned = await adminService.getAbandonedBookings();
      res.json({
        success: true,
        data: abandoned,
        count: abandoned.length
      });
    } catch (error) {
      next(error);
    }
  },

  resendEmail: async (req, res, next) => {
    try {
      const { id } = req.params;
      const booking = await bookingRepository.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
      }

      const canonicalBooking = bookingMapper.toCanonicalModel(
        booking,
        booking.travellers || [],
        [{ email: booking.email, phone_number: booking.phone }],
        booking.flights || [],
        booking.payments || []
      );

      const emailRes = await sendBookingConfirmation(canonicalBooking, { force: true });
      if (emailRes.success) {
        await bookingRepository.recordEmailDelivery({
          webhook_id: `admin_resend_${Date.now()}`,
          booking_id: booking.id,
          recipient_email: booking.email,
          resend_message_id: emailRes.emailId,
          status: 'delivered'
        });
        return res.json({ success: true, message: 'Confirmation email resent successfully', emailId: emailRes.emailId });
      } else {
        return res.status(500).json({ success: false, error: { code: 'EMAIL_FAILED', message: emailRes.error || 'Email dispatch failed' } });
      }
    } catch (error) {
      next(error);
    }
  },

  processAuthorizedBooking: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { supplierConfirmation, airlinePnr, ticketNumbers } = req.body || {};

      const booking = await bookingRepository.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
      }

      if (booking.status !== 'AUTHORIZED' && booking.status !== 'READY_FOR_TICKETING' && booking.status !== 'AWAITING_AUTHORIZATION' && booking.status !== 'AWAITING_AUTH') {

        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: `Booking status is '${booking.status}'. Only AUTHORIZED bookings can be processed for ticketing.` }
        });
      }

      const pnr = airlinePnr || `PNR_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const suppConf = supplierConfirmation || `SUP_${Date.now()}`;
      const tickets = ticketNumbers || [`TKT-7788-${Date.now()}`];

      // Update Booking to TICKETED / PAID
      const updatedBooking = await bookingRepository.updateBookingStatus(booking.id, {
        status: 'TICKETED',
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        internal_notes: `Authorized charge processed cleanly. PNR: ${pnr}, Supplier Ref: ${suppConf}`
      });

      // Dispatch final burgundy booking confirmation email
      const canonicalBooking = bookingMapper.toCanonicalModel(
        { ...updatedBooking, status: 'DONE', payment_status: 'paid' },
        booking.travellers || [],
        [{ email: booking.email, phone_number: booking.phone }],
        booking.flights || [],
        booking.payments || []
      );

      await sendBookingConfirmation(canonicalBooking, { force: true });

      return res.json({
        success: true,
        bookingId: booking.id,
        confirmationCode: booking.confirmation_code,
        status: 'TICKETED',
        paymentStatus: 'paid',
        airlinePnr: pnr,
        supplierConfirmation: suppConf,
        ticketNumbers: tickets
      });
    } catch (error) {
      logger.error(`Error processing authorized booking ${req.params.id}: ${error.message}`);
      next(error);
    }
  }
};

export default adminController;


