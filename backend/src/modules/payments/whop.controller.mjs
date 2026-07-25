import env from '../../config/env.mjs';
import logger from '../../config/logger.mjs';
import whopService from '../../integrations/whop/whop.service.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';
import { calculateBookingTotal } from '../../shared/utils/pricing.helper.mjs';
import { sendBookingConfirmation } from '../../integrations/resend/resend.service.mjs';
import bookingMapper from '../bookings/booking.mapper.mjs';

export const whopController = {
  /**
   * POST /api/whop/create-checkout
   * Server-side authoritative Whop checkout creation for a booking
   */
  createCheckout: async (req, res) => {
    const { bookingId } = req.body;
    try {
      if (!bookingId) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_BOOKING_ID', message: 'bookingId is required' }
        });
      }

      // Check feature flag WHOP_FLIGHT_CHECKOUT_ENABLED
      if (!env.whopFlightCheckoutEnabled && env.nodeEnv === 'production') {
        return res.status(403).json({
          success: false,
          error: { code: 'WHOP_DISABLED', message: 'Whop flight checkout is not currently active' }
        });
      }

      // 1. Fetch booking record from Supabase
      const booking = await bookingRepository.getById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: { code: 'BOOKING_NOT_FOUND', message: `Booking ${bookingId} not found` }
        });
      }

      // 2. Reject offline / mock flight results
      if (booking.is_mock || booking.flight_details?.isMock) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MOCK_FLIGHT_NOT_BOOKABLE',
            message: 'Offline / sample flight routes cannot be booked online. Please contact our support team.'
          }
        });
      }

      // 3. Reject already paid or cancelled bookings
      if (booking.payment_status === 'paid') {
        return res.status(400).json({
          success: false,
          error: { code: 'BOOKING_ALREADY_PAID', message: 'This booking has already been paid.' }
        });
      }

      if (booking.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_BOOKING_STATUS', message: `Booking is currently in ${booking.status} status` }
        });
      }

      // Reset payment status to 'pending' on retry if previously failed
      if (booking.payment_status === 'FAILED' || booking.payment_status === 'failed') {
        await bookingRepository.updateBookingStatus(booking.id, {
          payment_status: 'pending',
          payment_provider: 'whop'
        });
      }

      // 4. Calculate authoritative 10% discount price in integer cents
      const supplierPrice = parseFloat(booking.supplier_price || booking.original_api_price || booking.total_amount || 0);
      const discountAmount = parseFloat(booking.discount_amount || Math.max(0, supplierPrice * 0.10));
      const customerPrice = parseFloat(booking.customer_price || booking.total_amount || (supplierPrice - discountAmount));

      if (isNaN(customerPrice) || customerPrice <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PRICE', message: 'Invalid customer payable amount calculated by server' }
        });
      }

      // 5. Create Whop checkout configuration with authoritative price
      const whopCheckout = await whopService.createCheckoutConfiguration({
        bookingId: booking.id,
        bookingReference: booking.confirmation_code,
        customerEmail: booking.email,
        amount: customerPrice,
        currency: booking.currency || 'USD'
      });

      // 6. Update booking record with provider_checkout_id and provider
      await bookingRepository.updateBookingStatus(booking.id, {
        provider_checkout_id: whopCheckout.sessionId,
        payment_provider: 'whop',
        payment_status: 'pending'
      });

      return res.json({
        success: true,
        sessionId: whopCheckout.sessionId,
        planId: whopCheckout.planId,
        env: env.whopEnv,
        price: {
          supplierPrice: supplierPrice.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          customerPrice: customerPrice.toFixed(2),
          currency: (booking.currency || 'USD').toUpperCase()
        }
      });
    } catch (err) {
      logger.error(`Error in Whop createCheckout: ${err.message}`);
      if (bookingId) {
        try {
          await bookingRepository.updateBookingStatus(bookingId, {
            payment_status: 'FAILED',
            payment_provider: 'whop',
            internal_notes: `Whop checkout initialization failed: ${err.message}`
          });
        } catch (dbErr) {
          logger.warn(`Failed to update booking status to FAILED: ${dbErr.message}`);
        }
      }
      return res.status(500).json({
        success: false,
        error: { code: 'WHOP_CHECKOUT_FAILED', message: err.message }
      });
    }
  },

  /**
   * POST /api/webhooks/whop
   * Verified, idempotent webhook handler for Whop payment events
   */
  /**
   * POST /api/webhooks/whop
   * Verified, idempotent webhook handler for Whop payment events using @whop/sdk
   */
  handleWebhook: async (req, res) => {
    try {
      const rawBody = req.body;
      const headers = req.headers;

      // 1. Verify and unwrap webhook using official @whop/sdk webhooks.unwrap
      let event;
      try {
        event = whopService.verifyAndUnwrapWebhook(rawBody, headers);
      } catch (unwrapErr) {
        logger.warn(`[Whop] Webhook signature verification failed: ${unwrapErr.message}`);
        return res.status(401).json({ success: false, error: `Invalid webhook signature: ${unwrapErr.message}` });
      }

      if (!event) {
        return res.status(400).json({ success: false, error: 'Unwrapped webhook event is null' });
      }

      // Exact event type — NEVER default absent event types to payment.succeeded
      const eventType = String(event.action || event.event || event.type || event.action_type || '').trim();
      if (!eventType) {
        logger.warn('[Whop] Webhook event received without valid event type');
        return res.status(400).json({ success: false, error: 'Event missing type field' });
      }

      const webhookId = headers['webhook-id'] || headers['x-whop-id'] || event.id || `wh_${Date.now()}`;

      // 2. Idempotent Deduplication Check
      const existingEvent = await bookingRepository.getWebhookEvent(webhookId);
      if (existingEvent) {
        logger.info(`Duplicate Whop webhook received and skipped: ${webhookId}`);
        return res.status(200).json({ success: true, received: true, duplicate: true });
      }

      // Record event in webhook_events table
      await bookingRepository.recordWebhookEvent({
        id: String(webhookId),
        provider: 'whop',
        event_type: eventType,
        payload: event
      });

      // 3. Process Verified Event
      const data = event.data || event;
      const metadata = data.metadata || event.metadata || {};
      const bookingId = metadata.bookingId || metadata.booking_id || data.booking_id;

      if (eventType === 'payment.succeeded' || eventType === 'payment_succeeded' || eventType.includes('payment.succeeded')) {
        if (!bookingId) {
          logger.warn('[Whop] payment.succeeded event missing metadata bookingId');
          return res.status(200).json({ success: true, warning: 'Missing bookingId in metadata' });
        }

        const booking = await bookingRepository.getById(bookingId);
        if (!booking) {
          logger.error(`[Whop] Webhook booking ${bookingId} not found in database`);
          return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        const providerPaymentId = data.id || data.payment_id || `wh_pay_${Date.now()}`;
        const providerCheckoutId = data.checkout_configuration_id || metadata.sessionId || booking.provider_checkout_id;
        const paidAmount = parseFloat(data.final_amount || data.amount || metadata.expectedAmount || booking.customer_price || booking.total_amount);

        // Update payment table record (insert/update row)
        await bookingRepository.insertPayment({
          booking_id: booking.id,
          payment_provider: 'whop',
          provider_payment_id: providerPaymentId,
          provider_checkout_id: providerCheckoutId,
          payment_amount: paidAmount,
          currency: (booking.currency || 'USD').toUpperCase(),
          payment_status: 'paid',
          payment_date: new Date().toISOString()
        });

        // Update booking master record
        await bookingRepository.updateBookingStatus(booking.id, {
          payment_status: 'paid',
          status: 'CONFIRMED',
          payment_provider: 'whop',
          provider_payment_id: providerPaymentId,
          provider_checkout_id: providerCheckoutId,
          paid_at: new Date().toISOString()
        });

        logger.info(`[Whop] Webhook successfully marked booking ${booking.confirmation_code || booking.id} as PAID & CONFIRMED`);

        // Send confirmation email asynchronously (idempotent — sendBookingConfirmation checks confirmation_email_sent_at)
        try {
          const canonicalBooking = bookingMapper.toCanonicalModel(
            { ...booking, payment_status: 'paid', status: 'CONFIRMED' },
            booking.travellers || [],
            [{ email: booking.email, phone_number: booking.phone }],
            booking.flights || [],
            [{ payment_provider: 'whop', payment_amount: paidAmount, payment_status: 'paid' }]
          );
          await sendBookingConfirmation(canonicalBooking);
        } catch (emailErr) {
          logger.error(`[Whop] Non-blocking confirmation email failed: ${emailErr.message}`);
        }
      } else if (eventType.includes('refund') || eventType.includes('dispute')) {
        if (bookingId) {
          const newPaymentStatus = eventType.includes('refund') ? 'refunded' : 'disputed';
          await bookingRepository.updateBookingStatus(bookingId, {
            payment_status: newPaymentStatus,
            status: 'CANCELLED'
          });
          logger.info(`[Whop] Webhook updated booking ${bookingId} to ${newPaymentStatus}`);
        }
      }

      return res.status(200).json({ success: true, received: true });
    } catch (err) {
      logger.error(`[Whop] Error handling webhook: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * GET /api/bookings/:bookingId/payment-status
   * Polling endpoint for client confirmation page
   */
  getPaymentStatus: async (req, res) => {
    try {
      const { bookingId } = req.params;
      if (!bookingId) {
        return res.status(400).json({ success: false, error: 'bookingId is required' });
      }

      const booking = await bookingRepository.getById(bookingId) || await bookingRepository.getByReference(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }

      const supplierPrice = parseFloat(booking.supplier_price || booking.original_api_price || booking.total_amount || 0);
      const customerPrice = parseFloat(booking.customer_price || booking.total_amount || 0);
      const discountAmount = parseFloat(booking.discount_amount || Math.max(0, supplierPrice - customerPrice));

      return res.json({
        success: true,
        bookingId: booking.id,
        confirmationCode: booking.confirmation_code,
        paymentStatus: booking.payment_status || 'pending',
        bookingStatus: booking.status || 'PENDING',
        paymentProvider: booking.payment_provider || 'whop',
        amount: customerPrice.toFixed(2),
        supplierPrice: supplierPrice.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        discountPercent: booking.discount_percent || 10,
        paidAt: booking.paid_at || null,
        passengerName: booking.passenger_name || 'Customer',
        email: booking.email || null,
        emailSentAt: booking.confirmation_email_sent_at || null
      });
    } catch (err) {
      logger.error(`Error in getPaymentStatus: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

export default whopController;
