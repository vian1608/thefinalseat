/**
 * supabase-booking-service.mjs
 * All database operations for bookings — uses Supabase PostgreSQL via service key.
 * This module is BACKEND ONLY. The service-role key must never reach the browser.
 */
import supabase from '../config/supabase.mjs';

// ─── Confirmation Code Generator ─────────────────────────────────────────────
export function generateConfirmationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const year = new Date().getFullYear();
  return `TFS-${year}-${randomPart}`;
}

// ─── CREATE BOOKING (all tables, transactional via sequential inserts) ─────────
/**
 * @param {Object} payload
 * @param {string} payload.customerName
 * @param {string} payload.email
 * @param {string} payload.phone
 * @param {Array}  payload.passengers        — traveller objects
 * @param {Object} payload.flight            — outbound flight
 * @param {Object} payload.returnFlight      — return flight (optional)
 * @param {string} payload.transactionId     — Stripe session/payment ID
 * @param {number} payload.displayedWebsitePrice
 * @param {number} payload.originalApiPrice
 * @param {string} payload.currency
 * @param {string} payload.status
 * @param {string} payload.paymentStatus
 * @param {Object} payload.specialRequests
 * @param {Object} payload.billingAddress
 */
export async function createBooking(payload) {
  const {
    customerName,
    email,
    phone,
    passengers = [],
    flight,
    returnFlight = null,
    transactionId = '',
    displayedWebsitePrice = 0,
    originalApiPrice = 0,
    currency = 'USD',
    status = 'PENDING',
    paymentStatus = 'paid',
    specialRequests = {},
    billingAddress = {}
  } = payload;

  const confirmation_code = generateConfirmationCode();

  // 1 — Insert master booking record
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      confirmation_code,
      status,
      payment_status: paymentStatus,
      total_amount: parseFloat(displayedWebsitePrice) || 0,
      currency,
      passenger_name: customerName,
      email,
      phone,
      original_api_price: parseFloat(originalApiPrice) || 0,
    })
    .select()
    .single();

  if (bookingErr) throw new Error(`Booking insert failed: ${bookingErr.message}`);
  const bookingId = booking.id;

  // 2 — Insert travellers (one row per passenger)
  if (passengers.length > 0) {
    const travellerRows = passengers.map((p) => ({
      booking_id: bookingId,
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
    }));
    const { error: travErr } = await supabase.from('travellers').insert(travellerRows);
    if (travErr) throw new Error(`Travellers insert failed: ${travErr.message}`);
  }

  // 3 — Insert contact record
  const { error: contactErr } = await supabase.from('contacts').insert({
    booking_id: bookingId,
    email: email,
    country_code: phone?.startsWith('+') ? phone.split(' ')[0] : null,
    phone_number: phone,
  });
  if (contactErr) throw new Error(`Contact insert failed: ${contactErr.message}`);

  // 4 — Insert flight records
  const flightRows = [];
  const tripType = returnFlight ? 'round-trip' : 'one-way';

  if (flight) {
    flightRows.push(buildFlightRow(bookingId, flight, 'outbound', tripType));
  }
  if (returnFlight) {
    flightRows.push(buildFlightRow(bookingId, returnFlight, 'return', tripType));
  }
  if (flightRows.length > 0) {
    const { error: flightErr } = await supabase.from('flights').insert(flightRows);
    if (flightErr) throw new Error(`Flights insert failed: ${flightErr.message}`);
  }

  // 5 — Insert payment record (Stripe reference only — no card data)
  const { error: payErr } = await supabase.from('payments').insert({
    booking_id: bookingId,
    payment_provider: 'stripe',
    stripe_session_id: transactionId || null,
    payment_amount: parseFloat(displayedWebsitePrice) || 0,
    currency,
    payment_status: paymentStatus,
    payment_date: new Date().toISOString(),
  });
  if (payErr) throw new Error(`Payment insert failed: ${payErr.message}`);

  // Return the full booking with confirmation code
  return { ...booking, confirmation_code, bookingReference: confirmation_code };
}

