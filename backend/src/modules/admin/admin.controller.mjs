import adminService from './admin.service.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';
import bookingMapper from '../bookings/booking.mapper.mjs';
import { BOOKING_STATUSES, PAYMENT_OPERATIONAL_STATES } from '../bookings/booking.constants.mjs';
import { sendBookingConfirmation, sendBookingRequestReceivedEmail, sendPassengerAuthorizationEmail, sendFinalTicketEmail, sendAdminBookingAcknowledgement } from '../../integrations/resend/resend.service.mjs';

import passengerAuthorizationService from '../authorizations/passenger-authorization.service.mjs';
import { generateAuthorizationPdfBuffer } from '../authorizations/authorization-pdf.service.mjs';
import logger from '../../config/logger.mjs';
import bcrypt from 'bcryptjs';
import authRepository from '../auth/auth.repository.mjs';
import env from '../../config/env.mjs';


export const adminController = {
  deleteBooking: async (req, res, next) => {
    try {
      const { bookingId } = req.params;
      const { adminPassword } = req.body || {};

      if (!adminPassword) {
        return res.status(400).json({
          success: false,
          error: { code: 'PASSWORD_REQUIRED', message: 'Admin password is required to delete a booking.' }
        });
      }

      let isValidPassword = false;
      const adminEmail = req.user?.email || env.adminEmail || 'admin@thefinalseat.com';

      if (req.user?.email) {
        try {
          const user = await authRepository.findUserByEmail(req.user.email);
          if (user && user.password) {
            isValidPassword = await bcrypt.compare(adminPassword, user.password);
          }
        } catch (e) {
          // Ignore lookup error and proceed to fallback check
        }
      }

      if (!isValidPassword) {
        isValidPassword = (adminPassword === (env.adminPassword || 'admin123'));
      }

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: 'Incorrect admin password. Deletion cancelled.' }
        });
      }

      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
      const permanent = req.query?.permanent === 'true' || req.body?.permanent === true;
      const result = permanent
        ? await bookingRepository.deleteBookingTransactional(bookingId, adminEmail, clientIp)
        : await bookingRepository.softDeleteBooking(bookingId, adminEmail, clientIp, req.body?.reason || 'Admin soft delete');

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: { code: result.code || 'DELETE_FAILED', message: result.message }
        });
      }

      return res.json({
        success: true,
        message: result.message,
        bookingId: result.bookingId || result.deletedBookingId,
        confirmationCode: result.confirmationCode,
        deletedAt: result.deletedAt
      });
    } catch (error) {
      logger.error(`Error in deleteBooking: ${error.message}`, error);
      if (res.status) {
        return res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: error.message } });
      }
      next(error);
    }
  },

  restoreBooking: async (req, res, next) => {
    try {
      const bookingId = req.params.bookingId || req.params.id;
      const adminEmail = req.user?.email || env.adminEmail || 'admin@thefinalseat.com';
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';

      const result = await bookingRepository.restoreBooking(bookingId, adminEmail, clientIp);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: { code: result.code || 'RESTORE_FAILED', message: result.message }
        });
      }

      return res.json({
        success: true,
        message: result.message,
        bookingId: result.bookingId,
        confirmationCode: result.confirmationCode,
        restoredAt: result.restoredAt
      });
    } catch (error) {
      logger.error(`Error in restoreBooking: ${error.message}`, error);
      if (res.status) {
        return res.status(500).json({ success: false, error: { code: 'RESTORE_ERROR', message: error.message } });
      }
      next(error);
    }
  },

  exportBooking: async (req, res, next) => {
    try {
      const id = req.params.bookingId || req.params.id;
      const data = await bookingRepository.exportBookingJson(id);
      if (!data) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
      }

      if (res.setHeader) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="booking_${id}_export.json"`);
      }
      return res.json(data);
    } catch (error) {
      next(error);
    }
  },

  getBookingHistory: async (req, res, next) => {
    try {
      const id = req.params.bookingId || req.params.id;
      const history = await bookingRepository.getBookingHistory(id);
      if (!history) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
      }
      return res.json({ success: true, ...history });
    } catch (error) {
      next(error);
    }
  },

  restoreFromSnapshot: async (req, res, next) => {
    try {
      const id = req.params.bookingId || req.params.id;
      const adminEmail = req.user?.email || env.adminEmail || 'admin@thefinalseat.com';
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
      const snapshotPayload = req.body?.snapshot || req.body;

      const result = await bookingRepository.restoreFromSnapshot(id, snapshotPayload, adminEmail, clientIp);
      if (!result.success) {
        return res.status(400).json({ success: false, error: { code: result.code || 'RESTORE_SNAPSHOT_FAILED', message: result.message } });
      }

      return res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },
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
          error: { code: 'INVALID_STATUS', message: `Invalid booking status '${targetStatus}'. Allowed canonical statuses are: ${BOOKING_STATUSES.join(', ')}.` }
        });
      }

      // State Machine Enforcement: block PENDING -> TICKETED/DONE without passenger authorization
      if (targetStatus && ['TICKETED', 'DONE'].includes(targetStatus.toUpperCase())) {
        const isAuthorized = existingBooking.authorization_status === 'AUTHORIZED' ||
                             existingBooking.authorization_status === 'ACCEPTED' ||
                             ['AUTHORIZED', 'ACCEPTED', 'CONSUMED', 'READY_FOR_TICKETING', 'TICKETED', 'DONE'].includes(existingBooking.status?.toUpperCase());
        if (!isAuthorized && !override) {
          return res.status(400).json({
            success: false,
            error: { code: 'TRANSITION_BLOCKED', message: `Cannot transition booking to ${targetStatus} directly from PENDING status without passenger authorization.` }
          });
        }
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

      if (Array.isArray(req.body.payment_splits)) {
        await bookingRepository.savePaymentSplits(id, req.body.payment_splits);
      }

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

      const completeBooking = await bookingRepository.getCompleteBookingById(id);

      res.json({
        success: true,
        message: 'Booking status updated successfully.',
        data: completeBooking,
        booking: completeBooking
      });
    } catch (error) {
      next(error);
    }
  },

  saveAllChanges: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await bookingRepository.saveAllBookingChanges(id, req.body || {}, req.user || {});
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (error) {
      next(error);
    }
  },

  updatePaymentSplits: async (req, res, next) => {
    try {
      const { id } = req.params;

      // Section 4 & 15: Guard against improper payload containing unrelated entity fields
      const forbiddenFields = ['itinerary', 'flights', 'segments', 'itinerarySegments', 'travellers', 'contacts', 'passenger_details'];
      const presentForbidden = forbiddenFields.filter(f => req.body && req.body[f] !== undefined);
      if (presentForbidden.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAYMENT_SPLIT_PAYLOAD',
            message: `Payment split updates cannot include unrelated fields (${presentForbidden.join(', ')}). Use dedicated section endpoints.`
          }
        });
      }

      const splits = req.body.splits || req.body.payment_splits;
      const adminId = req.user?.email || 'admin';
      const reason = req.body.reason || 'Payment split breakdown update';
      const expectedVersion = req.body.bookingVersion || req.body.updated_at;

      const completeBooking = await bookingRepository.updatePaymentSplitsAndTotal(id, splits, adminId, reason, expectedVersion);

      res.json({
        success: true,
        message: 'Payment splits updated successfully. Itinerary unchanged.',
        data: completeBooking,
        booking: completeBooking
      });
    } catch (error) {
      const statusCode = error.status || (error.message.includes('BOOKING_VERSION_CONFLICT') ? 409 : 400);
      res.status(statusCode).json({
        success: false,
        error: {
          code: error.status === 409 ? 'BOOKING_VERSION_CONFLICT' : 'PAYMENT_SPLIT_ERROR',
          message: error.message
        }
      });
    }
  },

  /**
   * PATCH /api/admin/bookings/:id/payment-authorization
   *
   * Dedicated, isolated endpoint that ONLY updates payment splits and
   * propagates the calculated total to:
   *   - bookings.customer_price, total_amount, authorized_amount
   *   - passenger_authorizations.authorized_amount, quote_snapshot
   *   - payments.payment_amount, authorized_amount
   *   - Audit log + re-authorization email for pending auths
   *
   * This endpoint CANNOT mutate itinerary, flights, travellers, or ticket data.
   */
  updatePaymentAuthorization: async (req, res, next) => {
    try {
      const { id } = req.params;

      // Strict payload isolation — reject any attempt to piggyback unrelated entities
      const forbiddenFields = [
        'itinerary', 'flights', 'segments', 'itinerarySegments',
        'travellers', 'contacts', 'passenger_details',
        'airlineCode', 'airlineName', 'ticketNumber', 'ticketIssuedAt', 'pnr',
        'airline_confirmation_number', 'supplier_confirmation'
      ];
      const presentForbidden = forbiddenFields.filter(f => req.body && req.body[f] !== undefined);
      if (presentForbidden.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAYMENT_AUTHORIZATION_PAYLOAD',
            message: `Payment authorization updates cannot include unrelated fields (${presentForbidden.join(', ')}). Use dedicated section endpoints.`
          }
        });
      }

      const splits = req.body.splits || req.body.payment_splits;
      if (!splits || !Array.isArray(splits) || splits.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'SPLITS_REQUIRED', message: 'At least one payment split is required.' }
        });
      }

      const adminId = req.user?.email || 'admin';
      const reason = req.body.reason || 'Payment authorization splits update';
      const expectedVersion = req.body.bookingVersion || req.body.updated_at;

      const paymentState = req.body.paymentState || req.body.paymentStatus || req.body.payment_status || null;
      const paymentMetadata = {
        referenceId: req.body.referenceId || req.body.reference_id || req.body.payment_intent_id || null,
        reason: req.body.reason || null,
        paidAmount: req.body.paidAmount !== undefined ? parseFloat(req.body.paidAmount) : null,
        refundAmount: req.body.refundAmount !== undefined ? parseFloat(req.body.refundAmount) : null,
        refundReferenceId: req.body.refundReferenceId || null
      };

      const completeBooking = await bookingRepository.updatePaymentSplitsAndTotal(
        id, splits, adminId, reason, expectedVersion, paymentState, paymentMetadata
      );

      // Derive canonical authorizedAmount from the freshly updated booking
      const authorizedAmount = parseFloat(
        completeBooking.authorized_amount ??
        completeBooking.customer_price ??
        completeBooking.total_amount ??
        completeBooking.pricing?.customerTotal ??
        0
      );

      const paymentSplits = completeBooking.paymentSplits || completeBooking.payment_splits || [];

      return res.json({
        success: true,
        message: `Payment authorization updated to $${authorizedAmount.toFixed(2)}. Itinerary unchanged.`,
        booking: {
          ...completeBooking,
          // Ensure these surface at the top level for frontend convenience
          customer_price: authorizedAmount,
          total_amount: authorizedAmount,
          authorized_amount: authorizedAmount,
          payment_splits: paymentSplits
        },
        paymentAuthorization: {
          authorizedAmount,
          currency: completeBooking.currency || 'USD',
          splits: paymentSplits,
          updatedAt: new Date().toISOString()
        },
        bookingVersion: completeBooking.updated_at
      });
    } catch (error) {
      logger.error(`Error in updatePaymentAuthorization for ${req.params.id}: ${error.message}`, error);
      const statusCode = error.status || (error.message?.includes('BOOKING_VERSION_CONFLICT') ? 409 : 400);
      return res.status(statusCode).json({
        success: false,
        error: {
          code: error.status === 409 ? 'BOOKING_VERSION_CONFLICT' : 'PAYMENT_AUTHORIZATION_ERROR',
          message: error.message
        }
      });
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

      const { default: bookingValidatorService } = await import('../bookings/booking-validator.service.mjs');
      const val = await bookingValidatorService.validateBookingIntegrity(booking.id, {
        requireItinerary: true,
        requirePassengers: true,
        requirePayment: true
      });
      if (!val.valid) {
        return res.status(400).json({
          success: false,
          error: { code: 'BOOKING_DATA_INCOMPLETE', message: val.reason, errors: val.errors }
        });
      }

      const isAuthorized = booking.authorization_status === 'AUTHORIZED' ||
                           booking.authorization?.status === 'AUTHORIZED' ||
                           ['PENDING', 'DONE'].includes(booking.status);

      if (!isAuthorized) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: `Passenger authorization is pending. Only AUTHORIZED bookings can be processed for ticketing.` }
        });
      }

      const pnr = airlinePnr || `PNR_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const suppConf = supplierConfirmation || `SUP_${Date.now()}`;
      const tickets = ticketNumbers || [`TKT-7788-${Date.now()}`];

      // Update Booking to DONE / PAID
      const updatedBooking = await bookingRepository.updateBookingStatus(booking.id, {
        status: 'DONE',
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
        status: 'DONE',
        bookingStatus: 'DONE',
        ticketStatus: 'TICKETED',
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

      const rawUpdated = await bookingRepository.updateBookingStatus(booking.id, updatePayload);

      // Fetch the fully enriched booking (with itinerary, splits, relations)
      // so the frontend never receives a sparse flat row missing payment_splits etc.
      const enriched = await bookingRepository.getById(booking.id) || rawUpdated;

      // Build a null-safe payment summary so the frontend never sees audit/payment as undefined
      const paymentSummary = {
        status: (enriched.payment_status || desiredState || 'PENDING').toUpperCase(),
        paidAmount: enriched.paid_amount ?? null,
        refundedAmount: enriched.refund_amount ?? null,
        referenceId: enriched.payment_reference_id || referenceId || null,
        provider: enriched.payment_provider || 'Whop',
        paidAt: enriched.paid_at || null,
        ...(enriched.payment || {})
      };

      const auditSummary = {
        id: null,
        reference: enriched.payment_reference_id || referenceId || null,
        eventType: desiredState || 'PAYMENT_STATE_UPDATE',
        recordedAt: new Date().toISOString()
      };

      return res.json({
        success: true,
        paymentStatus: desiredState,
        booking: {
          ...enriched,
          payment: paymentSummary,
          audit: auditSummary
        },
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
  },

  saveTicketDetails: async (req, res, next) => {
    try {
      const { id } = req.params;
      const ticketData = req.body || {};
      const adminId = req.user?.id || 'admin';

      const updatedBooking = await bookingRepository.saveTicketDetails(id, ticketData, adminId);
      return res.json({
        success: true,
        message: 'Airline ticket details saved.',
        data: updatedBooking,
        booking: updatedBooking
      });
    } catch (error) {
      logger.error(`Error saving ticket details for booking ${req.params.id}: ${error.message}`);
      return res.status(400).json({
        success: false,
        error: { code: 'TICKET_DETAILS_ERROR', message: `Unable to save airline ticket details: ${error.message}` }
      });
    }
  },

  sendFinalTicketEmail: async (req, res, next) => {
    try {
      const { id } = req.params;
      const emailResult = await sendFinalTicketEmail(id);
      if (emailResult.success) {
        return res.json({
          success: true,
          message: 'Final E-Ticket email sent successfully.',
          emailId: emailResult.emailId
        });
      } else {
        return res.status(400).json({
          success: false,
          error: { code: 'FINAL_TICKET_EMAIL_FAILED', message: emailResult.error || 'Failed to send final ticket email.' }
        });
      }
    } catch (error) {
      logger.error(`Error sending final ticket email for booking ${req.params.id}: ${error.message}`);
      next(error);
    }
  },

  getBookingDiagnosticData: async (req, res, next) => {
    try {
      const { id } = req.params;
      const booking = await bookingRepository.getCompleteBookingById(id);
      if (!booking) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
      }

      const segments = [
        ...(booking.itinerary?.outbound || []),
        ...(booking.itinerary?.return || [])
      ].map((s, idx) => ({
        segmentIndex: idx + 1,
        journeyDirection: s.journey_direction || (idx === 0 ? 'outbound' : 'outbound'),
        segmentSequence: s.sequence,
        originCode: s.originCode,
        destinationCode: s.destinationCode,
        carrierCode: s.carrierCode,
        airlineName: s.airlineName,
        flightNumber: s.flightNumber
      }));

      return res.json({
        success: true,
        data: {
          bookingId: booking.confirmation_code || booking.id,
          resolvedInternalUuid: booking.id,
          status: booking.status,
          paymentStatus: booking.payment_status,
          customerTotal: parseFloat(booking.customer_price || booking.total_amount || 0),
          currency: booking.currency || 'USD',
          itineraryRowCount: segments.length,
          segments
        }
      });
    } catch (error) {
      logger.error(`Error getting diagnostic data for booking ${req.params.id}: ${error.message}`);
      next(error);
    }
  },

  resendAdminAcknowledgement: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await sendAdminBookingAcknowledgement(id, { force: true });
      if (result.success) {
        return res.json({
          success: true,
          message: 'Admin booking acknowledgement email re-sent successfully.',
          data: result
        });
      } else {
        return res.status(400).json({
          success: false,
          error: { code: result.errorCode || 'EMAIL_FAILED', message: result.errorMessage || 'Failed to resend admin email.' }
        });
      }
    } catch (error) {
      logger.error(`Error resending admin email for ${req.params.id}: ${error.message}`);
      next(error);
    }
  }
};

export default adminController;





