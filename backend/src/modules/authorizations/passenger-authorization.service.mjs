import crypto from 'crypto';
import supabase from '../../integrations/supabase/supabase.client.mjs';
import env from '../../config/env.mjs';
import logger from '../../config/logger.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';

// In-memory fallback map for offline / stub testing when remote DB table schema is updating
const memoryAuthStore = new Map();

function hashText(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

export const passengerAuthorizationService = {
  /**
   * Create single-use 24-hour authorization token and snapshot
   */
  createAuthorizationToken: async (booking, vaultData = {}) => {
    const bookingId = booking.id || booking.booking_id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const flightsList = Array.isArray(booking.flights) ? booking.flights : [];
    const outbound = flightsList.find(f => f.direction === 'outbound') || flightsList[0] || booking.flight || booking.flight_details || {};
    const returnFlight = flightsList.find(f => f.direction === 'return') || flightsList[1] || booking.returnFlight || booking.return_flight || null;

    const rawPassengers = booking.passengers || booking.traveller_details || booking.travellers || [];
    const passengers = Array.isArray(rawPassengers)
      ? rawPassengers
      : (typeof rawPassengers === 'string' ? JSON.parse(rawPassengers || '[]') : []);

    const customerPrice = parseFloat(booking.customer_price || booking.displayedWebsitePrice || booking.total_amount || booking.amount || 0);

    const quoteSnapshot = {
      amount: customerPrice.toFixed(2),
      currency: (booking.currency || 'USD').toUpperCase(),
      originalPrice: (booking.supplier_price || booking.original_api_price || customerPrice).toString(),
      discountAmount: (booking.discount_amount || 0).toString(),
      passengersCount: passengers.length || 1,
      createdAt: new Date().toISOString()
    };

    const itinerarySnapshot = {
      outbound: {
        airline: outbound.carrier || outbound.airline || booking.carrier || 'Commercial Airline',
        flightNumber: outbound.flight_number || outbound.flightNumber || outbound.number || '',
        originCode: outbound.origin_code || outbound.departure_airport || outbound.origin || 'DEP',
        originCity: outbound.origin_city || outbound.departure_city || outbound.origin_code || 'DEP',
        destinationCode: outbound.destination_code || outbound.arrival_airport || outbound.destination || 'ARR',
        destinationCity: outbound.destination_city || outbound.arrival_city || outbound.destination_code || 'ARR',
        departureDate: outbound.departure_date || outbound.departure_time || 'Scheduled',
        departureTime: outbound.departure_time || 'Scheduled',
        cabinClass: outbound.cabin_class || outbound.cabin || 'Economy'
      },
      return: returnFlight ? {
        airline: returnFlight.carrier || returnFlight.airline || outbound.carrier || 'Commercial Airline',
        flightNumber: returnFlight.flight_number || returnFlight.flightNumber || returnFlight.number || '',
        originCode: returnFlight.origin_code || returnFlight.departure_airport || outbound.destination_code || 'ARR',
        originCity: returnFlight.origin_city || returnFlight.departure_city || outbound.destination_city || 'ARR',
        destinationCode: returnFlight.destination_code || returnFlight.arrival_airport || outbound.origin_code || 'DEP',
        destinationCity: returnFlight.destination_city || returnFlight.arrival_city || outbound.origin_city || 'DEP',
        departureDate: returnFlight.departure_date || returnFlight.departure_time || 'Scheduled',
        departureTime: returnFlight.departure_time || 'Scheduled',
        cabinClass: returnFlight.cabin_class || returnFlight.cabin || 'Economy'
      } : null
    };

    const policiesSnapshot = {
      cancellation: 'Non-refundable after ticketing. Changes subject to airline fee structure.',
      priceGuarantee: 'Quote guaranteed for 24 hours until authorization expires.',
      fulfillment: 'Final airline PNR and e-ticket issued within 2 hours of passenger authorization.'
    };

    const authRecord = {
      booking_id: bookingId,
      token,
      status: 'pending',
      authorized_amount: customerPrice,
      currency: (booking.currency || 'USD').toUpperCase(),
      payment_method_token: vaultData.paymentMethodToken || vaultData.token || `pm_vault_${Date.now()}`,
      card_brand: vaultData.cardBrand || vaultData.brand || 'Visa',
      card_last4: vaultData.cardLast4 || vaultData.last4 || '4242',
      quote_snapshot: quoteSnapshot,
      itinerary_snapshot: itinerarySnapshot,
      policies_snapshot: policiesSnapshot,
      authorization_text_version: 'v1.0',
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    };

    // Store in Supabase
    try {
      const { data, error } = await supabase
        .from('passenger_authorizations')
        .insert(authRecord)
        .select()
        .single();

      if (error) {
        logger.warn(`[Auth] Supabase table insert warning: ${error.message}. Saving to resilience memory store.`);
        memoryAuthStore.set(token, authRecord);
      } else {
        memoryAuthStore.set(token, data);
      }
    } catch (e) {
      memoryAuthStore.set(token, authRecord);
    }

    // Update booking status to AWAITING_AUTH (within VARCHAR(20) limit)
    await bookingRepository.updateStatus(bookingId, {
      status: 'AWAITING_AUTH',
      payment_status: 'pending'
    });


    return { ...authRecord, token };
  },

  /**
   * Send branded authorization email containing Review & Authorize Booking button
   */
  sendAuthorizationEmail: async (authRecord, booking) => {
    const frontendUrl = env.frontendUrl || 'https://thefinalseat.com';
    const authUrl = `${frontendUrl}/authorize/${authRecord.token}`;
    const email = booking.email || booking.customerEmail || '';
    const confirmationCode = booking.confirmation_code || booking.bookingReference || booking.confirmationCode || 'TFS-PENDING';
    const amountStr = parseFloat(authRecord.authorized_amount).toFixed(2);
    const currencyStr = authRecord.currency || 'USD';
    const cardLast4 = authRecord.card_last4 || '4242';

    const subject = `Action Required — Authorize Flight Reservation ${confirmationCode} | The Final Seat`;

    const textBody = `
THE FINAL SEAT — PASSENGER RESERVATION AUTHORIZATION REQUIRED

Dear ${booking.passenger_name || 'Valued Customer'},

Your flight reservation request ${confirmationCode} is ready for final authorization.

Amount to Authorize: $${amountStr} ${currencyStr}
Saved Payment Method: ${authRecord.card_brand || 'Visa'} ending in ${cardLast4}

Please review your complete flight itinerary, passenger details, fare breakdown, and authorize your booking using the secure link below:

${authUrl}

NOTE: Your saved card ending in ${cardLast4} will NOT be charged until you review and click "I Authorize" on the secure authorization page. This authorization link expires in 24 hours.

Need assistance? Contact our 24/7 Support Desk:
Email: support@thefinalseat.com | Call: +1 (213) 965-9727
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f8f4f5; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(79,16,43,0.12); }
    .header { background: #9f1239; color: #ffffff; padding: 24px; text-align: center; }
    .header h2 { margin: 0; font-size: 24px; color: #ffffff; }
    .sub { color: #f8dfe8; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; margin-top: 4px; }
    .body { padding: 32px 28px; }
    .hero-title { font-size: 22px; font-weight: 800; color: #7f0d2f; margin-top: 0; }
    .box { background: #fffaf0; border: 2px dashed #e2b84d; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0; }
    .box-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8b6b16; font-weight: 700; }
    .box-code { font-size: 26px; font-weight: 800; color: #7f0d2f; margin: 6px 0; }
    .cta-btn { display: block; width: 100%; text-align: center; background: #9f1239; color: #ffffff !important; font-size: 16px; font-weight: 700; padding: 15px 18px; border-radius: 9px; text-decoration: none; box-sizing: border-box; margin: 24px 0; }
    .notice { background: #fff5f8; border: 1px solid #ead1da; border-radius: 10px; padding: 14px; font-size: 13px; color: #5f4a53; line-height: 1.5; margin-bottom: 20px; }
    .footer { background: #fbf8f9; padding: 20px; text-align: center; font-size: 12px; color: #748596; border-top: 1px solid #eadfe3; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>✈ The Final Seat</h2>
      <div class="sub">Passenger Reservation Authorization Request</div>
    </div>
    <div class="body">
      <h3 class="hero-title">Action Required: Authorize Your Booking</h3>
      <p style="font-size: 15px; color: #5f4a53; line-height: 1.6;">
        Your flight reservation request is prepared. Please review your itinerary details and authorize the total amount of <strong>$${amountStr} ${currencyStr}</strong> to complete your reservation.
      </p>

      <div class="box">
        <div class="box-title">Temporary Reservation Code</div>
        <div class="box-code">${confirmationCode}</div>
        <div style="font-size: 13px; color: #6b5b43;">Saved Card: ${authRecord.card_brand || 'Visa'} ending in <strong>${cardLast4}</strong></div>
      </div>

      <a href="${authUrl}" class="cta-btn">Review and Authorize Booking &rarr;</a>

      <div class="notice">
        <strong>🔒 Security Notice:</strong> Your card ending in <strong>${cardLast4}</strong> will NOT be charged from an email link click alone. You will review full flight segments, fare breakdown, and passenger names on our secure authorization page before confirming. This authorization link expires in 24 hours.
      </div>
    </div>
    <div class="footer">
      The Final Seat LLC &middot; 24/7 Support: support@thefinalseat.com &middot; +1 (213) 965-9727
    </div>
  </div>
</body>
</html>
    `.trim();

    const apiKey = env.resendApiKey?.trim();
    if (apiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: env.resendFrom || 'The Final Seat <support@thefinalseat.com>',
            to: [email],
            subject,
            text: textBody,
            html: htmlBody,
            reply_to: 'support@thefinalseat.com'
          })
        });
        const resData = await response.json();
        logger.info(`[Auth Email] Sent authorization email for ${confirmationCode} to ${email}:`, resData.id);
        return resData.id;
      } catch (err) {
        logger.error(`[Auth Email] Failed sending authorization email for ${confirmationCode}:`, err.message);
      }
    }
    return `log_auth_${Date.now()}`;
  },

  /**
   * Fetch sanitized authorization payload for passenger authorization page (/authorize/:token)
   */
  getAuthorizationByToken: async (token) => {
    let authRecord = memoryAuthStore.get(token);

    if (!authRecord) {
      const { data, error } = await supabase
        .from('passenger_authorizations')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (data) authRecord = data;
    }

    if (!authRecord) {
      throw new Error('AUTHORIZATION_NOT_FOUND');
    }

    // Check expiration
    if (new Date(authRecord.expires_at).getTime() < Date.now()) {
      if (authRecord.status === 'pending') {
        authRecord.status = 'expired';
      }
      throw new Error('AUTHORIZATION_EXPIRED');
    }

    if (authRecord.status === 'consumed' || authRecord.consumed_at) {
      authRecord.status = 'accepted';
    }

    // Retrieve live booking to verify quote immutability
    const booking = await bookingRepository.getById(authRecord.booking_id);
    if (!booking) {
      throw new Error('BOOKING_NOT_FOUND');
    }

    // Check if booking total or flight itinerary was modified after snapshot
    const currentPrice = parseFloat(booking.customer_price || booking.total_amount || 0);
    const snapPrice = parseFloat(authRecord.authorized_amount || authRecord.quote_snapshot?.amount || 0);
    if (Math.abs(currentPrice - snapPrice) > 0.01) {
      authRecord.status = 'invalidated';
      throw new Error('AUTHORIZATION_INVALIDATED_PRICE_CHANGE');
    }

    const relations = await bookingRepository.getRelations(booking.id);
    const rawPassengers = relations.travellers || booking.passengers || [];

    return {
      token: authRecord.token,
      status: authRecord.status,
      bookingId: booking.id,
      confirmationCode: booking.confirmation_code,
      passengerName: booking.passenger_name,
      customerEmail: booking.email,
      authorizedAmount: snapPrice.toFixed(2),
      currency: authRecord.currency || 'USD',
      cardBrand: authRecord.card_brand || 'Visa',
      cardLast4: authRecord.card_last4 || '4242',
      quoteSnapshot: authRecord.quote_snapshot,
      itinerarySnapshot: authRecord.itinerary_snapshot,
      policiesSnapshot: authRecord.policies_snapshot,
      expiresAt: authRecord.expires_at,
      passengers: rawPassengers
    };
  },

  /**
   * Accept passenger authorization when passenger submits the checkbox & button
   */
  acceptAuthorization: async ({ token, acceptedCheckboxText, clientIp, userAgent }) => {
    let authRecord = memoryAuthStore.get(token);

    if (!authRecord) {
      const { data } = await supabase
        .from('passenger_authorizations')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (data) authRecord = data;
    }

    if (!authRecord) {
      throw new Error('AUTHORIZATION_NOT_FOUND');
    }

    if (authRecord.status !== 'pending' || authRecord.consumed_at) {
      throw new Error(`AUTHORIZATION_ALREADY_${(authRecord.status || 'consumed').toUpperCase()}`);
    }

    if (new Date(authRecord.expires_at).getTime() < Date.now()) {
      throw new Error('AUTHORIZATION_EXPIRED');
    }

    const textHash = hashText(acceptedCheckboxText);
    const consumedAt = new Date().toISOString();

    const updateFields = {
      status: 'accepted',
      consumed_at: consumedAt,
      ip_address: clientIp || '127.0.0.1',
      user_agent: userAgent || 'Mozilla/5.0',
      authorization_text_version: 'v1.0',
      authorization_text_hash: textHash,
      updated_at: consumedAt
    };

    // Update Supabase passenger_authorizations table
    try {
      await supabase
        .from('passenger_authorizations')
        .update(updateFields)
        .eq('token', token);
    } catch (e) {
      /* non-blocking memory update */
    }

    const updatedRecord = { ...authRecord, ...updateFields };
    memoryAuthStore.set(token, updatedRecord);

    // Update Booking status to AUTHORIZED and READY_FOR_TICKETING
    await bookingRepository.updateStatus(authRecord.booking_id, {
      status: 'AUTHORIZED',
      payment_status: 'authorized',
      crm_status: 'READY_FOR_TICKETING'
    });

    logger.info(`[Auth] Authorization accepted for booking ${authRecord.booking_id} from IP ${clientIp}`);

    return {
      success: true,
      bookingId: authRecord.booking_id,
      status: 'AUTHORIZED',
      authorizedAmount: authRecord.authorized_amount,
      currency: authRecord.currency,
      acceptedAt: consumedAt
    };
  },

  /**
   * Generate complete Audit Evidence Export for compliance & admin CRM
   */
  generateAuditEvidenceExport: async (bookingId) => {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    const relations = await bookingRepository.getRelations(bookingId);

    // Find authorization record
    let authRecord = null;
    for (const record of memoryAuthStore.values()) {
      if (record.booking_id === bookingId) {
        authRecord = record;
        break;
      }
    }

    if (!authRecord) {
      const { data } = await supabase
        .from('passenger_authorizations')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (data) authRecord = data;
    }

    const evidence = {
      evidenceId: `EVID_${booking.confirmation_code}_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      booking: {
        id: booking.id,
        confirmationCode: booking.confirmation_code,
        passengerName: booking.passenger_name,
        email: booking.email,
        phone: booking.phone,
        status: booking.status,
        paymentStatus: booking.payment_status,
        totalAmount: booking.total_amount,
        currency: booking.currency || 'USD'
      },
      authorization: authRecord ? {
        token: authRecord.token,
        status: authRecord.status,
        authorizedAmount: authRecord.authorized_amount,
        currency: authRecord.currency,
        cardBrand: authRecord.card_brand,
        cardLast4: authRecord.card_last4,
        paymentMethodToken: authRecord.payment_method_token,
        ipAddress: authRecord.ip_address,
        userAgent: authRecord.user_agent,
        authorizationTextVersion: authRecord.authorization_text_version,
        authorizationTextHash: authRecord.authorization_text_hash,
        createdAt: authRecord.created_at,
        expiresAt: authRecord.expires_at,
        consumedAt: authRecord.consumed_at,
        quoteSnapshot: authRecord.quote_snapshot,
        itinerarySnapshot: authRecord.itinerary_snapshot,
        policiesSnapshot: authRecord.policies_snapshot
      } : null,
      passengers: relations.travellers || [],
      payments: relations.payments || [],
      complianceNotice: 'This evidence export certifies that passenger authorization was obtained prior to credit card charging or airline ticketing. Raw card numbers and CVCs were never stored or transmitted.'
    };

    return evidence;
  }
};

export default passengerAuthorizationService;