function buildFlightRow(bookingId, f, leg, tripType) {
  return {
    booking_id: bookingId,
    leg,
    trip_type: tripType,
    airline_name: f.airline || f.airlineName || null,
    flight_number: f.flightNumber || f.flight_number || null,
    departure_airport: f.departure?.airport || f.departureAirport || null,
    arrival_airport: f.arrival?.airport || f.arrivalAirport || null,
    departure_date: f.departure?.date || f.departureDate || null,
    arrival_date: f.arrival?.date || f.arrivalDate || null,
    departure_time_str: f.departure?.time || f.departureTime || null,
    arrival_time_str: f.arrival?.time || f.arrivalTime || null,
    duration: f.duration || null,
    stops: typeof f.stops === 'number' ? f.stops : 0,
    cabin_class: f.class || f.cabinClass || 'Economy',
    fare_details: f.price || f.fareDetails || null,
  };
}

// ─── GET BOOKING BY CONFIRMATION CODE ─────────────────────────────────────────
export async function getBookingByCode(confirmationCode) {
  return fetchFullBooking({ confirmation_code: confirmationCode });
}

// ─── GET BOOKING BY ID ────────────────────────────────────────────────────────
export async function getBookingById(id) {
  return fetchFullBooking({ id });
}

// ─── GET BOOKINGS BY EMAIL ────────────────────────────────────────────────────
export async function getBookingsByEmail(email) {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return enrichBookings(bookings);
}

