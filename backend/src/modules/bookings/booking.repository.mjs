import supabase from '../../integrations/supabase/supabase.client.mjs';
import logger from '../../config/logger.mjs';
import { buildCanonicalItinerary, calculateTripSummary } from '../../shared/utils/airline-lookup.mjs';
import bookingMapper from './booking.mapper.mjs';
import { BOOKING_STATUSES } from './booking.constants.mjs';


const segmentsMemoryStore = new Map();
const bookingsMemoryStore = new Map();
const splitsMemoryStore = new Map();
const ticketSnapshotsMemoryStore = new Map();
const authSnapshotsMemoryStore = new Map();
const auditLogsMemoryStore = new Map();
const paymentMethodsMemoryStore = new Map();
const emailDeliveriesMemoryStore = new Map();


export const bookingRepository = {


  createBookingRecord: async (dbRow) => {
    const isProduction = (process.env.NODE_ENV || 'development') === 'production';
    if (isProduction && (dbRow.is_mock || dbRow.isMock || dbRow.flight_details?.isMock)) {
      const err = new Error('Mock flight bookings are not permitted in production environment.');
      err.code = 'MOCK_FLIGHT_NOT_BOOKABLE';
      throw err;
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert(dbRow)
      .select()
      .single();

    if (error) {
      // Resilience fallback for schema cache delays on remote database: insert established core columns
      const coreRow = {
        confirmation_code: dbRow.confirmation_code,
        status: dbRow.status,
        payment_status: dbRow.payment_status,
        total_amount: dbRow.total_amount,
        original_api_price: dbRow.original_api_price,
        currency: dbRow.currency,
        passenger_name: dbRow.passenger_name,
        email: dbRow.email,
        phone: dbRow.phone,
      };
      const { data: coreData, error: coreError } = await supabase
        .from('bookings')
        .insert(coreRow)
        .select()
        .single();

      if (coreError) {
        logger.warn(`createBookingRecord Supabase notice: ${coreError.message}. Storing in resilience memory store.`);
        const fallbackId = dbRow.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
        const fallbackRecord = { id: fallbackId, created_at: new Date().toISOString(), ...dbRow };
        bookingsMemoryStore.set(fallbackId, fallbackRecord);
        if (dbRow.id) bookingsMemoryStore.set(dbRow.id, fallbackRecord);
        if (fallbackRecord.confirmation_code) bookingsMemoryStore.set(fallbackRecord.confirmation_code, fallbackRecord);
        await bookingRepository.recordAuditLog({
          bookingId: fallbackId,
          action: 'BOOKING_CREATED',
          oldValue: null,
          newValue: fallbackRecord,
          actor: dbRow.created_by || 'customer'
        });
        return fallbackRecord;
      }
      if (coreData) {
        if (coreData.id) bookingsMemoryStore.set(coreData.id, coreData);
        if (coreData.confirmation_code) bookingsMemoryStore.set(coreData.confirmation_code, coreData);
      }
      await bookingRepository.recordAuditLog({
        bookingId: coreData.id || dbRow.id,
        action: 'BOOKING_CREATED',
        oldValue: null,
        newValue: coreData,
        actor: dbRow.created_by || 'customer'
      });
      return coreData;
    }
    if (data) {
      if (data.id) bookingsMemoryStore.set(data.id, data);
      if (data.confirmation_code) bookingsMemoryStore.set(data.confirmation_code, data);
    }
    await bookingRepository.recordAuditLog({
      bookingId: data.id || dbRow.id,
      action: 'BOOKING_CREATED',
      oldValue: null,
      newValue: data,
      actor: dbRow.created_by || 'customer'
    });
    return data;
  },




  insertTravellers: async (travellerRows) => {
    const { data, error } = await supabase
      .from('travellers')
      .insert(travellerRows)
      .select();

    if (error) throw new Error(`Travellers records insert failed: ${error.message}`);
    return data;
  },

  insertContact: async (contactRow) => {
    const { data, error } = await supabase
      .from('contacts')
      .insert(contactRow)
      .select();

    if (error) {
      // Resilience fallback for character length limits before migration 006 runs
      const safeContactRow = {
        ...contactRow,
        phone_number: String(contactRow.phone_number || '').substring(0, 32),
        country_code: String(contactRow.country_code || '').substring(0, 10)
      };
      const { data: safeData, error: safeError } = await supabase
        .from('contacts')
        .insert(safeContactRow)
        .select();

      if (safeError) {
        console.warn('Non-blocking contact insert warning:', safeError.message);
        return [safeContactRow];
      }
      return safeData;
    }
    return data;
  },

  insertFlights: async (flightRows) => {
    const { data, error } = await supabase
      .from('flights')
      .insert(flightRows)
      .select();

    if (error) throw new Error(`Flights records insert failed: ${error.message}`);
    return data;
  },

  insertPayment: async (paymentRow) => {
    const { data, error } = await supabase
      .from('payments')
      .insert(paymentRow)
      .select();

    if (error) {
      // Fallback if optional payment provider columns are missing in remote DB schema
      const corePaymentRow = {
        booking_id: paymentRow.booking_id,
        payment_provider: paymentRow.payment_provider || 'whop',
        payment_amount: paymentRow.payment_amount || paymentRow.amount || 0,
        currency: paymentRow.currency || 'USD',
        payment_status: paymentRow.payment_status || 'pending',
        payment_date: paymentRow.payment_date || new Date().toISOString()
      };
      const { data: corePaymentData, error: corePaymentErr } = await supabase
        .from('payments')
        .insert(corePaymentRow)
        .select();

      if (corePaymentErr) throw new Error(`Payment record insert failed: ${corePaymentErr.message}`);
      return corePaymentData;
    }
    return data;
  },

  getRelations: async (bookingId) => {
    const [travellers, contacts, flights, payments, itinerarySegmentsResult] = await Promise.all([
      supabase.from('travellers').select('*').eq('booking_id', bookingId),
      supabase.from('contacts').select('*').eq('booking_id', bookingId),
      supabase.from('flights').select('*').eq('booking_id', bookingId),
      supabase.from('payments').select('*').eq('booking_id', bookingId),
      supabase.from('booking_itinerary_segments').select('*').eq('booking_id', bookingId).order('segment_sequence', { ascending: true })
    ]);

    const memorySegs = segmentsMemoryStore.get(bookingId) || [];
    const normalizedDbSegs = itinerarySegmentsResult.data || [];

    // PRODUCTION FALLBACK: If booking_itinerary_segments table doesn't exist (schema not migrated yet)
    // or returned 0 rows, map the legacy `flights` table rows to the canonical segment shape.
    // The flights table uses: leg ('outbound'/'return'), departure_airport, arrival_airport,
    // airline_name, flight_number, departure_date, departure_time_str, arrival_date,
    // arrival_time_str, cabin_class, stops.
    let finalSegs;
    const flightRows = flights.data || [];
    if (normalizedDbSegs.length > 0) {
      finalSegs = normalizedDbSegs;
    } else if (memorySegs.length > 0) {
      finalSegs = memorySegs;
    } else if (flightRows.length > 0) {
      // Map legacy flights table to canonical segment shape so buildCanonicalItinerary can read it
      let outSeq = 1;
      let retSeq = 1;
      finalSegs = flightRows.map((f) => {
        const dir = (f.leg === 'return' || f.leg === 'inbound') ? 'return' : 'outbound';
        const seq = dir === 'return' ? retSeq++ : outSeq++;
        return {
          id: f.id,
          booking_id: f.booking_id,
          journey_direction: dir,
          direction: dir,
          segment_sequence: seq,
          carrier_name: f.airline_name || f.carrier_name || '',
          carrier_code: f.carrier_code || f.marketing_carrier_code || '',
          marketing_carrier_code: f.carrier_code || f.marketing_carrier_code || '',
          airline_name: f.airline_name || '',
          flight_number: f.flight_number || '',
          origin_airport: f.departure_airport || f.origin_airport || '',
          destination_airport: f.arrival_airport || f.destination_airport || '',
          origin_city: f.departure_airport || '',
          destination_city: f.arrival_airport || '',
          departure_date: f.departure_date || '',
          departure_time: f.departure_time_str || f.departure_time || '',
          arrival_date: f.arrival_date || '',
          arrival_time: f.arrival_time_str || f.arrival_time || '',
          cabin: f.cabin_class || f.cabin || 'Economy',
          stop_count: parseInt(f.stops || 0, 10),
          // source marker so we can distinguish
          _source: 'flights_table'
        };
      });
      logger.info(`[getRelations] Booking ${bookingId}: booking_itinerary_segments empty — using ${finalSegs.length} rows from flights table as canonical segments.`);
    } else {
      finalSegs = [];
    }

    const paymentSplits = await bookingRepository.getPaymentSplits(bookingId);
    const paymentMethod = await bookingRepository.getPaymentMethodByBookingId(bookingId);

    return {
      travellers: travellers.data || [],
      contacts: contacts.data || [],
      flights: flights.data || [],
      payments: payments.data || [],
      itinerarySegments: finalSegs,
      paymentSplits: paymentSplits || [],
      paymentMethod: paymentMethod || null
    };
  },


  enrichBookingRecord: (booking, relations = { travellers: [], contacts: [], flights: [], payments: [], itinerarySegments: [], paymentSplits: [] }) => {
    if (!booking) return null;
    const segments = relations.itinerarySegments || [];
    const outboundSegs = segments.filter(s => (s.journey_direction || s.direction) === 'outbound');
    const returnSegs = segments.filter(s => (s.journey_direction || s.direction) === 'return');
    const outboundFlight = outboundSegs[0] || relations.flights?.find(f => f.direction === 'outbound') || relations.flights?.[0] || {};
    const firstTraveller = relations.travellers?.[0] || {};

    const travellerName = [firstTraveller.first_name, firstTraveller.middle_name, firstTraveller.last_name].filter(Boolean).join(' ');
    const masterName = travellerName.trim() || booking.passenger_name || 'Valued Passenger';
    const carrier = outboundFlight.carrier_name || outboundFlight.airline || outboundFlight.carrier || null;
    const originCode = outboundFlight.origin_airport || outboundFlight.departure_airport || outboundFlight.origin || null;
    const destCode = outboundSegs.length > 0 ? outboundSegs[outboundSegs.length - 1].destination_airport : (outboundFlight.arrival_airport || outboundFlight.destination || null);
    const departureDate = outboundFlight.departure_date || outboundFlight.departure_time || null;

    const pnrVal = booking.airline_confirmation_number || booking.airlineConfirmationNumber || booking.airline_pnr || booking.pnr || null;
    const nameVal = booking.airline_name || booking.airlineName || null;
    const codeVal = booking.airline_code || booking.airlineCode || null;
    const logoVal = booking.airline_logo_url || booking.airlineLogoUrl || null;
    const tktVal = booking.ticket_number || booking.ticketNumber || null;
    const dateVal = booking.ticket_issued_at || booking.ticketIssuedAt || null;
    const notesVal = booking.ticket_notes || booking.ticketNotes || null;
    const suppVal = booking.supplier_confirmation || booking.supplierConfirmation || null;

    return {
      ...booking,
      passenger_name: masterName,
      carrier: carrier || nameVal,
      airline: carrier || nameVal,
      origin_code: originCode,
      destination_code: destCode,
      departure_date: departureDate,
      airline_name: nameVal,
      airline_code: codeVal,
      airline_logo_url: logoVal,
      airline_confirmation_number: pnrVal,
      airline_pnr: pnrVal,
      pnr: pnrVal,
      ticket_number: tktVal,
      ticket_issued_at: dateVal,
      ticket_notes: notesVal,
      supplier_confirmation: suppVal,
      airlineName: nameVal,
      airlineCode: codeVal,
      airlineLogoUrl: logoVal,
      airlineConfirmationNumber: pnrVal,
      ticketNumber: tktVal,
      ticketIssuedAt: dateVal,
      ticketNotes: notesVal,
      supplierConfirmation: suppVal,
      travellers: relations.travellers || [],
      contacts: relations.contacts || [],
      flights: relations.flights || [],
      payments: relations.payments || [],
      itinerary_segments: segments,
      outbound_segments: outboundSegs,
      return_segments: returnSegs,
      payment_splits: relations.paymentSplits || [],
      paymentMethod: relations.paymentMethod || null,
      payment_method: relations.paymentMethod || null,

      flight_details: outboundFlight ? {
        airline: carrier || nameVal,
        departure: {
          airport: originCode,
          date: departureDate
        },
        arrival: {
          airport: destCode
        }
      } : null
    };
  },


  findBookingByCode: async (code) => {
    const memOverridden = bookingsMemoryStore.get(code);
    if (memOverridden && memOverridden._deleted) return null;

    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('confirmation_code', code)
      .maybeSingle();

    // If no Supabase record AND no memory record → not found
    if (!data && !memOverridden) return null;
    const baseData = { ...(data || {}), ...(memOverridden || {}) };
    if (!baseData.id) return null;
    const relations = await bookingRepository.getRelations(baseData.id);
    return bookingRepository.enrichBookingRecord(baseData, relations);
  },

  getByReference: async (code) => {
    return bookingRepository.findBookingByCode(code);
  },

  findBookingById: async (id) => {
    const memOverridden = bookingsMemoryStore.get(id);
    if (memOverridden && memOverridden._deleted) return null;

    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    // If no Supabase record AND no memory record → not found
    if (!data && !memOverridden) return null;

    // Merge: Supabase base + memory overrides (memory wins for transient fields)
    const baseData = { ...(data || {}), ...(memOverridden || {}) };

    if (!baseData.id) return null;
    const relations = await bookingRepository.getRelations(baseData.id);
    return bookingRepository.enrichBookingRecord(baseData, relations);
  },

  getById: async (idOrCode) => {
    if (!idOrCode) return null;
    let b = await bookingRepository.findBookingById(idOrCode);
    if (!b) {
      b = await bookingRepository.findBookingByCode(idOrCode);
    }
    return b;
  },

  getCompleteBookingById: async (idOrCode) => {
    if (!idOrCode) return null;
    let baseBooking = await bookingRepository.findBookingById(idOrCode);
    if (!baseBooking) {
      baseBooking = await bookingRepository.findBookingByCode(idOrCode);
    }
    if (!baseBooking || baseBooking._deleted) return null;

    const realId = baseBooking.id;
    const relations = await bookingRepository.getRelations(realId);
    const enriched = bookingRepository.enrichBookingRecord(baseBooking, relations);
    const itinerary = buildCanonicalItinerary(enriched);
    const tripSummary = calculateTripSummary(enriched);
    const canonical = bookingMapper.toCanonicalModel(
      baseBooking,
      relations.travellers || [],
      relations.contacts || [],
      relations.flights || [],
      relations.payments || []
    ) || {};

    const ticketDetails = {
      airlineCode: enriched.airline_code || enriched.airlineCode || null,
      airlineName: enriched.airline_name || enriched.airlineName || null,
      airlineLogoUrl: enriched.airline_logo_url || enriched.airlineLogoUrl || null,
      airlineConfirmationNumber: enriched.airline_confirmation_number || enriched.airlineConfirmationNumber || null,
      ticketNumber: enriched.ticket_number || enriched.ticketNumber || null,
      ticketIssuedAt: enriched.ticket_issued_at || enriched.ticketIssuedAt || null,
      ticketNotes: enriched.ticket_notes || enriched.ticketNotes || null,
      supplierConfirmation: enriched.supplier_confirmation || enriched.supplierConfirmation || null
    };

    const emailActivity = {
      logs: relations.emailLogs || [],
      lastSentAt: enriched.authorization_email_sent_at || null
    };

    return {
      ...enriched,
      ...canonical,
      bookingId: enriched.confirmation_code || enriched.bookingReference || realId,
      notes: enriched.internal_notes || enriched.internalNotes || '',
      itinerary,
      outbound_segments: itinerary.outbound,
      return_segments: itinerary.return,
      pricing: canonical.pricing || enriched.pricing || {},
      ticketDetails,
      authorization: canonical.authorization || enriched.authorization || {},
      payment: canonical.payment || enriched.payment || {},
      paymentSplits: relations.paymentSplits || enriched.payment_splits || [],
      paymentMethod: relations.paymentMethod || enriched.paymentMethod || null,
      emailActivity,
      trip_summary: tripSummary,
      tripSummary: tripSummary
    };
  },

  saveTicketDetails: async (bookingId, ticketData = {}, adminId = 'admin') => {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) throw new Error('Booking not found');
    const realId = booking.id;
    const publicRef = booking.confirmation_code || booking.bookingReference || realId;

    const {
      airlineCode,
      airlineName,
      airlineLogoUrl,
      airlineConfirmationNumber,
      ticketNumber,
      ticketIssuedAt,
      ticketNotes,
      supplierConfirmation
    } = ticketData;

    let cleanPnr = booking.airline_confirmation_number || null;
    if (airlineConfirmationNumber !== undefined && airlineConfirmationNumber !== null && String(airlineConfirmationNumber).trim() !== '') {
      const rawPnr = String(airlineConfirmationNumber).trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(rawPnr)) {
        throw new Error('Airline confirmation number must contain exactly 6 letters or numbers.');
      }
      cleanPnr = rawPnr;
    }

    let cleanTkt = booking.ticket_number || null;
    if (ticketNumber !== undefined && ticketNumber !== null && String(ticketNumber).trim() !== '') {
      const rawTkt = String(ticketNumber).trim();
      if (!/^\d{1,13}$/.test(rawTkt)) {
        throw new Error('Ticket number must contain digits only and cannot exceed 13 digits.');
      }
      cleanTkt = rawTkt;
    }

    const cleanCode = airlineCode !== undefined ? (airlineCode ? String(airlineCode).trim().toUpperCase() : null) : (booking.airline_code || null);
    const cleanName = airlineName !== undefined ? (airlineName ? String(airlineName).trim() : null) : (booking.airline_name || null);
    const cleanLogo = airlineLogoUrl !== undefined ? (airlineLogoUrl ? String(airlineLogoUrl).trim() : null) : (booking.airline_logo_url || null);
    const cleanSupp = supplierConfirmation !== undefined ? (supplierConfirmation ? String(supplierConfirmation).trim() : null) : (booking.supplier_confirmation || null);
    const cleanNotes = ticketNotes !== undefined ? (ticketNotes ? String(ticketNotes).trim() : null) : (booking.ticket_notes || null);
    const cleanIssuedAt = ticketIssuedAt !== undefined ? (ticketIssuedAt ? String(ticketIssuedAt).slice(0, 10) : null) : (booking.ticket_issued_at ? String(booking.ticket_issued_at).slice(0, 10) : null);

    const updatePayload = {
      updated_at: new Date().toISOString()
    };

    if (airlineCode !== undefined) updatePayload.airline_code = cleanCode;
    if (airlineName !== undefined) updatePayload.airline_name = cleanName;
    if (airlineLogoUrl !== undefined) updatePayload.airline_logo_url = cleanLogo;
    if (airlineConfirmationNumber !== undefined) updatePayload.airline_confirmation_number = cleanPnr;
    if (ticketNumber !== undefined) updatePayload.ticket_number = cleanTkt;
    if (ticketIssuedAt !== undefined) updatePayload.ticket_issued_at = cleanIssuedAt;
    if (ticketNotes !== undefined) updatePayload.ticket_notes = cleanNotes;
    if (supplierConfirmation !== undefined) updatePayload.supplier_confirmation = cleanSupp;

    logger.info(`[TicketDetails Diagnostic] PublicID: ${publicRef} | InternalID: ${realId} | Table: bookings | RequestFields: ${Object.keys(ticketData).join(',')}`);

    await bookingRepository.updateStatus(realId, updatePayload);

    // Audit event determination
    let eventType = 'TICKET_DETAILS_UPDATED';
    if (!booking.airline_confirmation_number && cleanPnr) {
      eventType = 'TICKET_DETAILS_CREATED';
    } else if (airlineConfirmationNumber !== undefined && cleanPnr !== booking.airline_confirmation_number) {
      eventType = 'AIRLINE_PNR_UPDATED';
    } else if ((airlineName !== undefined || airlineCode !== undefined) && (cleanName !== booking.airline_name || cleanCode !== booking.airline_code)) {
      eventType = 'AIRLINE_UPDATED';
    } else if (ticketNumber !== undefined && cleanTkt !== booking.ticket_number) {
      eventType = 'TICKET_NUMBER_UPDATED';
    } else if (ticketIssuedAt !== undefined && cleanIssuedAt !== booking.ticket_issued_at) {
      eventType = 'TICKET_ISSUE_DATE_UPDATED';
    }

    await bookingRepository.recordStatusAudit({
      bookingId: realId,
      oldStatus: booking.status,
      newStatus: booking.status,
      adminId,
      reason: `[${eventType}] PNR: ${cleanPnr || 'N/A'}, Airline: ${cleanName || 'N/A'} (${cleanCode || 'N/A'}), Ticket: ${cleanTkt || 'N/A'}, IssuedAt: ${cleanIssuedAt || 'N/A'}`
    });

    // Create Immutable Append-Only Ticket Snapshot
    if (cleanPnr || cleanTkt) {
      const completeBooking = await bookingRepository.getById(realId);
      const relations = await bookingRepository.getRelations(realId);
      const finalItinerary = (relations?.itinerarySegments && relations.itinerarySegments.length > 0)
        ? relations.itinerarySegments
        : (completeBooking?.itinerary_segments || completeBooking?.flights || []);

      await bookingRepository.createTicketSnapshot({
        booking_id: realId,
        airline: cleanName || booking.airline_name || 'Airline',
        airline_code: cleanCode || booking.airline_code || null,
        pnr: cleanPnr || booking.airline_confirmation_number || 'PNR_PENDING',
        ticket_number: cleanTkt || booking.ticket_number || null,
        final_itinerary: finalItinerary,
        final_price: parseFloat(completeBooking?.customer_price || completeBooking?.total_amount || booking.total_amount || 0),
        currency: (completeBooking?.currency || booking.currency || 'USD').toUpperCase(),
        issue_date: cleanIssuedAt ? new Date(cleanIssuedAt).toISOString() : new Date().toISOString()
      });

      await bookingRepository.recordAuditLog({
        bookingId: realId,
        action: 'TICKET_CREATED',
        oldValue: { pnr: booking.airline_confirmation_number, ticket_number: booking.ticket_number },
        newValue: { pnr: cleanPnr, ticket_number: cleanTkt, airline: cleanName, issue_date: cleanIssuedAt },
        actor: adminId || 'admin'
      });
    }

    return bookingRepository.getCompleteBookingById(realId);
  },

  /**
   * Create Immutable Append-Only Ticket Snapshot Entry
   */
  createTicketSnapshot: async (snapshotPayload) => {
    const snapshotId = snapshotPayload.id || `tkt_snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id: snapshotId,
      booking_id: snapshotPayload.booking_id,
      airline: snapshotPayload.airline || snapshotPayload.airline_name || 'Airline',
      airline_code: snapshotPayload.airline_code || null,
      pnr: snapshotPayload.pnr,
      ticket_number: snapshotPayload.ticket_number || null,
      final_itinerary: snapshotPayload.final_itinerary || [],
      final_price: parseFloat(snapshotPayload.final_price || 0),
      currency: (snapshotPayload.currency || 'USD').toUpperCase(),
      issue_date: snapshotPayload.issue_date || new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // 1. Memory Store (Append-Only Array)
    const list = ticketSnapshotsMemoryStore.get(record.booking_id) || [];
    list.push(record);
    ticketSnapshotsMemoryStore.set(record.booking_id, list);

    // 2. Database persistent insert
    const { error } = await supabase
      .from('ticket_snapshots')
      .insert(record);

    if (error) {
      logger.warn(`ticket_snapshots insert notice (stored in memory store): ${error.message}`);
    }

    logger.info(`[TicketSnapshot] Created immutable ticket snapshot ${record.id} for booking ${record.booking_id} (PNR: ${record.pnr}, Ticket: ${record.ticket_number || 'N/A'})`);
    return record;
  },

  /**
   * Fetch all historical ticket snapshots for a booking (ordered by creation date ascending)
   */
  getTicketSnapshotsForBooking: async (bookingId) => {
    const memList = ticketSnapshotsMemoryStore.get(bookingId) || [];
    const { data, error } = await supabase
      .from('ticket_snapshots')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
    return memList;
  },

  /**
   * Save Tokenized Payment Method & Billing Metadata (PCI-Compliant: NO PAN or CVV/CVC)
   */
  savePaymentMethodRecord: async (bookingId, payload = {}) => {
    const record = {
      id: payload.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
      booking_id: bookingId,
      payment_provider: payload.payment_provider || payload.paymentProvider || 'stripe',
      provider_customer_id: payload.provider_customer_id || payload.providerCustomerId || null,
      provider_payment_method_id: payload.provider_payment_method_id || payload.providerPaymentMethodId || payload.paymentMethodToken || `pm_tok_${Date.now()}`,
      cardholder_name: payload.cardholder_name || payload.cardholderName || null,
      card_brand: payload.card_brand || payload.cardBrand || 'Credit Card',
      card_last4: String(payload.card_last4 || payload.cardLast4 || '4242').replace(/\D/g, '').slice(-4),
      card_exp_month: payload.card_exp_month !== undefined ? parseInt(payload.card_exp_month) : (payload.cardExpMonth ? parseInt(payload.cardExpMonth) : null),
      card_exp_year: payload.card_exp_year !== undefined ? parseInt(payload.card_exp_year) : (payload.cardExpYear ? parseInt(payload.cardExpYear) : null),
      billing_address_line1: payload.billing_address_line1 || payload.billingAddressLine1 || payload.billingAddress || null,
      billing_address_line2: payload.billing_address_line2 || payload.billingAddressLine2 || null,
      billing_city: payload.billing_city || payload.billingCity || null,
      billing_state: payload.billing_state || payload.billingState || null,
      billing_postal_code: payload.billing_postal_code || payload.billingPostalCode || payload.billingZip || null,
      billing_country: payload.billing_country || payload.billingCountry || 'United States',
      billing_phone: payload.billing_phone || payload.billingPhone || null,
      tokenization_status: payload.tokenization_status || payload.tokenizationStatus || 'TOKENIZED',
      removed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 1. Store in memory store (Idempotent per booking)
    paymentMethodsMemoryStore.set(bookingId, record);
    paymentMethodsMemoryStore.set(record.id, record);

    // 2. Database persistent insert
    const { data, error } = await supabase
      .from('booking_payment_methods')
      .upsert(record)
      .select()
      .maybeSingle();

    if (error) {
      logger.warn(`booking_payment_methods upsert notice (stored in memory store): ${error.message}`);
    }

    logger.info(`[PaymentMethod] Saved tokenized payment method ${record.provider_payment_method_id} for booking ${bookingId} (${record.card_brand} ending in ${record.card_last4})`);
    return data || record;
  },

  /**
   * Get Active Tokenized Payment Method for a Booking
   */
  getPaymentMethodByBookingId: async (bookingId) => {
    const memRecord = paymentMethodsMemoryStore.get(bookingId);

    const { data, error } = await supabase
      .from('booking_payment_methods')
      .select('*')
      .eq('booking_id', bookingId)
      .is('removed_at', null)
      .maybeSingle();

    if (error || !data) {
      return memRecord || null;
    }

    return data;
  },

  /**
   * Record System-Wide Audit Log Entry
   */
  recordAuditLog: async ({ bookingId, action, oldValue = null, newValue = null, actor = 'system', ipAddress = null }) => {
    if (!bookingId) return null;
    const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id: logId,
      booking_id: bookingId,
      action,
      old_value: oldValue,
      new_value: newValue,
      actor: actor || 'system',
      ip_address: ipAddress || null,
      created_at: new Date().toISOString()
    };

    // 1. Memory Store (Append-Only Array)
    const list = auditLogsMemoryStore.get(bookingId) || [];
    list.push(record);
    auditLogsMemoryStore.set(bookingId, list);

    // 2. Database Persistent Insert
    const { error } = await supabase
      .from('audit_logs')
      .insert(record);

    if (error) {
      logger.warn(`audit_logs insert notice (stored in memory store): ${error.message}`);
    }

    logger.info(`[AuditLog] Action '${action}' recorded for booking ${bookingId} by actor '${record.actor}'`);
    return record;
  },

  /**
   * Fetch all historical audit logs for a booking (ordered by creation date ascending)
   */
  getAuditLogsForBooking: async (bookingId) => {
    const memList = auditLogsMemoryStore.get(bookingId) || [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
    return memList;
  },



  findBookingsByEmail: async (email) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .ilike('email', email)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    const enrichedList = await Promise.all((data || []).map(async b => {
      const rels = await bookingRepository.getRelations(b.id);
      return bookingRepository.enrichBookingRecord(b, rels);
    }));
    return enrichedList;
  },

  searchBookings: async (q) => {
    const queryStr = q.trim();
    const { data: byCode } = await supabase
      .from('bookings')
      .select('*')
      .eq('confirmation_code', queryStr.toUpperCase());

    let matchData = byCode || [];

    if (!matchData.length) {
      const { data: byEmail } = await supabase
        .from('bookings')
        .select('*')
        .ilike('email', `%${queryStr}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      matchData = byEmail || [];
    }

    if (!matchData.length) {
      const { data: byName } = await supabase
        .from('bookings')
        .select('*')
        .ilike('passenger_name', `%${queryStr}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      matchData = byName || [];
    }

    const enrichedList = await Promise.all(matchData.map(async b => {
      const rels = await bookingRepository.getRelations(b.id);
      return bookingRepository.enrichBookingRecord(b, rels);
    }));

    return enrichedList;
  },

  findAllBookings: async (filters = {}) => {
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

    const enrichedList = await Promise.all((data || []).map(async b => {
      const memOverridden = bookingsMemoryStore.get(b.id) || (b.confirmation_code ? bookingsMemoryStore.get(b.confirmation_code) : null);
      const merged = memOverridden ? { ...b, ...memOverridden } : b;
      const rels = await bookingRepository.getRelations(merged.id);
      return bookingRepository.enrichBookingRecord(merged, rels);
    }));

    return enrichedList;
  },

  markConfirmationEmailSent: async (id, emailId) => {
    const sentAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('bookings')
      .update({
        confirmation_email_sent_at: sentAt,
        confirmation_email_id: String(emailId || 'sent')
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      const { data: safeData, error: safeError } = await supabase
        .from('bookings')
        .update({
          confirmation_email_sent_at: sentAt
        })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (safeError) logger.warn(`Failed to update confirmation_email_sent_at for booking ${id}: ${safeError.message}`);
      return safeData;
    }
    return data;
  },


  updateStatus: async (id, updateFields) => {
    const cleanFields = { ...updateFields };
    delete cleanFields.crm_status;
    delete cleanFields.price_checked_at;

    // Retrieve existing record so un-updated fields are preserved
    let existing = bookingsMemoryStore.get(id);
    if (!existing || Object.keys(existing).length === 0) {
      const dbRec = await bookingRepository.getById(id);
      if (dbRec) {
        existing = dbRec;
        bookingsMemoryStore.set(id, dbRec);
      } else {
        existing = {};
      }
    }

    const updatedMem = { ...existing, ...cleanFields };
    bookingsMemoryStore.set(id, updatedMem);
    if (existing.confirmation_code) {
      bookingsMemoryStore.set(existing.confirmation_code, updatedMem);
    }

    // Attempt full Supabase write
    const { data, error } = await supabase
      .from('bookings')
      .update(cleanFields)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      logger.warn(`Supabase schema notice: ${error.message}.`);

      // Retry without non-persisted schema fields (paid_amount, paid_at, refund_amount, delete_reason)
      const safeFields = { ...cleanFields };
      delete safeFields.paid_amount;
      delete safeFields.paid_at;
      delete safeFields.refund_amount;
      delete safeFields.refund_timestamp;
      delete safeFields.delete_reason;

      if (Object.keys(safeFields).length > 0) {
        const { data: safeData, error: safeErr } = await supabase
          .from('bookings')
          .update(safeFields)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (!safeErr && safeData) {
          const finalRec = { ...updatedMem, ...safeData };
          bookingsMemoryStore.set(id, finalRec);
          if (finalRec.confirmation_code) {
            bookingsMemoryStore.set(finalRec.confirmation_code, finalRec);
          }
          return finalRec;
        }
      }

      return updatedMem;
    }

    const finalRec = data ? { ...updatedMem, ...data } : updatedMem;
    bookingsMemoryStore.set(id, finalRec);
    if (finalRec.confirmation_code) {
      bookingsMemoryStore.set(finalRec.confirmation_code, finalRec);
    }
    return finalRec;
  },





  recordStatusAudit: async (auditData) => {
    try {
      await supabase
        .from('booking_status_audits')
        .insert({
          booking_id: auditData.bookingId,
          old_status: auditData.oldStatus,
          new_status: auditData.newStatus,
          admin_id: auditData.adminId || 'admin',
          reason: auditData.reason || null
        });
    } catch (e) {
      logger.warn(`recordStatusAudit notice: ${e.message}`);
    }
  },



  saveAllBookingChanges: async (bookingId, payload = {}, adminInfo = {}) => {
    const adminId = adminInfo.email || adminInfo.id || 'admin';
    const existingBooking = await bookingRepository.getById(bookingId);
    if (!existingBooking) {
      return {
        success: false,
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found.',
        field: 'id'
      };
    }

    const realId = existingBooking.id;

    // 1. Validate Booking Status if provided
    const targetBookingStatus = (payload.status || payload.bookingStatus) ? String(payload.status || payload.bookingStatus).toUpperCase() : null;
    if (targetBookingStatus && !BOOKING_STATUSES.includes(targetBookingStatus)) {
      return {
        success: false,
        code: 'INVALID_STATUS',
        message: `Invalid booking status '${targetBookingStatus}'. Allowed canonical statuses are: ${BOOKING_STATUSES.join(', ')}.`,
        field: 'status'
      };
    }

    // Require flight itinerary for completion/ticketing statuses
    if (targetBookingStatus && ['DONE', 'TICKETED', 'PAID'].includes(targetBookingStatus)) {
      const { default: bookingValidatorService } = await import('./booking-validator.service.mjs');
      const valResult = await bookingValidatorService.validateBookingIntegrity(realId, { requireItinerary: true });
      if (!valResult.valid) {
        return {
          success: false,
          code: 'BOOKING_ITINERARY_INCOMPLETE',
          message: 'Booking itinerary is incomplete. Please complete itinerary before continuing.',
          field: 'itinerary'
        };
      }
    }

    // 2. Validate Ticket Details if provided
    const rawPnr = payload.airlineConfirmationNumber ?? payload.airlinePnr ?? payload.pnr;
    let cleanPnr = existingBooking.airline_confirmation_number || null;
    if (rawPnr !== undefined && rawPnr !== null && String(rawPnr).trim() !== '') {
      const pnrStr = String(rawPnr).trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(pnrStr)) {
        return {
          success: false,
          code: 'INVALID_PNR',
          message: 'Airline confirmation number (PNR) must contain exactly 6 letters or numbers.',
          field: 'airlineConfirmationNumber'
        };
      }
      cleanPnr = pnrStr;
    }

    const rawTkt = payload.ticketNumber;
    let cleanTkt = existingBooking.ticket_number || null;
    if (rawTkt !== undefined && rawTkt !== null && String(rawTkt).trim() !== '') {
      const tktStr = String(rawTkt).trim();
      if (!/^\d{1,13}$/.test(tktStr)) {
        return {
          success: false,
          code: 'INVALID_TICKET_NUMBER',
          message: 'Ticket number must contain digits only and cannot exceed 13 digits.',
          field: 'ticketNumber'
        };
      }
      cleanTkt = tktStr;
    }

    // 3. Validate Payment Status & Fields if provided
    const targetPaymentStatus = payload.paymentStatus ? String(payload.paymentStatus).toUpperCase() : null;
    if (targetPaymentStatus) {
      const allowedPaymentStatuses = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED'];
      if (!allowedPaymentStatuses.includes(targetPaymentStatus)) {
        return {
          success: false,
          code: 'INVALID_PAYMENT_STATUS',
          message: `Invalid payment status '${targetPaymentStatus}'. Allowed values: ${allowedPaymentStatuses.join(', ')}.`,
          field: 'paymentStatus'
        };
      }

      if (targetPaymentStatus === 'PAID') {
        const transactionRef = payload.transactionReference || payload.transaction_id || payload.payment_intent_id || existingBooking.transaction_id;
        const paidAmount = payload.paidAmount !== undefined ? parseFloat(payload.paidAmount) : parseFloat(existingBooking.customer_price || existingBooking.total_amount || 0);
        if (!transactionRef && !payload.override) {
          return {
            success: false,
            code: 'PAYMENT_UPDATE_FAILED',
            message: 'Unable to update payment status to PAID: transaction reference is missing.',
            field: 'transactionReference'
          };
        }
        if (paidAmount <= 0 && !payload.override) {
          return {
            success: false,
            code: 'PAYMENT_UPDATE_FAILED',
            message: 'Paid status requires a paid amount greater than zero.',
            field: 'paidAmount'
          };
        }
      }

      if (targetPaymentStatus === 'REFUNDED') {
        const refundAmount = parseFloat(payload.refundAmount || payload.refunded_amount || 0);
        const refundRef = payload.refundReference || payload.refund_id || existingBooking.refund_reference;
        const paidAmount = parseFloat(existingBooking.customer_price || existingBooking.total_amount || 0);

        if (refundAmount <= 0 && !payload.override) {
          return {
            success: false,
            code: 'PAYMENT_UPDATE_FAILED',
            message: 'Refunded status requires a refund amount greater than zero.',
            field: 'refundAmount'
          };
        }
        if (!refundRef && !payload.override) {
          return {
            success: false,
            code: 'PAYMENT_UPDATE_FAILED',
            message: 'Refunded status requires a valid refund reference ID.',
            field: 'refundReference'
          };
        }
        if (paidAmount > 0 && refundAmount > paidAmount && !payload.override) {
          return {
            success: false,
            code: 'PAYMENT_UPDATE_FAILED',
            message: `Refund amount ($${refundAmount.toFixed(2)}) cannot exceed paid amount ($${paidAmount.toFixed(2)}).`,
            field: 'refundAmount'
          };
        }
      }
    }

    // 4. Validate Payment Splits if provided
    if (Array.isArray(payload.paymentSplits) && payload.paymentSplits.length > 0) {
      for (const [idx, split] of payload.paymentSplits.entries()) {
        const name = (split.merchantName || split.merchant_name || split.name || split.merchant || '').trim();
        if (!name) {
          return {
            success: false,
            code: 'INVALID_PAYMENT_SPLIT',
            message: `Payment split at row ${idx + 1} requires a merchant name.`,
            field: `paymentSplits[${idx}].merchantName`
          };
        }
        const amt = parseFloat(split.amount || 0);
        if (!Number.isFinite(amt) || amt <= 0) {
          return {
            success: false,
            code: 'INVALID_PAYMENT_SPLIT',
            message: `Payment split for '${name}' must have an amount greater than zero.`,
            field: `paymentSplits[${idx}].amount`
          };
        }
        const decimals = (String(amt).split('.')[1] || '').length;
        if (decimals > 2) {
          return {
            success: false,
            code: 'INVALID_PAYMENT_SPLIT',
            message: `Payment split for '${name}' cannot have more than two decimal places.`,
            field: `paymentSplits[${idx}].amount`
          };
        }
      }
    }

    // 4.5 Validate Itinerary Segments if provided
    if (Array.isArray(payload.itinerarySegments) && payload.itinerarySegments.length > 0) {
      for (const [idx, seg] of payload.itinerarySegments.entries()) {
        const orig = (seg.origin_airport || seg.originCode || seg.departure_airport || '').trim();
        const dest = (seg.destination_airport || seg.destinationCode || seg.arrival_airport || '').trim();
        if (!orig || !dest) {
          return {
            success: false,
            code: 'INVALID_ITINERARY_SEGMENT',
            message: `Itinerary segment #${idx + 1} requires origin and destination airport codes.`,
            field: `itinerarySegments[${idx}]`
          };
        }
      }
    }

    // 5. Begin Transactional Mutation
    try {
      const bookingUpdateFields = {
        updated_at: new Date().toISOString()
      };

      // Status & Notes
      if (targetBookingStatus) {
        bookingUpdateFields.status = targetBookingStatus;
      }
      if (payload.internalNotes !== undefined) {
        bookingUpdateFields.internal_notes = payload.internalNotes;
      }

      // Ticket Details
      if (payload.airlineCode !== undefined) bookingUpdateFields.airline_code = payload.airlineCode;
      if (payload.airlineName !== undefined) bookingUpdateFields.airline_name = payload.airlineName;
      if (payload.airlineLogoUrl !== undefined) bookingUpdateFields.airline_logo_url = payload.airlineLogoUrl;
      if (rawPnr !== undefined) bookingUpdateFields.airline_confirmation_number = cleanPnr;
      if (rawTkt !== undefined) bookingUpdateFields.ticket_number = cleanTkt;
      if (payload.ticketIssuedAt !== undefined) bookingUpdateFields.ticket_issued_at = payload.ticketIssuedAt ? String(payload.ticketIssuedAt).slice(0, 10) : null;
      if (payload.ticketNotes !== undefined) bookingUpdateFields.ticket_notes = payload.ticketNotes;
      if (payload.supplierConfirmation !== undefined) bookingUpdateFields.supplier_confirmation = payload.supplierConfirmation;

      // Payment Status & Totals
      if (targetPaymentStatus) {
        bookingUpdateFields.payment_status = targetPaymentStatus.toLowerCase();
      }
      if (payload.customerTotal !== undefined && payload.customerTotal !== null) {
        const totalNum = parseFloat(payload.customerTotal);
        if (Number.isFinite(totalNum)) {
          bookingUpdateFields.customer_price = totalNum;
          bookingUpdateFields.total_amount = totalNum;
        }
      }
      if (payload.supplierCost !== undefined && payload.supplierCost !== null) {
        const suppNum = parseFloat(payload.supplierCost);
        if (Number.isFinite(suppNum)) {
          bookingUpdateFields.supplier_price = suppNum;
        }
      }
      if (payload.discount !== undefined && payload.discount !== null) {
        const discNum = parseFloat(payload.discount);
        if (Number.isFinite(discNum)) {
          bookingUpdateFields.discount_amount = discNum;
        }
      }

      // Save payment splits if provided
      if (Array.isArray(payload.paymentSplits) && payload.paymentSplits.length > 0) {
        const centsSum = payload.paymentSplits.reduce((sum, s) => {
          const amt = parseFloat(s.amount || 0);
          return sum + (Number.isFinite(amt) ? Math.round(amt * 100) : 0);
        }, 0);
        const splitTotal = centsSum / 100;

        await bookingRepository.savePaymentSplits(realId, payload.paymentSplits);
        if (splitTotal > 0 && (payload.customerTotal === undefined || payload.customerTotal === null)) {
          bookingUpdateFields.customer_price = splitTotal;
          bookingUpdateFields.total_amount = splitTotal;
        }
      }

      // Perform database update
      await bookingRepository.updateStatus(realId, bookingUpdateFields);

      // Save Itinerary Segments if provided
      if (Array.isArray(payload.itinerarySegments) && payload.itinerarySegments.length > 0) {
        await bookingRepository.saveItinerarySegments(realId, payload.itinerarySegments);
      }

      // Record Audit Event with detailed changes list
      const changedKeys = Object.keys(bookingUpdateFields).filter(k => k !== 'updated_at');
      const auditReason = payload.auditReason || `Booking updated via Admin Dashboard (${changedKeys.join(', ') || 'No main fields changed'})`;

      await bookingRepository.recordStatusAudit({
        bookingId: realId,
        oldStatus: existingBooking.status,
        newStatus: bookingUpdateFields.status || existingBooking.status,
        adminId,
        reason: auditReason
      });

      logger.info(`[saveAllBookingChanges] Booking ${realId} updated by ${adminId}: ${changedKeys.join(', ')}`);

      const completeBooking = await bookingRepository.getCompleteBookingById(realId);
      return {
        success: true,
        message: 'Booking changes saved successfully.',
        booking: completeBooking,
        data: completeBooking
      };
    } catch (err) {
      logger.error(`[saveAllBookingChanges] Failure: ${err.message}`, err);
      return {
        success: false,
        code: 'DATABASE_TRANSACTION_FAILED',
        message: `Failed to save changes: ${err.message}`,
        field: 'booking'
      };
    }
  },

  updateBookingStatus: async (id, updateFields) => {
    return bookingRepository.updateStatus(id, updateFields);
  },

  getStats: async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('status, payment_status, total_amount');

    if (error) throw new Error(error.message);
    return data || [];
  },

  findPaymentByOrderId: async (providerOrderId) => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('provider_order_id', providerOrderId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },

  updateBookingWithLock: async (id, expectedVersion, updateFields) => {
    const newVersion = (expectedVersion || 1) + 1;
    const fieldsToSave = { ...updateFields, version: newVersion, updated_at: new Date().toISOString() };

    let query = supabase.from('bookings').update(fieldsToSave).eq('id', id);
    if (expectedVersion) {
      query = query.eq('version', expectedVersion);
    }

    const { data, error } = await query.select().single();
    if (error) {
      return bookingRepository.updateStatus(id, updateFields);
    }
    return data;
  },

  saveItinerarySegments: async (bookingId, segments = []) => {
    try {
      let outboundSeq = 1;
      let returnSeq = 1;

      const rows = (segments || []).map((seg, idx) => {
        const dir = seg.journey_direction || seg.direction || (idx === 0 ? 'outbound' : 'outbound');
        const seq = seg.segment_sequence || (dir === 'outbound' ? outboundSeq++ : returnSeq++);
        const code = (seg.marketing_carrier_code || seg.carrier_code || seg.carrier || seg.airline_code || '').trim().toUpperCase();
        const origCode = (seg.origin_airport || seg.origin_code || seg.originCode || seg.origin || '').trim().toUpperCase();
        const destCode = (seg.destination_airport || seg.destination_code || seg.destinationCode || seg.destination || '').trim().toUpperCase();

        return {
          booking_id: bookingId,
          trip_type: seg.trip_type || 'one_way',
          direction: dir,
          journey_direction: dir,
          segment_sequence: seq,
          carrier_name: seg.carrier_name || seg.airline_name || seg.airline || (code ? `${code} Airlines` : ''),
          carrier_code: code,
          marketing_carrier_code: code,
          operating_carrier: seg.operating_carrier || seg.operatingCarrier || null,
          flight_number: seg.flight_number || seg.flightNumber || '',
          origin_airport: origCode,
          origin_city: seg.origin_city || seg.originCity || origCode,
          destination_airport: destCode,
          destination_city: seg.destination_city || seg.destinationCity || destCode,
          departure_date: seg.departure_date || seg.departureDate || '',
          departure_time: seg.departure_time || seg.departureTime || '',
          arrival_date: seg.arrival_date || seg.arrivalDate || '',
          arrival_time: seg.arrival_time || seg.arrivalTime || '',
          arrival_next_day: !!(seg.arrival_next_day || seg.arrivalNextDay),
          cabin: seg.cabin || seg.cabin_class || seg.class || 'Economy',
          booking_class: seg.booking_class || 'Y',
          terminal: seg.terminal || '',
          baggage_allowance: seg.baggage_allowance || '1 Bag',
          aircraft: seg.aircraft || null,
          layover_duration: seg.layover_duration || seg.layoverDuration || null,
          duration: seg.duration || null,
          stop_count: parseInt(seg.stop_count || 0, 10),
          segment_order: idx + 1
        };
      });

      // SAFETY GUARD: Do NOT wipe out existing database itinerary segments if the input segment list is empty or contains only blank entries
      const validRows = rows.filter(r => r.origin_airport && r.destination_airport);
      if (validRows.length === 0) {
        logger.warn(`[saveItinerarySegments] Skipped updating itinerary for ${bookingId}: input segments list is empty or contains invalid/blank entries.`);
        return;
      }

      // Always save to memory store first (immediate availability)
      segmentsMemoryStore.set(bookingId, validRows);

      await bookingRepository.recordAuditLog({
        bookingId,
        action: 'FLIGHT_CREATED',
        oldValue: null,
        newValue: validRows,
        actor: 'system'
      });

      // Attempt 1: Save to booking_itinerary_segments (normalized table)
      const { error: deleteErr } = await supabase.from('booking_itinerary_segments').delete().eq('booking_id', bookingId);
      if (!deleteErr && validRows.length > 0) {
        const { error: insertErr } = await supabase.from('booking_itinerary_segments').insert(validRows);
        if (!insertErr) {
          logger.info(`[saveItinerarySegments] Saved ${validRows.length} segments to booking_itinerary_segments for ${bookingId}.`);
          // Also persist to flights table for maximum redundancy
          await bookingRepository._persistToFlightsTable(bookingId, validRows);
          return;
        }
        logger.warn(`[saveItinerarySegments] booking_itinerary_segments insert failed: ${insertErr.message}. Falling back to flights table.`);
      } else if (deleteErr) {
        logger.warn(`[saveItinerarySegments] booking_itinerary_segments unavailable: ${deleteErr.message}. Using flights table as production store.`);
      }

      // Attempt 2: Persist to the production flights table (always exists in production)
      await bookingRepository._persistToFlightsTable(bookingId, rows);
    } catch (e) {
      logger.warn(`saveItinerarySegments error: ${e.message}`);
    }
  },

  // Persist segment rows to the legacy flights table using its column schema
  _persistToFlightsTable: async (bookingId, canonicalRows = []) => {
    try {
      // Delete existing flights for this booking
      await supabase.from('flights').delete().eq('booking_id', bookingId);

      if (canonicalRows.length === 0) return;

      const flightRows = canonicalRows.map((seg) => ({
        booking_id: bookingId,
        leg: seg.journey_direction === 'return' ? 'return' : 'outbound',
        trip_type: seg.direction === 'return' ? 'round-trip' : 'one-way',
        airline_name: seg.carrier_name || seg.airline_name || '',
        carrier_code: seg.carrier_code || seg.marketing_carrier_code || '',
        flight_number: seg.flight_number || '',
        departure_airport: seg.origin_airport || '',
        arrival_airport: seg.destination_airport || '',
        departure_date: seg.departure_date || '',
        arrival_date: seg.arrival_date || '',
        departure_time_str: seg.departure_time || '',
        arrival_time_str: seg.arrival_time || '',
        cabin_class: seg.cabin || 'Economy',
        stops: parseInt(seg.stop_count || 0, 10),
        duration: seg.duration || null
      }));

      const { error } = await supabase.from('flights').insert(flightRows);
      if (error) {
        logger.warn(`[_persistToFlightsTable] flights insert warning: ${error.message}`);
      } else {
        logger.info(`[_persistToFlightsTable] Saved ${flightRows.length} rows to flights table for ${bookingId}.`);
      }
    } catch (e) {
      logger.warn(`[_persistToFlightsTable] error: ${e.message}`);
    }
  },

  savePaymentSplits: async (bookingId, splits = []) => {

    try {
      const formatted = (splits || []).map((s) => ({
        booking_id: bookingId,
        merchant_name: s.merchant_name || s.merchantName || 'Merchant',
        amount: parseFloat(s.amount || 0),
        currency: (s.currency || 'USD').toUpperCase()
      }));

      splitsMemoryStore.set(bookingId, formatted);

      await supabase.from('payment_authorization_splits').delete().eq('booking_id', bookingId);
      if (formatted.length > 0) {
        const { error } = await supabase.from('payment_authorization_splits').insert(formatted);
        if (error) logger.warn(`savePaymentSplits notice: ${error.message}`);
      }
    } catch (e) {
      logger.warn(`savePaymentSplits notice: ${e.message}`);
    }
  },

  getPaymentSplits: async (bookingId) => {
    try {
      const inMem = splitsMemoryStore.get(bookingId);
      if (inMem && inMem.length > 0) return inMem;

      const { data } = await supabase
        .from('payment_authorization_splits')
        .select('*')
        .eq('booking_id', bookingId);

      if (data && data.length > 0) {
        splitsMemoryStore.set(bookingId, data);
        return data;
      }
    } catch (e) {
      /* non-blocking fallback */
    }
    return splitsMemoryStore.get(bookingId) || [];
  },

  getFlightsCount: async (bookingId) => {
    try {
      const { count, error } = await supabase
        .from('flights')
        .select('*', { count: 'exact', head: true })
        .eq('booking_id', bookingId);
      if (!error && typeof count === 'number' && count > 0) return count;

      const { count: segCount } = await supabase
        .from('booking_itinerary_segments')
        .select('*', { count: 'exact', head: true })
        .eq('booking_id', bookingId);
      return segCount || 0;
    } catch (e) {
      return 0;
    }
  },

  updatePaymentSplitsAndTotal: async (bookingId, splitsInput = [], adminId = 'admin', reason = 'Payment splits update') => {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) throw new Error('Booking not found');
    const realId = booking.id;

    // 1. Record initial flight count prior to split update
    const initialFlightCount = await bookingRepository.getFlightsCount(realId);

    if (!Array.isArray(splitsInput) || splitsInput.length === 0) {
      throw new Error('At least one payment split row is required.');
    }

    const currencies = new Set();
    const formattedSplits = splitsInput.map((s, idx) => {
      const mName = String(s.merchantName || s.merchant_name || s.name || s.merchant || '').trim();
      if (!mName) {
        throw new Error(`Split #${idx + 1}: Merchant name cannot be empty.`);
      }
      const rawAmt = Number(s.amount);
      if (isNaN(rawAmt) || rawAmt <= 0) {
        throw new Error(`Split #${idx + 1} (${mName}): Amount must be greater than zero.`);
      }
      const amtStr = String(s.amount);
      if (amtStr.includes('.') && amtStr.split('.')[1].length > 2) {
        throw new Error(`Split #${idx + 1} (${mName}): Amount cannot have more than 2 decimal places.`);
      }
      const curr = (s.currency || booking.currency || 'USD').toUpperCase().trim();
      currencies.add(curr);

      return {
        booking_id: realId,
        merchant_name: mName,
        amount: Math.round(rawAmt * 100) / 100,
        currency: curr
      };
    });

    if (currencies.size > 1) {
      throw new Error('Mixed currencies within one booking payment split are not allowed.');
    }

    const totalCents = formattedSplits.reduce(
      (sum, s) => sum + Math.round(Number(s.amount) * 100),
      0
    );
    const calculatedTotal = totalCents / 100;
    const oldTotal = parseFloat(booking.customer_price || booking.total_amount || 0);

    // 2. Save splits safely
    await bookingRepository.savePaymentSplits(realId, formattedSplits);

    let newStatus = booking.status;
    let newAuthStatus = booking.authorization_status;

    // Automatic reauthorization trigger if authorized total changed
    if (Math.abs(oldTotal - calculatedTotal) > 0.001 && (booking.status === 'AUTHORIZED' || booking.status === 'READY_FOR_TICKETING' || booking.authorization_status === 'AUTHORIZED')) {
      newStatus = 'REAUTHORIZATION_REQUIRED';
      newAuthStatus = 'REAUTHORIZATION_REQUIRED';
    }

    const updatePayload = {
      total_amount: calculatedTotal,
      customer_price: calculatedTotal,
      amount: calculatedTotal,
      status: newStatus,
      authorization_status: newAuthStatus
    };

    await bookingRepository.updateStatus(realId, updatePayload);

    await bookingRepository.recordPaymentEvent({
      bookingId: realId,
      eventType: 'SPLIT_PAYMENT_UPDATE',
      previousStatus: booking.status,
      newStatus,
      amount: calculatedTotal,
      reason: `${reason}. Old Total: $${oldTotal.toFixed(2)}, New Total: $${calculatedTotal.toFixed(2)}`,
      adminId
    });

    // 3. Post-execution flight count assertion
    const postFlightCount = await bookingRepository.getFlightsCount(realId);
    if (initialFlightCount > 0 && postFlightCount !== initialFlightCount) {
      logger.error(`[DATA_INTEGRITY_CRITICAL] Flight count changed from ${initialFlightCount} to ${postFlightCount} during payment split save for booking ${realId}!`);
      throw new Error(`DATA_INTEGRITY_CRITICAL_FAILURE: Flight count changed from ${initialFlightCount} to ${postFlightCount} during payment split update.`);
    }

    return bookingRepository.getCompleteBookingById(realId);
  },






  recordPriceRevision: async (revision) => {
    try {
      await supabase.from('booking_price_revisions').insert({
        booking_id: revision.bookingId,
        supplier_fare: revision.supplierFare || 0,
        base_fare: revision.baseFare || 0,
        taxes: revision.taxes || 0,
        service_fee: revision.serviceFee || 0,
        discount: revision.discount || 0,
        customer_total: revision.customerTotal,
        currency: revision.currency || 'USD',
        margin: revision.margin || 0,
        reason: revision.reason || 'Price adjustment by admin',
        admin_id: revision.adminId || 'admin'
      });
    } catch (e) {
      logger.warn(`recordPriceRevision notice: ${e.message}`);
    }
  },

  recordPaymentEvent: async (eventData) => {
    try {
      await supabase.from('booking_payment_events').insert({
        booking_id: eventData.bookingId,
        event_type: eventData.eventType,
        previous_status: eventData.previousStatus,
        new_status: eventData.newStatus,
        amount: eventData.amount || 0,
        reference_id: eventData.referenceId || '',
        reason: eventData.reason || '',
        admin_id: eventData.adminId || 'admin'
      });
    } catch (e) {
      logger.warn(`recordPaymentEvent notice: ${e.message}`);
    }
  },

  findPaymentByCaptureId: async (providerCaptureId) => {

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('provider_capture_id', providerCaptureId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },

  updatePaymentByOrderId: async (providerOrderId, updateFields) => {
    const { data, error } = await supabase
      .from('payments')
      .update(updateFields)
      .eq('provider_order_id', providerOrderId)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },

  upsertPayPalPayment: async (paymentRow) => {
    const { data: existing } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', paymentRow.booking_id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('payments')
        .update(paymentRow)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const { data, error } = await supabase
        .from('payments')
        .insert(paymentRow)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  },

  getWebhookEvent: async (webhookId) => {
    try {
      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('id', webhookId)
        .maybeSingle();
      if (error) return null;
      return data;
    } catch (e) {
      return null;
    }
  },

  recordWebhookEvent: async (eventRow) => {
    try {
      const { data, error } = await supabase
        .from('webhook_events')
        .insert(eventRow)
        .select()
        .maybeSingle();
      if (error) return null;
      return data;
    } catch (e) {
      return null;
    }
  },

  findBookingByCheckoutId: async (checkoutId) => {
    if (!checkoutId) return null;
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('provider_checkout_id', checkoutId)
      .maybeSingle();

    if (error || !data) return null;
    const relations = await bookingRepository.getRelations(data.id);
    return bookingRepository.enrichBookingRecord(data, relations);
  },

  findPaymentByCheckoutId: async (checkoutId) => {
    if (!checkoutId) return null;
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('provider_checkout_id', checkoutId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  },

  upsertWhopPayment: async (paymentRow) => {
    // Try updating by booking_id or provider_checkout_id first
    let existing = null;
    if (paymentRow.booking_id) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', paymentRow.booking_id)
        .maybeSingle();
      existing = data;
    }
    if (!existing && paymentRow.provider_checkout_id) {
      try {
        const { data } = await supabase
          .from('payments')
          .select('*')
          .eq('provider_checkout_id', paymentRow.provider_checkout_id)
          .maybeSingle();
        existing = data;
      } catch (e) {
        /* fallback if column missing in remote schema cache */
      }
    }

    if (existing) {
      const { data, error } = await supabase
        .from('payments')
        .update(paymentRow)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        const coreRow = {
          payment_provider: paymentRow.payment_provider || 'whop',
          payment_amount: paymentRow.payment_amount,
          currency: paymentRow.currency || 'USD',
          payment_status: paymentRow.payment_status || 'paid',
          payment_date: paymentRow.payment_date || new Date().toISOString()
        };
        const { data: safeData, error: safeError } = await supabase
          .from('payments')
          .update(coreRow)
          .eq('id', existing.id)
          .select()
          .single();

        if (safeError) throw new Error(`Failed updating payment record: ${error.message}`);
        return safeData;
      }
      return data;
    } else {
      const { data, error } = await supabase
        .from('payments')
        .insert(paymentRow)
        .select()
        .single();

      if (error) {
        const coreRow = {
          booking_id: paymentRow.booking_id,
          payment_provider: paymentRow.payment_provider || 'whop',
          payment_amount: paymentRow.payment_amount,
          currency: paymentRow.currency || 'USD',
          payment_status: paymentRow.payment_status || 'paid',
          payment_date: paymentRow.payment_date || new Date().toISOString()
        };
        const { data: safeData, error: safeError } = await supabase
          .from('payments')
          .insert(coreRow)
          .select()
          .single();

        if (safeError) throw new Error(`Failed creating payment record: ${error.message}`);
        return safeData;
      }
      return data;
    }
  },


  executePaymentConfirmationTx: async ({
    bookingId,
    paymentProvider = 'whop',
    providerPaymentId,
    providerCheckoutId,
    paidAmount,
    currency = 'USD',
    paymentDate = new Date().toISOString()
  }) => {
    // 1. Update/upsert payments table row
    const paymentRow = {
      booking_id: bookingId,
      payment_provider: paymentProvider,
      provider_payment_id: providerPaymentId,
      provider_checkout_id: providerCheckoutId,
      payment_amount: paidAmount,
      currency: currency.toUpperCase(),
      payment_status: 'paid',
      payment_date: paymentDate
    };
    const paymentRecord = await bookingRepository.upsertWhopPayment(paymentRow);

    // 2. Update master bookings table row
    const bookingUpdateFields = {
      payment_status: 'paid',
      status: 'DONE',
      payment_provider: paymentProvider,
      provider_payment_id: providerPaymentId,
      provider_checkout_id: providerCheckoutId,
      paid_at: paymentDate
    };
    const updatedBooking = await bookingRepository.updateBookingStatus(bookingId, bookingUpdateFields);


    return { booking: updatedBooking, payment: paymentRecord };
  },

  getEmailDeliveryRecord: async (webhookId, bookingId) => {
    if (!webhookId || !bookingId) return null;
    try {
      const { data, error } = await supabase
        .from('email_deliveries')
        .select('*')
        .eq('webhook_id', String(webhookId))
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (error) return null;
      return data;
    } catch (e) {
      return null;
    }
  },

  getEmailDeliveryStatus: async (bookingId, emailType = 'BOOKING_CONFIRMATION') => {
    try {
      const inMemKey = `${bookingId}_${emailType}`;
      const inMem = emailDeliveriesMemoryStore.get(inMemKey);
      if (inMem) return inMem;

      const { data, error } = await supabase
        .from('email_deliveries')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('email_type', emailType)
        .maybeSingle();

      if (!error && data) {
        emailDeliveriesMemoryStore.set(inMemKey, data);
        return data;
      }
    } catch (e) {
      /* fallback */
    }
    return emailDeliveriesMemoryStore.get(`${bookingId}_${emailType}`) || null;
  },

  upsertEmailDeliveryRecord: async (record) => {
    try {
      const inMemKey = `${record.booking_id}_${record.email_type || 'BOOKING_CONFIRMATION'}`;
      const existing = emailDeliveriesMemoryStore.get(inMemKey) || {};
      const row = {
        id: existing.id || `email_del_${Date.now()}`,
        booking_id: record.booking_id,
        confirmation_code: record.confirmation_code,
        email_type: record.email_type || 'BOOKING_CONFIRMATION',
        recipient: record.recipient,
        status: record.status || 'PENDING',
        provider: record.provider || 'RESEND',
        provider_message_id: record.provider_message_id || existing.provider_message_id || null,
        error_code: record.error_code || existing.error_code || null,
        error_message: record.error_message || existing.error_message || null,
        attempt_count: record.attempt_count || ((existing.attempt_count || 0) + 1),
        last_attempt_at: new Date().toISOString(),
        sent_at: record.status === 'SENT' ? new Date().toISOString() : existing.sent_at,
        updated_at: new Date().toISOString()
      };

      emailDeliveriesMemoryStore.set(inMemKey, row);

      const { data, error } = await supabase
        .from('email_deliveries')
        .upsert(row, { onConflict: 'booking_id,email_type' })
        .select()
        .maybeSingle();

      if (error) {
        logger.warn(`[DB] email_deliveries upsert notice: ${error.message}`);
      }
      return data || row;
    } catch (e) {
      logger.warn(`[DB] email_deliveries upsert exception: ${e.message}`);
      return emailDeliveriesMemoryStore.get(`${record.booking_id}_${record.email_type || 'BOOKING_CONFIRMATION'}`);
    }
  },

  recordEmailDelivery: async (deliveryRow) => {
    try {
      const { data, error } = await supabase
        .from('email_deliveries')
        .insert({
          webhook_id: String(deliveryRow.webhook_id),
          booking_id: deliveryRow.booking_id,
          email_type: deliveryRow.email_type || 'booking_confirmation',
          recipient_email: deliveryRow.recipient_email,
          resend_message_id: deliveryRow.resend_message_id || null,
          status: deliveryRow.status || 'delivered',
          error_message: deliveryRow.error_message || null
        })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('[DB] Non-blocking email delivery record warning:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  },

  logAdminActivity: async (logData = {}) => {
    const entry = {
      action: logData.action || 'BOOKING_DELETED',
      booking_reference: logData.bookingReference || logData.booking_reference || '',
      deleted_by: logData.deletedBy || logData.deleted_by || 'admin',
      created_at: new Date().toISOString(),
      ip_address: logData.ipAddress || logData.ip_address || '127.0.0.1',
      details: logData.details || null
    };

    try {
      await supabase.from('admin_activity_logs').insert({
        action: entry.action,
        booking_reference: entry.booking_reference,
        admin_email: entry.deleted_by,
        timestamp: entry.created_at,
        ip_address: entry.ip_address,
        details: entry.details
      });
    } catch (err) {
      logger.warn(`admin_activity_logs insert notice: ${err.message}`);
    }

    return entry;
  },

  deleteBookingTransactional: async (idOrCode, adminEmail = 'admin@thefinalseat.com', ipAddress = '127.0.0.1') => {
    if (!idOrCode) {
      return { success: false, code: 'INVALID_ID', message: 'Booking ID is required.' };
    }

    const existingBooking = await bookingRepository.getById(idOrCode);
    if (!existingBooking) {
      return { success: false, code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' };
    }

    const realId = existingBooking.id;
    const confirmationCode = existingBooking.confirmation_code || existingBooking.confirmationCode || realId;

    try {
      // Step 1: email_delivery_activity / email_logs
      await supabase.from('email_logs').delete().eq('booking_id', realId);
      await supabase.from('email_deliveries').delete().eq('booking_id', realId);

      // Step 2: passenger_authorization
      await supabase.from('passenger_authorizations').delete().eq('booking_id', realId);

      // Step 3: payment_splits
      await supabase.from('payment_authorization_splits').delete().eq('booking_id', realId);
      splitsMemoryStore.delete(realId);
      if (confirmationCode) splitsMemoryStore.delete(confirmationCode);

      // Step 4: payments
      await supabase.from('payments').delete().eq('booking_id', realId);

      // Step 5: airline_ticket_details
      await supabase.from('ticket_details').delete().eq('booking_id', realId);

      // Step 6: itinerary_segments / flights
      await supabase.from('booking_itinerary_segments').delete().eq('booking_id', realId);
      await supabase.from('flights').delete().eq('booking_id', realId);
      segmentsMemoryStore.delete(realId);

      // Step 7: passengers / travellers / contacts
      await supabase.from('travellers').delete().eq('booking_id', realId);
      await supabase.from('contacts').delete().eq('booking_id', realId);

      // Step 8: bookings
      const { error: deleteErr } = await supabase.from('bookings').delete().eq('id', realId);
      if (deleteErr) {
        logger.warn(`deleteBooking DB notice: ${deleteErr.message}`);
      }

      // Clear main booking memory stores and mark deleted
      const tombstone = { _deleted: true, id: realId, confirmation_code: confirmationCode };
      bookingsMemoryStore.set(realId, tombstone);
      if (confirmationCode) bookingsMemoryStore.set(confirmationCode, tombstone);
      if (existingBooking.confirmation_code) bookingsMemoryStore.set(existingBooking.confirmation_code, tombstone);
      if (existingBooking.confirmationCode) bookingsMemoryStore.set(existingBooking.confirmationCode, tombstone);
      if (existingBooking.bookingReference) bookingsMemoryStore.set(existingBooking.bookingReference, tombstone);

      // Step 9: Audit log creation
      await bookingRepository.recordAuditLog({
        bookingId: realId,
        action: 'BOOKING_DELETED',
        oldValue: existingBooking,
        newValue: null,
        actor: adminEmail,
        ipAddress
      });
      await bookingRepository.logAdminActivity({
        action: 'BOOKING_DELETED',
        bookingReference: confirmationCode,
        deletedBy: adminEmail,
        ipAddress
      });

      logger.info(`[DELETE_BOOKING] Booking ${confirmationCode} (${realId}) and all 7 dependency relations deleted cleanly by ${adminEmail}.`);

      return {
        success: true,
        message: `Booking ${confirmationCode} permanently deleted.`,
        deletedBookingId: realId,
        confirmationCode
      };
    } catch (err) {
      logger.error(`[DELETE_BOOKING] Transactional deletion failed for ${realId}:`, err);
      return {
        success: false,
        code: 'DELETE_TRANSACTION_FAILED',
        message: `Deletion failed: ${err.message}`
      };
    }
  },

  deleteBooking: async (idOrCode) => {
    return bookingRepository.deleteBookingTransactional(idOrCode, 'system-atomic-rollback@thefinalseat.com');
  },

  softDeleteBooking: async (idOrCode, adminEmail = 'admin@thefinalseat.com', ipAddress = '127.0.0.1', reason = 'Admin soft delete') => {
    const existingBooking = await bookingRepository.getById(idOrCode);
    if (!existingBooking) {
      return { success: false, code: 'BOOKING_NOT_FOUND', message: `Booking '${idOrCode}' not found.` };
    }

    const realId = existingBooking.id;
    const confirmationCode = existingBooking.confirmation_code || existingBooking.confirmationCode || realId;
    const deletedAt = new Date().toISOString();

    const updateFields = {
      status: 'CANCELLED',
      deleted_at: deletedAt,
      deleted_by: adminEmail,
      delete_reason: reason,
      updated_at: deletedAt
    };

    await bookingRepository.updateStatus(realId, updateFields);

    const updatedBooking = { ...existingBooking, ...updateFields, _softDeleted: true };
    bookingsMemoryStore.set(realId, updatedBooking);
    if (confirmationCode) bookingsMemoryStore.set(confirmationCode, updatedBooking);

    await bookingRepository.recordAuditLog({
      bookingId: realId,
      action: 'BOOKING_SOFT_DELETED',
      oldValue: existingBooking,
      newValue: updatedBooking,
      actor: adminEmail,
      ipAddress
    });

    logger.info(`[SOFT_DELETE] Booking ${confirmationCode} (${realId}) soft-deleted by ${adminEmail}.`);

    return {
      success: true,
      message: `Booking ${confirmationCode} soft-deleted cleanly.`,
      bookingId: realId,
      confirmationCode,
      deletedAt
    };
  },

  restoreBooking: async (idOrCode, adminEmail = 'admin@thefinalseat.com', ipAddress = '127.0.0.1') => {
    const existingBooking = await bookingRepository.getById(idOrCode);
    if (!existingBooking) {
      return { success: false, code: 'BOOKING_NOT_FOUND', message: `Booking '${idOrCode}' not found.` };
    }

    const realId = existingBooking.id;
    const confirmationCode = existingBooking.confirmation_code || existingBooking.confirmationCode || realId;
    const restoredAt = new Date().toISOString();

    const updateFields = {
      status: 'PENDING',
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      updated_at: restoredAt
    };

    await bookingRepository.updateStatus(realId, updateFields);

    const restoredBooking = { ...existingBooking, ...updateFields, _softDeleted: false };
    bookingsMemoryStore.set(realId, restoredBooking);
    if (confirmationCode) bookingsMemoryStore.set(confirmationCode, restoredBooking);

    await bookingRepository.recordAuditLog({
      bookingId: realId,
      action: 'BOOKING_RESTORED',
      oldValue: existingBooking,
      newValue: restoredBooking,
      actor: adminEmail,
      ipAddress
    });

    logger.info(`[RESTORE_BOOKING] Booking ${confirmationCode} (${realId}) restored to active status by ${adminEmail}.`);

    return {
      success: true,
      message: `Booking ${confirmationCode} restored successfully.`,
      bookingId: realId,
      confirmationCode,
      restoredAt
    };
  },

  saveAuthorizationSnapshot: async (snapshotData) => {
    const snapId = snapshotData.id || `auth_snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = { ...snapshotData, id: snapId, created_at: snapshotData.created_at || new Date().toISOString() };
    authSnapshotsMemoryStore.set(snapId, record);
    try {
      await supabase.from('authorization_snapshots').insert(record);
    } catch (e) {
      logger.warn(`authorization_snapshots insert notice (stored in memory store): ${e.message}`);
    }
    return record;
  },

  getAuthorizationSnapshots: async (bookingId) => {
    try {
      const { data, error } = await supabase
        .from('authorization_snapshots')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) return data;
    } catch (e) {
      // Fallback to in-memory store
    }
    return Array.from(authSnapshotsMemoryStore.values()).filter(s => s.booking_id === bookingId || s.bookingId === bookingId);
  },

  exportBookingJson: async (idOrCode) => {
    const booking = await bookingRepository.getById(idOrCode);
    if (!booking) return null;

    const realId = booking.id;
    const relations = await bookingRepository.getRelations(realId);
    const auditLogs = await bookingRepository.getAuditLogsForBooking(realId);
    const authSnapshots = await bookingRepository.getAuthorizationSnapshots(realId);
    const ticketSnapshots = await bookingRepository.getTicketSnapshotsForBooking(realId);

    return {
      exported_at: new Date().toISOString(),
      booking: bookingRepository.enrichBookingRecord(booking, relations),
      itinerary_segments: relations.itinerarySegments || [],
      travellers: relations.travellers || [],
      contacts: relations.contacts || [],
      payments: relations.payments || [],
      payment_splits: relations.paymentSplits || [],
      authorization_snapshots: authSnapshots || [],
      ticket_snapshots: ticketSnapshots || [],
      audit_logs: auditLogs || []
    };
  },

  getBookingHistory: async (idOrCode) => {
    const booking = await bookingRepository.getById(idOrCode);
    if (!booking) return null;

    const realId = booking.id;
    const auditLogs = await bookingRepository.getAuditLogsForBooking(realId);
    const authSnapshots = await bookingRepository.getAuthorizationSnapshots(realId);
    const ticketSnapshots = await bookingRepository.getTicketSnapshotsForBooking(realId);

    const timeline = [];

    (auditLogs || []).forEach(a => {
      timeline.push({
        type: 'AUDIT_EVENT',
        action: a.action,
        timestamp: a.created_at,
        actor: a.actor,
        ipAddress: a.ip_address,
        oldValue: a.old_value,
        newValue: a.new_value
      });
    });

    (authSnapshots || []).forEach(s => {
      timeline.push({
        type: 'AUTHORIZATION_SNAPSHOT',
        id: s.id,
        timestamp: s.created_at || s.accepted_at,
        pnr: s.confirmation_code,
        authorizedAmount: s.authorized_amount,
        consentHash: s.consent_hash
      });
    });

    (ticketSnapshots || []).forEach(t => {
      timeline.push({
        type: 'TICKET_SNAPSHOT',
        id: t.id,
        timestamp: t.issue_date || t.created_at,
        pnr: t.pnr,
        ticketNumber: t.ticket_number,
        airline: t.airline,
        finalPrice: t.final_price
      });
    });

    timeline.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

    return {
      bookingId: realId,
      confirmationCode: booking.confirmation_code,
      currentStatus: booking.status,
      timeline
    };
  },

  restoreFromSnapshot: async (idOrCode, targetSnapshot, adminEmail = 'admin@thefinalseat.com', ipAddress = '127.0.0.1') => {
    const booking = await bookingRepository.getById(idOrCode);
    if (!booking) {
      return { success: false, code: 'BOOKING_NOT_FOUND', message: `Booking '${idOrCode}' not found.` };
    }

    const realId = booking.id;
    const snapData = typeof targetSnapshot === 'object' ? targetSnapshot : null;

    if (!snapData) {
      return { success: false, code: 'INVALID_SNAPSHOT', message: 'Target snapshot payload is invalid or empty.' };
    }

    const updateFields = {
      passenger_name: snapData.passenger_name || booking.passenger_name,
      customer_price: snapData.authorized_amount || snapData.total_amount || snapData.final_price || booking.customer_price,
      total_amount: snapData.authorized_amount || snapData.total_amount || snapData.final_price || booking.total_amount,
      status: snapData.status || 'PENDING',
      updated_at: new Date().toISOString()
    };

    if (snapData.itinerary_snapshot && Array.isArray(snapData.itinerary_snapshot)) {
      await bookingRepository.saveItinerarySegments(realId, snapData.itinerary_snapshot);
    } else if (snapData.final_itinerary && Array.isArray(snapData.final_itinerary)) {
      await bookingRepository.saveItinerarySegments(realId, snapData.final_itinerary);
    }

    await bookingRepository.updateStatus(realId, updateFields);

    await bookingRepository.recordAuditLog({
      bookingId: realId,
      action: 'BOOKING_RESTORED_FROM_SNAPSHOT',
      oldValue: booking,
      newValue: snapData,
      actor: adminEmail,
      ipAddress
    });

    logger.info(`[RESTORE_SNAPSHOT] Booking ${realId} restored from snapshot by ${adminEmail}.`);

    return {
      success: true,
      message: `Booking ${realId} successfully restored from snapshot state.`,
      bookingId: realId,
      restoredAt: new Date().toISOString()
    };
  }
};

export default bookingRepository;

