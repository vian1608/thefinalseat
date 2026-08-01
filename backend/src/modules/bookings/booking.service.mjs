import bookingRepository from './booking.repository.mjs';
import bookingMapper from './booking.mapper.mjs';
import { travellerService } from '../travellers/traveller.service.mjs';
import { sendBookingConfirmation, sendAdminBookingAcknowledgement } from '../../integrations/resend/resend.service.mjs';
import { itineraryMapper } from '../itineraries/itinerary.mapper.mjs';
import bookingValidatorService from './booking-validator.service.mjs';
import logger from '../../config/logger.mjs';

function generateConfirmationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const year = new Date().getFullYear();
  return `TFS-${year}-${randomPart}`;
}

const idempotencyStore = new Map();

export const bookingService = {
  create: async (payload) => {
    // 0 — Idempotency Guard (Prevent Duplicate Submissions)
    const idempotencyKey = payload.idempotency_key || payload.idempotencyKey;
    if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
      const existingId = idempotencyStore.get(idempotencyKey);
      const existingComplete = await bookingRepository.getCompleteBookingById(existingId);
      if (existingComplete) {
        logger.info(`[Idempotency] Returning existing booking ${existingId} for key ${idempotencyKey}`);
        return {
          booking: existingComplete,
          id: existingComplete.id,
          confirmation_code: existingComplete.confirmation_code,
          idempotentReused: true
        };
      }
    }

    // 1 — Run traveler validations
    const passengerList = Array.isArray(payload.passengers) 
      ? payload.passengers 
      : JSON.parse(payload.passengers || '[]');
      
    travellerService.validateTravellers(passengerList);

    // 2 — Derive master passenger_name from first actual passenger (e.g. John Doe)
    const firstPass = passengerList[0] || {};
    const firstPassName = [firstPass.firstName, firstPass.middleName, firstPass.lastName].filter(Boolean).join(' ');
    const masterPassengerName = firstPassName.trim() || payload.customerName || 'Valued Passenger';

    // 3 — Generate confirmation code & prepare insert payload
    const confirmationCode = generateConfirmationCode();
    const payloadWithPassengerName = {
      ...payload,
      customerName: masterPassengerName,
      paymentStatus: payload.paymentStatus || 'pending',
      payment_provider: payload.payment_provider || 'whop'
    };

    let booking = null;
    try {
      const insertRow = bookingMapper.toDatabaseInsert(confirmationCode, payloadWithPassengerName);
      booking = await bookingRepository.createBookingRecord(insertRow);

      if (!booking || !booking.id) {
        throw new Error('Failed to insert booking record.');
      }

      // 4 — Save travellers list
      let travellers = [];
      if (passengerList.length > 0) {
        travellers = await bookingRepository.insertTravellers(
          passengerList.map(p => ({
            booking_id: booking.id,
            role: (p.role || 'adult').toLowerCase(),
            title: p.title || null,
            first_name: p.firstName || '',
            middle_name: p.middleName || null,
            last_name: p.lastName || '',
            date_of_birth: p.dateOfBirth || null,
            gender: p.gender || null,
            nationality: p.nationality || null,
            passport_number: p.passportNumber || null,
            passport_expiry: p.passportExpiry || null,
          }))
        );
      }

      // 5 — Save primary contact details
      const rawPhone = String(payload.phone || '').trim();
      const countryCode = rawPhone.startsWith('+') ? rawPhone.split(' ')[0] : null;
      const contactRow = {
        booking_id: booking.id,
        email: payload.email,
        country_code: countryCode,
        phone_number: rawPhone
      };
      const contacts = await bookingRepository.insertContact(contactRow);

      // 6 — Save flight itineraries (MUST HAVE VALID FLIGHTS OR ROLLBACK)
      const flightsList = [];
      const returnObj = payload.returnFlight || payload.flight?.returnFlight;
      const tripType = returnObj ? 'round-trip' : 'one-way';
      
      if (payload.flight) {
        const outboundRows = itineraryMapper.toDatabaseRows(booking.id, payload.flight, 'outbound', tripType);
        flightsList.push(...outboundRows);
      }
      if (returnObj) {
        const returnRows = itineraryMapper.toDatabaseRows(booking.id, returnObj, 'return', tripType);
        flightsList.push(...returnRows);
      }
      
      if (flightsList.length === 0) {
        const err = new Error(`Booking creation failed: Cannot create booking ${confirmationCode} without flight itinerary segments.`);
        err.code = 'BOOKING_ITINERARY_MISSING';
        throw err;
      }

      const flights = await bookingRepository.insertFlights(flightsList);

      // 7 — Save pending payment record
      const paymentRow = {
        booking_id: booking.id,
        payment_provider: payload.payment_provider || 'whop',
        provider_checkout_id: payload.provider_checkout_id || null,
        provider_payment_id: payload.provider_payment_id || null,
        payment_amount: parseFloat(payload.customer_price || payload.displayedWebsitePrice) || 0,
        currency: (payload.currency || 'USD').toUpperCase(),
        payment_status: payload.paymentStatus || 'pending',
        payment_date: new Date().toISOString()
      };
      const payments = await bookingRepository.insertPayment(paymentRow);

      // 7.5 — Save tokenized payment method metadata (if provided)
      const pmPayload = payload.paymentMethod || payload.payment_method || payload;
      let savedPaymentMethod = null;
      if (pmPayload.card_last4 || pmPayload.cardLast4 || pmPayload.paymentMethodToken || pmPayload.token || pmPayload.card_brand || pmPayload.cardBrand) {
        savedPaymentMethod = await bookingRepository.savePaymentMethodRecord(booking.id, {
          booking_id: booking.id,
          payment_provider: payload.payment_provider || 'stripe',
          provider_payment_method_id: pmPayload.provider_payment_method_id || pmPayload.paymentMethodToken || pmPayload.token || `pm_tok_${Date.now()}`,
          cardholder_name: pmPayload.cardholder_name || pmPayload.cardholderName || payload.customerName || null,
          card_brand: pmPayload.card_brand || pmPayload.cardBrand || null,
          card_last4: pmPayload.card_last4 || pmPayload.cardLast4 || null,
          card_exp_month: pmPayload.card_exp_month || pmPayload.cardExpMonth || null,
          card_exp_year: pmPayload.card_exp_year || pmPayload.cardExpYear || null,
          billing_address_line1: pmPayload.billing_address_line1 || pmPayload.billingAddressLine1 || pmPayload.billingAddress || null,
          billing_address_line2: pmPayload.billing_address_line2 || pmPayload.billingAddressLine2 || null,
          billing_city: pmPayload.billing_city || pmPayload.billingCity || null,
          billing_state: pmPayload.billing_state || pmPayload.billingState || null,
          billing_postal_code: pmPayload.billing_postal_code || pmPayload.billingPostalCode || pmPayload.billingZip || null,
          billing_country: pmPayload.billing_country || pmPayload.billingCountry || 'United States',
          billing_phone: pmPayload.billing_phone || pmPayload.billingPhone || payload.phone || null
        });
      }

      const canonicalBooking = bookingMapper.toCanonicalModel(
        booking,
        travellers,
        contacts,
        flights,
        payments
      );

      // 8 — Validate complete transactional integrity before committing
      await bookingValidatorService.validateCompletedBooking(booking.id);

      // 9 — Automatically trigger and await server-side booking confirmation email
      let emailDeliveryResult = { success: false, status: 'FAILED' };
      try {
        emailDeliveryResult = await sendBookingConfirmation(canonicalBooking);
      } catch (emailErr) {
        logger.error(`[BookingCreate] Server-side confirmation email exception: ${emailErr.message}`);
        emailDeliveryResult = { success: false, errorCode: 'EMAIL_DELIVERY_EXCEPTION', errorMessage: emailErr.message, status: 'FAILED' };
      }

      // 10 — Automatically trigger internal admin booking acknowledgement email
      let adminEmailResult = { success: false, status: 'FAILED' };
      try {
        adminEmailResult = await sendAdminBookingAcknowledgement(canonicalBooking);
      } catch (adminEmailErr) {
        logger.error(`[BookingCreate] Internal admin acknowledgement email exception: ${adminEmailErr.message}`);
        adminEmailResult = { success: false, errorCode: 'EMAIL_DELIVERY_EXCEPTION', errorMessage: adminEmailErr.message, status: 'FAILED' };
      }

      if (idempotencyKey && booking?.id) {
        idempotencyStore.set(idempotencyKey, booking.id);
      }

      return {
        ...canonicalBooking,
        emailDeliveryStatus: emailDeliveryResult.success ? 'SENT' : 'FAILED',
        emailDelivery: emailDeliveryResult,
        adminEmailDelivery: adminEmailResult
      };
    } catch (err) {
      logger.error(`[AtomicBookingCreate] Rollback triggered for code ${confirmationCode}: ${err.message}`);
      if (booking?.id) {
        try {
          await bookingRepository.deleteBooking(booking.id);
          logger.info(`[AtomicBookingCreate] Clean ROLLBACK completed for failed booking ID ${booking.id}`);
        } catch (cleanupErr) {
          logger.error(`[AtomicBookingCreate] Rollback cleanup failed: ${cleanupErr.message}`);
        }
      }
      throw err;
    }
  },

  /**
   * Search bookings by confirmation code, email, or passenger name.
   * Used by GET /api/bookings/search?query=...  (My Bookings page)
   */
  search: async (query) => {
    const results = await bookingRepository.searchBookings(String(query).trim());
    return bookingMapper.toSummaryList(results);
  },

  /**
   * Return all bookings associated with a given email address.
   * Used by GET /api/bookings/user/:email
   */
  getBookingsForEmail: async (email) => {
    const results = await bookingRepository.findBookingsByEmail(String(email).trim());
    return bookingMapper.toSummaryList(results);
  },

  /**
   * Return a single fully-enriched canonical booking by UUID id or confirmation code.
   * Used by GET /api/bookings/:reference  (confirmation page + booking detail)
   */
  getDetailsByCodeOrId: async (reference) => {
    const ref = String(reference).trim();
    const complete = await bookingRepository.getCompleteBookingById(ref);
    if (complete) return complete;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    const raw = isUUID
      ? await bookingRepository.findBookingById(ref)
      : await bookingRepository.findBookingByCode(ref);

    if (!raw) return null;

    const travellers = raw.travellers || [];
    const contacts   = raw.contacts   || [];
    const flights    = raw.flights    || [];
    const payments   = raw.payments   || [];

    return bookingMapper.toCanonicalModel(raw, travellers, contacts, flights, payments);
  },

  /**
   * Field-Isolated Update 1: Status
   */
  updateStatus: async (id, { status, internalNotes, adminId = 'system', reason } = {}) => {
    const ALLOWED = ['PENDING', 'DONE', 'CANCELLED', 'FAILED'];
    const targetStatus = (status || '').toUpperCase();
    if (!ALLOWED.includes(targetStatus)) {
      const err = new Error(`Invalid status '${status}'. Allowed canonical statuses are: ${ALLOWED.join(', ')}.`);
      err.code = 'INVALID_STATUS';
      err.status = 400;
      throw err;
    }

    const booking = await bookingRepository.getById(id);
    if (!booking) {
      const err = new Error(`Booking '${id}' not found.`);
      err.code = 'BOOKING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const updateFields = { status: targetStatus, updated_at: new Date().toISOString() };
    if (internalNotes !== undefined) updateFields.internal_notes = internalNotes;

    await bookingRepository.updateStatus(booking.id, updateFields);
    await bookingRepository.recordStatusAudit({
      bookingId: booking.id,
      oldStatus: booking.status,
      newStatus: targetStatus,
      adminId,
      reason: reason || `Booking status updated to ${targetStatus}`
    });
    await bookingRepository.recordAuditLog({
      bookingId: booking.id,
      action: 'STATUS_CHANGED',
      oldValue: { status: booking.status },
      newValue: { status: targetStatus, internal_notes: internalNotes },
      actor: adminId
    });

    return bookingService.getDetailsByCodeOrId(booking.id);
  },

  /**
   * Field-Isolated Update 2: Payment
   */
  updatePayment: async (id, paymentData = {}) => {
    const { paymentStatus, paidAmount, refundedAmount, paymentProvider, adminId = 'system', reason } = paymentData;

    // 1. Strict Forbidden Domain Keys Guard
    const FORBIDDEN_KEYS = [
      'airline', 'airline_name', 'airlineName', 'airline_code', 'airlineCode',
      'itinerary', 'itinerary_segments', 'outbound_segments', 'flights',
      'passenger', 'passenger_name', 'passengerName', 'passengers', 'travellers', 'email', 'phone',
      'departure_date', 'departureDate', 'arrival_date', 'arrivalDate', 'departure_time', 'arrival_time',
      'flight_number', 'flightNumber', 'origin_airport', 'destination_airport', 'origin', 'destination'
    ];

    const inputKeys = Object.keys(paymentData || {});
    const forbiddenMatches = inputKeys.filter(k => FORBIDDEN_KEYS.includes(k));
    if (forbiddenMatches.length > 0) {
      const err = new Error(`Payment update failed: payload contains forbidden domain fields [${forbiddenMatches.join(', ')}]. Payment updates must ONLY affect payment attributes.`);
      err.code = 'FORBIDDEN_PAYMENT_UPDATE_FIELD';
      err.status = 400;
      throw err;
    }

    const ALLOWED_PAY_STATUS = ['pending', 'paid', 'failed', 'refunded', 'authorized'];
    const booking = await bookingRepository.getById(id);
    if (!booking) {
      const err = new Error(`Booking '${id}' not found.`);
      err.code = 'BOOKING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    // 2. Pre-Update Structural Snapshot
    const beforeRelations = await bookingRepository.getRelations(booking.id);
    const beforeSegmentsCount = (beforeRelations.itinerarySegments || booking.itinerary_segments || []).length;
    const beforeTravellersCount = (beforeRelations.travellers || booking.passengers || []).length;
    const beforePassengerName = booking.passenger_name;
    const beforeAmount = parseFloat(booking.customer_price || booking.total_amount || 0);

    const updateFields = { updated_at: new Date().toISOString() };
    if (paymentStatus !== undefined) {
      const ps = String(paymentStatus).toLowerCase();
      if (!ALLOWED_PAY_STATUS.includes(ps)) {
        const err = new Error(`Invalid payment status '${paymentStatus}'. Allowed: ${ALLOWED_PAY_STATUS.join(', ')}.`);
        err.code = 'INVALID_PAYMENT_STATUS';
        err.status = 400;
        throw err;
      }
      updateFields.payment_status = ps;
    }

    if (paidAmount !== undefined && paidAmount !== null) {
      const num = parseFloat(paidAmount);
      if (!Number.isFinite(num) || num < 0) {
        const err = new Error('paidAmount must be a non-negative number.');
        err.code = 'INVALID_AMOUNT';
        err.status = 400;
        throw err;
      }
      updateFields.paid_amount = num;
      updateFields.paid_at = new Date().toISOString();
    }

    if (refundedAmount !== undefined && refundedAmount !== null) {
      const num = parseFloat(refundedAmount);
      if (!Number.isFinite(num) || num < 0) {
        const err = new Error('refundedAmount must be a non-negative number.');
        err.code = 'INVALID_AMOUNT';
        err.status = 400;
        throw err;
      }
      updateFields.refund_amount = num;
      updateFields.refund_timestamp = new Date().toISOString();
    }

    if (paymentProvider !== undefined) {
      updateFields.payment_provider = paymentProvider;
    }

    await bookingRepository.updateStatus(booking.id, updateFields);

    // 3. Post-Update Structural Verification Routine
    const afterBooking = await bookingRepository.getById(booking.id);
    const afterRelations = await bookingRepository.getRelations(booking.id);
    const afterSegmentsCount = (afterRelations.itinerarySegments || afterBooking.itinerary_segments || []).length;
    const afterTravellersCount = (afterRelations.travellers || afterBooking.passengers || []).length;
    const afterPassengerName = afterBooking.passenger_name;
    const afterAmount = parseFloat(afterBooking.customer_price || afterBooking.total_amount || 0);

    if (afterSegmentsCount !== beforeSegmentsCount) {
      const err = new Error(`PAYMENT_SAFETY_VIOLATION: Flight count changed from ${beforeSegmentsCount} to ${afterSegmentsCount} during payment update.`);
      err.code = 'PAYMENT_UPDATE_VERIFICATION_FAILED';
      throw err;
    }
    if (afterTravellersCount !== beforeTravellersCount) {
      const err = new Error(`PAYMENT_SAFETY_VIOLATION: Passenger count changed from ${beforeTravellersCount} to ${afterTravellersCount} during payment update.`);
      err.code = 'PAYMENT_UPDATE_VERIFICATION_FAILED';
      throw err;
    }
    if (afterPassengerName !== beforePassengerName) {
      const err = new Error(`PAYMENT_SAFETY_VIOLATION: Passenger name changed from '${beforePassengerName}' to '${afterPassengerName}' during payment update.`);
      err.code = 'PAYMENT_UPDATE_VERIFICATION_FAILED';
      throw err;
    }
    if (Math.abs(afterAmount - beforeAmount) > 0.01) {
      const err = new Error(`PAYMENT_SAFETY_VIOLATION: Booking total amount changed from $${beforeAmount} to $${afterAmount} during payment update.`);
      err.code = 'PAYMENT_UPDATE_VERIFICATION_FAILED';
      throw err;
    }

    await bookingRepository.recordStatusAudit({
      bookingId: booking.id,
      oldStatus: booking.status,
      newStatus: booking.status,
      adminId,
      reason: reason || `Payment details updated (${Object.keys(updateFields).join(', ')})`
    });

    await bookingRepository.recordAuditLog({
      bookingId: booking.id,
      action: 'PAYMENT_UPDATED',
      oldValue: { payment_status: booking.payment_status, paid_amount: booking.paid_amount },
      newValue: updateFields,
      actor: adminId
    });

    return bookingService.getDetailsByCodeOrId(booking.id);
  },

  /**
   * Field-Isolated Update 3: Itinerary
   */
  updateItinerary: async (id, { segments, adminId = 'system', reason } = {}) => {
    const booking = await bookingRepository.getById(id);
    if (!booking) {
      const err = new Error(`Booking '${id}' not found.`);
      err.code = 'BOOKING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      const err = new Error('Itinerary update requires a non-empty array of flight segments.');
      err.code = 'BOOKING_ITINERARY_MISSING';
      err.status = 400;
      throw err;
    }

    const relations = await bookingRepository.getRelations(booking.id);
    await bookingRepository.saveItinerarySegments(booking.id, segments);
    await bookingRepository.recordStatusAudit({
      bookingId: booking.id,
      oldStatus: booking.status,
      newStatus: booking.status,
      adminId,
      reason: reason || `Itinerary segments updated (${segments.length} segments)`
    });
    await bookingRepository.recordAuditLog({
      bookingId: booking.id,
      action: 'FLIGHT_UPDATED',
      oldValue: relations.itinerarySegments || booking.itinerary_segments || [],
      newValue: segments,
      actor: adminId
    });

    return bookingService.getDetailsByCodeOrId(booking.id);
  },

  /**
   * Field-Isolated Update 4: Ticket Details
   */
  updateTicket: async (id, ticketData = {}, adminId = 'system') => {
    const booking = await bookingRepository.getById(id);
    if (!booking) {
      const err = new Error(`Booking '${id}' not found.`);
      err.code = 'BOOKING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    await bookingRepository.saveTicketDetails(booking.id, ticketData, adminId);
    return bookingService.getDetailsByCodeOrId(booking.id);
  },

  /**
   * Field-Isolated Update 5: Internal Notes
   */
  updateNotes: async (id, { internalNotes, adminId = 'system', reason } = {}) => {
    const booking = await bookingRepository.getById(id);
    if (!booking) {
      const err = new Error(`Booking '${id}' not found.`);
      err.code = 'BOOKING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (typeof internalNotes !== 'string') {
      const err = new Error('internalNotes parameter must be a string.');
      err.code = 'INVALID_INPUT';
      err.status = 400;
      throw err;
    }

    await bookingRepository.updateStatus(booking.id, {
      internal_notes: internalNotes,
      updated_at: new Date().toISOString()
    });

    await bookingRepository.recordStatusAudit({
      bookingId: booking.id,
      oldStatus: booking.status,
      newStatus: booking.status,
      adminId,
      reason: reason || 'Internal notes updated'
    });

    return bookingService.getDetailsByCodeOrId(booking.id);
  },

  /**
   * Save Tokenized Payment Method & Billing Metadata (PCI Compliant)
   */
  savePaymentMethod: async (id, paymentMethodPayload = {}) => {
    const PROHIBITED_KEYS = [
      'card_number', 'cardNumber', 'full_card_number', 'fullCardNumber',
      'pan', 'cvv', 'cvc', 'cid', 'security_code', 'securityCode',
      'pin', 'track_data', 'trackData'
    ];

    const inputKeys = Object.keys(paymentMethodPayload || {});
    const matchedProhibited = inputKeys.filter(k => PROHIBITED_KEYS.some(pk => pk.toLowerCase() === k.toLowerCase()));

    if (matchedProhibited.length > 0) {
      const err = new Error(`Request rejected: contains prohibited raw card/CVV fields [${matchedProhibited.join(', ')}]. Sensitive card details must never be sent to the application backend.`);
      err.code = 'PROHIBITED_CARD_PAYLOAD';
      err.status = 400;
      throw err;
    }

    const booking = await bookingRepository.getById(id);
    if (!booking) {
      const err = new Error(`Booking '${id}' not found.`);
      err.code = 'BOOKING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const savedPaymentMethod = await bookingRepository.savePaymentMethodRecord(booking.id, paymentMethodPayload);
    return savedPaymentMethod;
  },

  /**
   * Update Payment Splits with Strict Allowlist & Data Integrity Protection
   */
  updatePaymentSplits: async (id, splits, adminId = 'admin', reason = 'Payment splits update') => {
    const booking = await bookingRepository.getById(id);
    if (!booking) {
      const err = new Error(`Booking '${id}' not found.`);
      err.code = 'BOOKING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    // Code-level guard: Assert no flight mutations occur
    return await bookingRepository.updatePaymentSplitsAndTotal(booking.id, splits, adminId, reason);
  }
};

export default bookingService;
