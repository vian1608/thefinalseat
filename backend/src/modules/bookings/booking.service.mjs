import bookingRepository from './booking.repository.mjs';
import bookingMapper from './booking.mapper.mjs';
import { travellerService } from '../travellers/traveller.service.mjs';
import { sendBookingConfirmation } from '../../integrations/resend/resend.service.mjs';
import { itineraryMapper } from '../itineraries/itinerary.mapper.mjs';
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

export const bookingService = {
  create: async (payload) => {
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

    const insertRow = bookingMapper.toDatabaseInsert(confirmationCode, payloadWithPassengerName);
    const booking = await bookingRepository.createBookingRecord(insertRow);

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

    // 5 — Save primary contact details separately
    const rawPhone = String(payload.phone || '').trim();
    const countryCode = rawPhone.startsWith('+') ? rawPhone.split(' ')[0] : null;
    const contactRow = {
      booking_id: booking.id,
      email: payload.email,
      country_code: countryCode,
      phone_number: rawPhone
    };
    const contacts = await bookingRepository.insertContact(contactRow);

    // 6 — Save flight itineraries
    const flightsList = [];
    const tripType = payload.returnFlight ? 'round-trip' : 'one-way';
    
    if (payload.flight) {
      const outboundRows = itineraryMapper.toDatabaseRows(booking.id, payload.flight, 'outbound', tripType);
      flightsList.push(...outboundRows);
    }
    if (payload.returnFlight) {
      const returnRows = itineraryMapper.toDatabaseRows(booking.id, payload.returnFlight, 'return', tripType);
      flightsList.push(...returnRows);
    }
    
    let flights = [];
    if (flightsList.length > 0) {
      flights = await bookingRepository.insertFlights(flightsList);
    }

    // 7 — Save pending payment record with correct provider and pending status (no Stripe defaults)
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

    const canonicalBooking = bookingMapper.toCanonicalModel(
      booking,
      travellers,
      contacts,
      flights,
      payments
    );

    // Only send confirmation email if payment status is explicitly paid
    if (payload.paymentStatus === 'paid') {
      sendBookingConfirmation(canonicalBooking).catch(err => {
        logger.error(`Non-blocking email sending failed: ${err.message}`);
      });
    }

    return canonicalBooking;
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
    // Try as UUID (booking id) first, then as confirmation code string
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    const raw = isUUID
      ? await bookingRepository.findBookingById(ref)
      : await bookingRepository.findBookingByCode(ref);

    if (!raw) return null;

    // enrichBookingRecord is already called inside find* methods and attaches
    // travellers/contacts/flights/payments arrays on the returned object.
    const travellers = raw.travellers || [];
    const contacts   = raw.contacts   || [];
    const flights    = raw.flights    || [];
    const payments   = raw.payments   || [];

    return bookingMapper.toCanonicalModel(raw, travellers, contacts, flights, payments);
  }
};

export default bookingService;
