import bookingRepository from './booking.repository.mjs';
import bookingMapper from './booking.mapper.mjs';
import { travellerService } from '../travellers/traveller.service.mjs';
import { sendBookingConfirmation, sendAdminBookingAcknowledgement } from '../../integrations/resend/resend.service.mjs';
import { itineraryMapper } from '../itineraries/itinerary.mapper.mjs';
import bookingValidatorService from './booking-validator.service.mjs';
import logger from '../../config/logger.mjs';
import { validatePostalCode } from '../../shared/utils/validationHelpers.mjs';

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

    const departureDate = payload.flight?.departure?.date || payload.flight?.departureDate || payload.departureDate || '';
    travellerService.validateTravellers(passengerList, departureDate);

    // 1.5 — Validate Billing Postal/ZIP Code
    if (payload.billingZip || payload.billingPostalCode) {
      const zipCheck = validatePostalCode(payload.billingZip || payload.billingPostalCode, payload.billingCountry || 'United States');
      if (!zipCheck.valid) {
        const err = new Error(zipCheck.message);
        err.code = 'INVALID_POSTAL_CODE';
        throw err;
      }
    }

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

      // 7.5 — Save tokenized payment method metadata (always persist safe billing data)
      // Primary path: nested paymentMethod object; fallback: flat top-level fields
      const pmPayload = payload.paymentMethod || payload.payment_method || {};
      const flatPayload = payload; // flat fields from BookingPage.js

      // Parse cardExpDate string "MM/YY" or "MM/YYYY" into separate integers
      function parseExpDate(dateStr) {
        if (!dateStr) return { month: null, year: null };
        const parts = String(dateStr).split('/');
        const month = parts[0] ? parseInt(parts[0], 10) : null;
        const rawYear = parts[1] ? parseInt(parts[1], 10) : null;
        const year = rawYear ? (rawYear < 100 ? 2000 + rawYear : rawYear) : null;
        return { month: (month >= 1 && month <= 12) ? month : null, year };
      }

      const expDateStr = pmPayload.cardExpDate || flatPayload.cardExpDate || flatPayload.card_exp_date || '';
      const parsedExp = parseExpDate(expDateStr);

      const resolvedCardLast4 = (() => {
        const raw = String(pmPayload.cardLast4 || pmPayload.card_last4 || flatPayload.cardLast4 || flatPayload.card_last4 || '').replace(/\D/g, '');
        return /^\d{4}$/.test(raw) ? raw : null;
      })();

      const billingRecord = {
        booking_id: booking.id,
        payment_provider: flatPayload.payment_provider || 'card',
        provider_payment_method_id: pmPayload.paymentMethodToken || pmPayload.provider_payment_method_id || `pm_tok_${Date.now()}`,
        cardholder_name: pmPayload.cardholderName || pmPayload.cardholder_name || flatPayload.cardholderName || flatPayload.cardholder_name || masterPassengerName || null,
        card_brand: pmPayload.cardBrand || pmPayload.card_brand || flatPayload.cardBrand || flatPayload.card_brand || null,
        card_last4: resolvedCardLast4,
        card_exp_month: pmPayload.cardExpMonth || pmPayload.card_exp_month || flatPayload.cardExpMonth || flatPayload.card_exp_month || parsedExp.month || null,
        card_exp_year: pmPayload.cardExpYear || pmPayload.card_exp_year || flatPayload.cardExpYear || flatPayload.card_exp_year || parsedExp.year || null,
        billing_email: pmPayload.billingEmail || pmPayload.billing_email || flatPayload.billingEmail || flatPayload.billing_email || flatPayload.email || null,
        billing_phone: pmPayload.billingPhone || pmPayload.billing_phone || flatPayload.billingPhone || flatPayload.billing_phone || flatPayload.phone || null,
        billing_address_line1: pmPayload.billingAddressLine1 || pmPayload.billing_address_line1 || flatPayload.billingAddressLine1 || flatPayload.billing_address_line1 || flatPayload.billingAddress || null,
        billing_address_line2: pmPayload.billingAddressLine2 || pmPayload.billing_address_line2 || flatPayload.billingAddressLine2 || flatPayload.billing_address_line2 || null,
        billing_city: pmPayload.billingCity || pmPayload.billing_city || flatPayload.billingCity || flatPayload.billing_city || null,
        billing_state: pmPayload.billingState || pmPayload.billing_state || flatPayload.billingState || flatPayload.billing_state || null,
        billing_postal_code: pmPayload.billingPostalCode || pmPayload.billing_postal_code || flatPayload.billingPostalCode || flatPayload.billingZip || flatPayload.billing_postal_code || null,
        billing_country: pmPayload.billingCountry || pmPayload.billing_country || flatPayload.billingCountry || flatPayload.billing_country || 'United States',
      };

      // Always attempt to save billing record when any meaningful field is provided
      const hasBillingData = billingRecord.card_last4 || billingRecord.card_brand || billingRecord.billing_address_line1 || billingRecord.billing_email || billingRecord.billing_city || billingRecord.cardholder_name;
      let savedPaymentMethod = null;
      if (hasBillingData) {
        savedPaymentMethod = await bookingRepository.savePaymentMethodRecord(booking.id, billingRecord);
      }

      const canonicalBooking = bookingMapper.toCanonicalModel(
        booking,
        travellers,
        contacts,
        flights,
        payments,
        savedPaymentMethod || null
      );

      // 8 — Persist idempotency key BEFORE returning so retries are safe
      if (idempotencyKey && booking?.id) {
        idempotencyStore.set(idempotencyKey, booking.id);
      }

      // 9 — Fire-and-forget: validation + emails triggered AFTER return to avoid Vercel 10s timeout.
      // Booking is fully committed to DB at this point. Email failure MUST NOT block checkout response.
      setImmediate(() => {
        // Light validation check (non-blocking — does not block response)
        bookingValidatorService.validateCompletedBooking(booking.id).catch(valErr => {
          logger.error(`[BookingCreate] Non-blocking post-commit validation warning: ${valErr.message}`);
        });

        // Customer confirmation email (non-blocking)
        sendBookingConfirmation(canonicalBooking).catch(emailErr => {
          logger.error(`[BookingCreate] Non-blocking confirmation email error for ${confirmationCode}: ${emailErr.message}`);
        });

        // Internal admin acknowledgement email (non-blocking)
        sendAdminBookingAcknowledgement(canonicalBooking).catch(adminEmailErr => {
          logger.error(`[BookingCreate] Non-blocking admin email error for ${confirmationCode}: ${adminEmailErr.message}`);
        });
      });

      return {
        ...canonicalBooking,
        emailDeliveryStatus: 'QUEUED',
        emailDelivery: { success: true, status: 'QUEUED', message: 'Confirmation email queued for delivery.' },
        adminEmailDelivery: { success: true, status: 'QUEUED' }
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
    const ALLOWED = [
      'PENDING',
      'AWAITING_AUTHORIZATION',
      'AUTHORIZED',
      'REAUTHORIZATION_REQUIRED',
      'READY_FOR_TICKETING',
      'TICKETED',
      'DONE',
      'FAILED',
      'CANCELLED'
    ];
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
    const { paymentState, paymentStatus, paidAmount, refundedAmount, paymentProvider, adminId = 'system', reason, bookingVersion, splits, transactionReference } = paymentData;

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

    const ALLOWED_PAY_STATUS = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'AUTHORIZED'];
    const booking = await bookingRepository.getById(id);
    if (!booking) {
      const err = new Error(`Booking '${id}' not found.`);
      err.code = 'BOOKING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const targetStatus = (paymentState || paymentStatus || booking.payment_status || 'pending').toUpperCase();
    if (!ALLOWED_PAY_STATUS.includes(targetStatus)) {
      const err = new Error(`Invalid payment status '${targetStatus}'. Allowed: ${ALLOWED_PAY_STATUS.join(', ')}.`);
      err.code = 'INVALID_PAYMENT_STATUS';
      err.status = 400;
      throw err;
    }

    const ref = transactionReference ?? paymentData.referenceId ?? null;
    const amount = paidAmount !== undefined ? parseFloat(paidAmount) : parseFloat(booking.customer_price || booking.total_amount || 0);

    // Validation
    if (targetStatus === 'PAID') {
      const trimmedRef = String(ref || '').trim();
      const refRegex = /^[A-Za-z0-9_-]{4,100}$/;
      if (!ref || !refRegex.test(trimmedRef)) {
        const err = new Error('Enter a valid transaction or reference ID.');
        err.code = 'INVALID_TRANSACTION_REFERENCE';
        err.status = 400;
        throw err;
      }
      if (isNaN(amount) || amount <= 0) {
        const err = new Error('Paid amount must be greater than zero.');
        err.code = 'INVALID_PAID_AMOUNT';
        err.status = 400;
        throw err;
      }
    }

    const currentSplits = await bookingRepository.getPaymentSplits(id);
    const targetSplits = splits || paymentData.paymentSplits || currentSplits || [];

    const paymentMetadata = {
      referenceId: ref,
      reason: reason || 'Payment updated via API',
      paidAmount: amount,
      refundAmount: refundedAmount !== undefined ? parseFloat(refundedAmount) : null,
      refundReferenceId: paymentData.refundReferenceId || null
    };

    // Execute atomic update
    const updatedBooking = await bookingRepository.updatePaymentSplitsAndTotal(
      id,
      targetSplits,
      adminId,
      reason || 'Payment status updated to ' + targetStatus,
      bookingVersion || booking.updated_at,
      targetStatus,
      paymentMetadata
    );

    return updatedBooking;
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
   * Field-Isolated Update 3b: Import Itinerary From Text (GDS Importer)
   */
  importItineraryFromText: async (id, { text, segments, tripType = 'ONE_WAY', sourceFormat = 'text_import', warnings = [], adminId = 'system' } = {}) => {
    const booking = await bookingRepository.getById(id);
    if (!booking) {
      const err = new Error(`Booking '${id}' not found.`);
      err.code = 'BOOKING_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      const err = new Error('Imported itinerary requires at least one valid flight segment.');
      err.code = 'INVALID_IMPORT_SEGMENTS';
      err.status = 400;
      throw err;
    }

    // 1. Structural Snapshot before import
    const relations = await bookingRepository.getRelations(booking.id);
    const prevSegments = relations.itinerarySegments || booking.itinerary_segments || [];

    // 2. Atomic Save of imported segments
    await bookingRepository.saveItinerarySegments(booking.id, segments);

    // Compute text hash safely
    let textHash = 'N/A';
    if (text && typeof text === 'string') {
      const crypto = await import('crypto');
      textHash = crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
    }

    // 3. Record Specialized Audit Log: ITINERARY_IMPORTED_FROM_TEXT
    await bookingRepository.recordAuditLog({
      bookingId: booking.id,
      action: 'ITINERARY_IMPORTED_FROM_TEXT',
      oldValue: { segmentCount: prevSegments.length, segments: prevSegments },
      newValue: {
        sourceFormat,
        originalTextHash: textHash,
        parsedSegmentCount: segments.length,
        journeyCount: tripType === 'MULTI_CITY' ? 3 : (tripType === 'ROUND_TRIP' ? 2 : 1),
        warnings,
        segments
      },
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
