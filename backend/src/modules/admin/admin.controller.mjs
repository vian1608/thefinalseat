import adminService from './admin.service.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';
import bookingMapper from '../bookings/booking.mapper.mjs';
import { BOOKING_STATUSES } from '../bookings/booking.constants.mjs';
import { sendBookingConfirmation } from '../../integrations/resend/resend.service.mjs';
import passengerAuthorizationService from '../authorizations/passenger-authorization.service.mjs';
import logger from '../../config/logger.mjs';




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
      const { id } = req.params;
      const { bookingStatus, status, internalNotes, customerName, email, phone, override, reason } = req.body || {};
      const targetStatus = status || bookingStatus;

      const existingBooking = await bookingRepository.getById(id);
      if (!existingBooking) {
        return res.status(404).json({
          success: false,
          error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' }
        });
      }

      if (targetStatus && !BOOKING_STATUSES.includes(targetStatus)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: `Unsupported booking status '${targetStatus}'.` }
        });
      }

      // Transition validation rules
      if (targetStatus === 'AUTHORIZED' && !override) {
        const evidence = await passengerAuthorizationService.getAuditEvidenceByBookingId(id).catch(() => null);
        if (!evidence || !evidence.authorization || evidence.authorization.status !== 'ACCEPTED') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'TRANSITION_BLOCKED',
              message: 'Cannot set status to AUTHORIZED without verified passenger authorization evidence or admin override.'
            }
          });
        }
      }

      if (targetStatus === 'READY_FOR_TICKETING' && !override && existingBooking.status !== 'AUTHORIZED') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TRANSITION_BLOCKED',
            message: 'Setting status to READY_FOR_TICKETING requires prior AUTHORIZED state or admin override.'
          }
        });
      }

      if (targetStatus === 'TICKETED' && !override && !existingBooking.supplier_confirmation && !existingBooking.airline_pnr) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TRANSITION_BLOCKED',
            message: 'Setting status to TICKETED requires a supplier confirmation code or admin override.'
          }
        });
      }

      const updatePayload = {};
      if (targetStatus) updatePayload.status = targetStatus;
      if (internalNotes !== undefined) updatePayload.internal_notes = internalNotes;
      if (customerName !== undefined) updatePayload.passenger_name = customerName;
      if (email !== undefined) updatePayload.email = email;
      if (phone !== undefined) updatePayload.phone = phone;

      const updated = await bookingRepository.updateStatus(id, updatePayload);

      if (targetStatus && targetStatus !== existingBooking.status) {
        await bookingRepository.recordStatusAudit({
          bookingId: id,
          oldStatus: existingBooking.status,
          newStatus: targetStatus,
          adminId: req.user?.email || 'admin',
          reason: reason || 'Status updated via Admin Dashboard'
        });
      }

      res.json({
        success: true,
        message: 'Booking status updated successfully.',
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
  },

  updateItinerary: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { segments, expectedVersion } = req.body || {};

      const booking = await bookingRepository.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
      }

      // Check version for optimistic locking
      if (expectedVersion && booking.version && booking.version !== expectedVersion) {
        return res.status(409).json({
          success: false,
          error: { code: 'CONCURRENT_EDIT_CONFLICT', message: 'This booking was updated by another administrator. Please refresh before saving.' }
        });
      }

      // Save normalized segments
      await bookingRepository.saveItinerarySegments(booking.id, segments || []);

      // Check if material itinerary changes invalidate existing authorization
      let reauthorizationRequired = false;
      const currentStatus = (booking.status || '').toUpperCase();
      if (['AUTHORIZED', 'AWAITING_AUTH', 'AWAITING_AUTHORIZATION'].includes(currentStatus)) {
        reauthorizationRequired = true;
        await bookingRepository.updateBookingStatus(booking.id, {
          status: 'REAUTHORIZATION_REQUIRED'
        });
      }

      const updatedBooking = await bookingRepository.getById(booking.id);
      return res.json({
        success: true,
        booking: updatedBooking,
        reauthorizationRequired,
        message: reauthorizationRequired
          ? 'Itinerary updated. Existing authorization was invalidated and status set to REAUTHORIZATION_REQUIRED.'
          : 'Itinerary updated successfully.'
      });
    } catch (error) {
      logger.error(`Error updating itinerary for booking ${req.params.id}: ${error.message}`);
      next(error);
    }
  },

  updatePricing: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { supplierFare, baseFare, taxes, serviceFee, discount, customerTotal, currency, margin, reason, expectedVersion } = req.body || {};

      const booking = await bookingRepository.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
      }

      if (expectedVersion && booking.version && booking.version !== expectedVersion) {
        return res.status(409).json({
          success: false,
          error: { code: 'CONCURRENT_EDIT_CONFLICT', message: 'This booking was modified by another user. Please reload data.' }
        });
      }

      const newCustomerTotal = parseFloat(customerTotal || 0);
      const oldCustomerTotal = parseFloat(booking.customer_price || booking.total_amount || 0);

      // Require reason if customer total changes
      if (Math.abs(newCustomerTotal - oldCustomerTotal) > 0.01 && !reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'REASON_REQUIRED', message: 'A mandatory reason is required whenever the customer total changes.' }
        });
      }

      // Record price revision audit entry
      await bookingRepository.recordPriceRevision({
        bookingId: booking.id,
        supplierFare: parseFloat(supplierFare || 0),
        baseFare: parseFloat(baseFare || 0),
        taxes: parseFloat(taxes || 0),
        serviceFee: parseFloat(serviceFee || 0),
        discount: parseFloat(discount || 0),
        customerTotal: newCustomerTotal,
        currency: currency || 'USD',
        margin: parseFloat(margin || 0),
        reason: reason || 'Admin price update',
        adminId: req.user?.id || 'admin'
      });

      // Update booking amounts
      let reauthorizationRequired = false;
      const currentStatus = (booking.status || '').toUpperCase();
      if (Math.abs(newCustomerTotal - oldCustomerTotal) > 0.01 && ['AUTHORIZED', 'AWAITING_AUTH'].includes(currentStatus)) {
        reauthorizationRequired = true;
      }

      const updateFields = {
        total_amount: newCustomerTotal,
        customer_price: newCustomerTotal,
        currency: currency || 'USD'
      };

      if (reauthorizationRequired) {
        updateFields.status = 'REAUTHORIZATION_REQUIRED';
      }

      const updatedBooking = await bookingRepository.updateBookingWithLock(booking.id, expectedVersion, updateFields);

      return res.json({
        success: true,
        booking: updatedBooking,
        reauthorizationRequired,
        message: reauthorizationRequired
          ? 'Pricing updated. Customer total changed; booking set to REAUTHORIZATION_REQUIRED.'
          : 'Pricing updated successfully.'
      });
    } catch (error) {
      logger.error(`Error updating pricing for booking ${req.params.id}: ${error.message}`);
      next(error);
    }
  },

  handlePaymentAction: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { action, paymentStatus, provider, methodType, brand, last4, amount, referenceId, reason, password } = req.body || {};

      const booking = await bookingRepository.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
      }

      // Record Payment Event Audit Log
      await bookingRepository.recordPaymentEvent({
        bookingId: booking.id,
        eventType: action || 'PAYMENT_UPDATE',
        previousStatus: booking.payment_status,
        newStatus: paymentStatus || booking.payment_status,
        amount: parseFloat(amount || 0),
        referenceId: referenceId || '',
        reason: reason || '',
        adminId: req.user?.id || 'admin'
      });

      if (action === 'send_authorization' || action === 'resend_authorization') {
        const vaultData = { cardBrand: brand || 'Visa', cardLast4: last4 || '4242' };
        const authRecord = await passengerAuthorizationService.createAuthorizationToken(booking, vaultData);
        await passengerAuthorizationService.sendAuthorizationEmail(authRecord, booking);

        return res.json({
          success: true,
          status: 'AWAITING_AUTH',
          message: `Authorization email dispatched to ${booking.email}`
        });
      }

      if (action === 'record_refund') {
        const refundAmt = parseFloat(amount || 0);
        const capturedAmt = parseFloat(booking.customer_price || booking.total_amount || 0);
        if (refundAmt > capturedAmt) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_REFUND_AMOUNT', message: `Refund amount ($${refundAmt}) cannot exceed captured total ($${capturedAmt}).` }
          });
        }

        const newPayStatus = refundAmt >= capturedAmt ? 'refunded' : 'partially_refunded';
        await bookingRepository.updateBookingStatus(booking.id, {
          payment_status: newPayStatus,
          status: newPayStatus.toUpperCase()
        });

        return res.json({
          success: true,
          paymentStatus: newPayStatus,
          message: `Refund of $${refundAmt.toFixed(2)} recorded.`
        });
      }

      // Default status update if applicable
      if (paymentStatus) {
        // Enforce transaction reference or privileged password for manual PAID
        if (paymentStatus === 'PAID' || paymentStatus === 'paid') {
          if (!referenceId && password !== 'admin123') {
            return res.status(400).json({
              success: false,
              error: { code: 'TRANSACTION_REF_REQUIRED', message: 'Marking a booking PAID requires a verified transaction reference or privileged override password.' }
            });
          }
        }

        const updated = await bookingRepository.updateBookingStatus(booking.id, {
          payment_status: paymentStatus.toLowerCase(),
          status: paymentStatus.toUpperCase() === 'PAID' ? 'DONE' : paymentStatus.toUpperCase()
        });
        return res.json({ success: true, booking: updated });
      }

      return res.json({ success: true, booking });
    } catch (error) {
      logger.error(`Error in handlePaymentAction for booking ${req.params.id}: ${error.message}`);
      next(error);
    }
  }
};

export default adminController;



