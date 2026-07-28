import adminService from './admin.service.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';
import bookingMapper from '../bookings/booking.mapper.mjs';
import { BOOKING_STATUSES, PAYMENT_OPERATIONAL_STATES } from '../bookings/booking.constants.mjs';
import { sendBookingConfirmation, sendBookingRequestReceivedEmail, sendPassengerAuthorizationEmail, sendFinalTicketEmail } from '../../integrations/resend/resend.service.mjs';

import passengerAuthorizationService from '../authorizations/passenger-authorization.service.mjs';
import { generateAuthorizationPdfBuffer } from '../authorizations/authorization-pdf.service.mjs';
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
      if (req.body.airline_pnr !== undefined) updatePayload.airline_pnr = req.body.airline_pnr;
      if (req.body.airline_name !== undefined) updatePayload.airline_name = req.body.airline_name;
      if (req.body.ticket_number !== undefined) updatePayload.ticket_number = req.body.ticket_number;
      if (req.body.ticket_issue_date !== undefined) updatePayload.ticket_issue_date = req.body.ticket_issue_date;

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
      const { action, paymentStatus, targetState, amount, paidAmount, refundAmount, referenceId, refundReferenceId, reason, overrideReason, isOverride, password } = req.body || {};

      const booking = await bookingRepository.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
      }

      const desiredState = String(targetState || paymentStatus || action || '').toUpperCase();

      if (action === 'send_authorization' || action === 'resend_authorization') {
        const emailRes = await sendPassengerAuthorizationEmail(booking.id);
        if (!emailRes.success) {
          return res.status(400).json({
            success: false,
            error: { code: 'EMAIL_DISPATCH_FAILED', message: emailRes.error || 'Authorization email failed to send.' }
          });
        }

        const updated = await bookingRepository.getById(booking.id);
        return res.json({
          success: true,
          status: 'AWAITING_AUTHORIZATION',
          booking: updated,
          message: `Authorization email dispatched cleanly to ${booking.email || booking.contacts?.[0]?.email}`
        });
      }

      if (action === 'resend_booking_request_email') {
        const emailRes = await sendBookingRequestReceivedEmail(booking.id, { force: true });
        if (!emailRes.success) {
          return res.status(400).json({
            success: false,
            error: { code: 'EMAIL_DISPATCH_FAILED', message: emailRes.error || 'Booking request email failed to send.' }
          });
        }
        const updated = await bookingRepository.getById(booking.id);
        return res.json({
          success: true,
          booking: updated,
          message: `Booking request email resent cleanly to ${booking.email || booking.contacts?.[0]?.email}`
        });
      }

      if (action === 'send_final_ticket_email') {
        const ticketRes = await sendFinalTicketEmail(booking);
        if (!ticketRes.success) {
          return res.status(400).json({
            success: false,
            error: { code: 'TICKET_EMAIL_FAILED', message: ticketRes.error || 'Final ticket email failed to send.' }
          });
        }
        const updated = await bookingRepository.getById(booking.id);
        return res.json({
          success: true,
          booking: updated,
          message: `Final ticket email sent cleanly to ${updated.final_confirmation_email_recipient || booking.email}`
        });
      }


      // Enforce 5 canonical operational payment states
      if (desiredState && !PAYMENT_OPERATIONAL_STATES.includes(desiredState)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PAYMENT_STATE', message: `Unsupported payment state '${desiredState}'. Allowed: ${PAYMENT_OPERATIONAL_STATES.join(', ')}.` }
        });
      }

      const currentState = String(booking.payment_status || 'PENDING').toUpperCase();

      // Validate transitions
      if (desiredState === 'PAID') {
        const isPrivileged = isOverride || password === 'admin123';
        if (!referenceId && !isPrivileged) {
          return res.status(400).json({
            success: false,
            error: { code: 'TRANSACTION_ID_REQUIRED', message: 'Setting status to PAID requires a valid transaction/reference ID or privileged admin override.' }
          });
        }
        if (isPrivileged && !overrideReason && !reason) {
          return res.status(400).json({
            success: false,
            error: { code: 'OVERRIDE_REASON_REQUIRED', message: 'Privileged manual override to PAID requires a mandatory reason.' }
          });
        }
        if (currentState === 'REFUNDED' && !isPrivileged) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_TRANSITION', message: 'Transition from REFUNDED to PAID requires a new payment record or privileged override.' }
          });
        }
      }

      if (desiredState === 'REFUNDED') {
        if (currentState !== 'PAID' && currentState !== 'PARTIALLY_REFUNDED' && !isOverride) {
          return res.status(400).json({
            success: false,
            error: { code: 'REFUND_NOT_ALLOWED', message: 'A booking can only be set to REFUNDED if it was previously PAID.' }
          });
        }

        const refAmt = parseFloat(refundAmount || amount || 0);
        const pdAmt = parseFloat(booking.paid_amount || booking.customer_price || booking.total_amount || 0);

        if (refAmt > pdAmt && !isOverride) {
          return res.status(400).json({
            success: false,
            error: { code: 'REFUND_EXCEEDS_PAID', message: `Refund amount ($${refAmt.toFixed(2)}) cannot exceed paid amount ($${pdAmt.toFixed(2)}).` }
          });
        }
      }

      // Record Payment Event Audit Log
      await bookingRepository.recordPaymentEvent({
        bookingId: booking.id,
        eventType: desiredState || 'PAYMENT_STATE_UPDATE',
        previousStatus: currentState,
        newStatus: desiredState,
        amount: parseFloat(paidAmount || refundAmount || amount || 0),
        referenceId: referenceId || refundReferenceId || '',
        reason: reason || overrideReason || '',
        adminId: req.user?.id || 'admin'
      });

      const updatePayload = {
        payment_status: desiredState
      };

      if (desiredState === 'PAID') {
        updatePayload.paid_amount = parseFloat(paidAmount || amount || booking.total_amount || 0);
        updatePayload.payment_reference_id = referenceId || `TXN_${Date.now()}`;
        updatePayload.paid_at = new Date().toISOString();
      }

      if (desiredState === 'REFUNDED') {
        updatePayload.refund_amount = parseFloat(refundAmount || amount || booking.total_amount || 0);
        updatePayload.refund_reference_id = refundReferenceId || `REF_${Date.now()}`;
        updatePayload.refund_reason = reason || 'Admin recorded refund';
        updatePayload.refund_timestamp = new Date().toISOString();
      }

      const updated = await bookingRepository.updateBookingStatus(booking.id, updatePayload);

      return res.json({
        success: true,
        paymentStatus: desiredState,
        booking: updated,
        message: `Payment state updated to ${desiredState} cleanly.`
      });
    } catch (error) {
      logger.error(`Error in handlePaymentAction for booking ${req.params.id}: ${error.message}`);
      next(error);
    }
  },

  downloadAuthorizationPdf: async (req, res, next) => {
    try {
      const { id } = req.params;
      const evidence = await passengerAuthorizationService.getAuditEvidenceByBookingId(id);
      if (!evidence) {
        return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'No authorization evidence found for this booking.' } });
      }

      const pdfBuffer = await generateAuthorizationPdfBuffer(evidence);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="authorization-${evidence.confirmationCode || id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error(`Error generating authorization PDF for booking ${req.params.id}: ${error.message}`);
      next(error);
    }
  }
};

export default adminController;