// ─── SEARCH BOOKINGS (code OR email OR passenger name) ────────────────────────
export async function searchBookings(query) {
  const q = query.trim();

  // Try exact confirmation code first
  const { data: byCode } = await supabase
    .from('bookings')
    .select('*')
    .eq('confirmation_code', q.toUpperCase());

  if (byCode && byCode.length > 0) return enrichBookings(byCode);

  // Then search by email
  const { data: byEmail } = await supabase
    .from('bookings')
    .select('*')
    .ilike('email', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (byEmail && byEmail.length > 0) return enrichBookings(byEmail);

  // Then search by passenger name
  const { data: byName } = await supabase
    .from('bookings')
    .select('*')
    .ilike('passenger_name', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  return enrichBookings(byName || []);
}

// ─── GET ALL BOOKINGS (admin) ─────────────────────────────────────────────────
export async function getAllBookings(filters = {}) {
  let query = supabase.from('bookings').select('*');

  if (filters.status) {
    let s = filters.status.toUpperCase();
    if (s === 'CONFIRMED' || s === 'COMPLETED') s = 'DONE';
    query = query.eq('status', s);
  }
  if (filters.email) {
    query = query.ilike('email', `%${filters.email}%`);
  }
  if (filters.reference) {
    query = query.ilike('confirmation_code', `%${filters.reference}%`);
  }
  if (filters.name) {
    query = query.ilike('passenger_name', `%${filters.name}%`);
  }
  if (filters.date) {
    const start = `${filters.date}T00:00:00Z`;
    const end   = `${filters.date}T23:59:59Z`;
    query = query.gte('created_at', start).lte('created_at', end);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return enrichBookings(data || []);
}

// ─── UPDATE BOOKING STATUS (admin) ────────────────────────────────────────────
export async function updateBookingStatus(id, fields = {}) {
  const updateData = { updated_at: new Date().toISOString() };

  if (fields.status) {
    let s = fields.status.toUpperCase();
    if (s === 'CONFIRMED' || s === 'COMPLETED') s = 'DONE';
    if (s === 'CANCELLED') s = 'CANCELLED';
    updateData.status = s;
  }
  if (fields.internal_notes !== undefined) updateData.internal_notes = fields.internal_notes;
  if (fields.passenger_name)  updateData.passenger_name = fields.passenger_name;
  if (fields.email)           updateData.email = fields.email;
  if (fields.phone)           updateData.phone = fields.phone;

  const { data, error } = await supabase
    .from('bookings')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ─── GET STATS ────────────────────────────────────────────────────────────────
export async function getStats() {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('status, payment_status, total_amount');

  if (error) throw new Error(error.message);

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

  return stats;
}

// ─── SAVE ABANDONED BOOKING ───────────────────────────────────────────────────
export async function saveAbandonedBooking(data) {
  const { sessionKey, selectedFlight, returnFlight, travellerInfo, contactInfo, specialRequests, currentStep } = data;

  // Upsert by session key
  const existing = sessionKey ? await supabase
    .from('abandoned_bookings')
    .select('id')
    .eq('session_key', sessionKey)
    .maybeSingle() : { data: null };

  if (existing.data) {
    const { error } = await supabase
      .from('abandoned_bookings')
      .update({
        selected_flight: selectedFlight || null,
        return_flight: returnFlight || null,
        traveller_info: travellerInfo || null,
        contact_info: contactInfo || null,
        special_requests: specialRequests || null,
        current_step: currentStep || null,
        updated_at: new Date().toISOString()
      })
      .eq('session_key', sessionKey);
    if (error) throw new Error(error.message);
    return { updated: true };
  }

  const { error } = await supabase.from('abandoned_bookings').insert({
    session_key: sessionKey || null,
    selected_flight: selectedFlight || null,
    return_flight: returnFlight || null,
    traveller_info: travellerInfo || null,
    contact_info: contactInfo || null,
    special_requests: specialRequests || null,
    current_step: currentStep || null,
  });
  if (error) throw new Error(error.message);
  return { created: true };
}

// ─── DELETE ABANDONED BOOKING ────────────────────────────────────────────────
export async function deleteAbandonedBooking(sessionKey) {
  if (!sessionKey) return;
  await supabase.from('abandoned_bookings').delete().eq('session_key', sessionKey);
}

// ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────
async function fetchFullBooking(whereClause) {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*')
    .match(whereClause)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!booking) return null;

  const [travellers, contacts, flights, payments] = await Promise.all([
    supabase.from('travellers').select('*').eq('booking_id', booking.id),
    supabase.from('contacts').select('*').eq('booking_id', booking.id),
    supabase.from('flights').select('*').eq('booking_id', booking.id),
    supabase.from('payments').select('*').eq('booking_id', booking.id),
  ]);

  return buildBookingShape(
    booking,
    travellers.data || [],
    contacts.data || [],
    flights.data || [],
    payments.data || []
  );
}

async function enrichBookings(bookings) {
  // For list views, add traveller + flight summary without full joins (performance)
  return bookings.map(b => ({
    ...b,
    // Compatibility aliases
    confirmation_code: b.confirmation_code,
    bookingReference: b.confirmation_code,
    passenger_name: b.passenger_name,
    amount: b.total_amount,
    payment_reference: null,
    flight_details: null, // loaded on detail view
    traveller_details: null,
  }));
}

function buildBookingShape(booking, travellers, contacts, flights, payments) {
  const outbound = flights.find(f => f.leg === 'outbound');
  const returnFlt = flights.find(f => f.leg === 'return');
  const contact = contacts[0] || {};
  const payment = payments[0] || {};

  // Shape flight_details to match existing PaymentSuccess.js expectations
  const flight_details = outbound ? {
    airline: outbound.airline_name,
    flightNumber: outbound.flight_number,
    departure: {
      airport: outbound.departure_airport,
      date: outbound.departure_date,
      time: outbound.departure_time_str,
    },
    arrival: {
      airport: outbound.arrival_airport,
      date: outbound.arrival_date,
      time: outbound.arrival_time_str,
    },
    class: outbound.cabin_class,
    stops: outbound.stops,
    returnFlight: returnFlt ? {
      airline: returnFlt.airline_name,
      flightNumber: returnFlt.flight_number,
      departure: {
        airport: returnFlt.departure_airport,
        date: returnFlt.departure_date,
        time: returnFlt.departure_time_str,
      },
      arrival: {
        airport: returnFlt.arrival_airport,
        date: returnFlt.arrival_date,
        time: returnFlt.arrival_time_str,
      },
      class: returnFlt.cabin_class,
      stops: returnFlt.stops,
    } : null,
  } : null;

  return {
    ...booking,
    // Compatibility aliases for frontend
    id: booking.id,
    confirmation_code: booking.confirmation_code,
    bookingReference: booking.confirmation_code,
    payment_reference: payment.stripe_session_id,
    passenger_name: booking.passenger_name,
    email: booking.email,
    phone: booking.phone,
    amount: booking.total_amount,
    currency: booking.currency,
    status: booking.status,
    paymentStatus: booking.payment_status,
    created_at: booking.created_at,
    updated_at: booking.updated_at,
    // Related data
    flight_details,
    traveller_details: travellers,
    contact_details: contact,
    payment_details: payment,
  };
}
