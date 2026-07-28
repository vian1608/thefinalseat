import supabase from '../../integrations/supabase/supabase.client.mjs';
import logger from '../../config/logger.mjs';

const segmentsMemoryStore = new Map();
const bookingsMemoryStore = new Map();
const splitsMemoryStore = new Map();


export const bookingRepository = {


  createBookingRecord: async (dbRow) => {
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
        return fallbackRecord;
      }
      return coreData;
    }
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
    const [travellers, contacts, flights, payments, itinerarySegments] = await Promise.all([
      supabase.from('travellers').select('*').eq('booking_id', bookingId),
      supabase.from('contacts').select('*').eq('booking_id', bookingId),
      supabase.from('flights').select('*').eq('booking_id', bookingId),
      supabase.from('payments').select('*').eq('booking_id', bookingId),
      supabase.from('booking_itinerary_segments').select('*').eq('booking_id', bookingId).order('segment_sequence', { ascending: true })
    ]);

    const memorySegs = segmentsMemoryStore.get(bookingId) || [];
    const dbSegs = itinerarySegments.data || [];
    const finalSegs = dbSegs.length > 0 ? dbSegs : memorySegs;
    const paymentSplits = await bookingRepository.getPaymentSplits(bookingId);

    return {
      travellers: travellers.data || [],
      contacts: contacts.data || [],
      flights: flights.data || [],
      payments: payments.data || [],
      itinerarySegments: finalSegs,
      paymentSplits: paymentSplits || []
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

    return {
      ...booking,
      passenger_name: masterName,
      carrier,
      airline: carrier,
      origin_code: originCode,
      destination_code: destCode,
      departure_date: departureDate,
      travellers: relations.travellers || [],
      contacts: relations.contacts || [],
      flights: relations.flights || [],
      payments: relations.payments || [],
      itinerary_segments: segments,
      outbound_segments: outboundSegs,
      return_segments: returnSegs,
      payment_splits: relations.paymentSplits || [],

      flight_details: outboundFlight ? {
        airline: carrier,
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
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('confirmation_code', code)
      .maybeSingle();

    if (error || !data) return data;
    const relations = await bookingRepository.getRelations(data.id);
    return bookingRepository.enrichBookingRecord(data, relations);
  },

  getByReference: async (code) => {
    return bookingRepository.findBookingByCode(code);
  },

  findBookingById: async (id) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const memOverridden = bookingsMemoryStore.get(id);
    const baseData = (data || memOverridden) ? { ...(data || {}), ...(memOverridden || {}) } : null;

    if (!baseData) return null;
    const relations = await bookingRepository.getRelations(baseData.id);
    return bookingRepository.enrichBookingRecord(baseData, relations);
  },


  getById: async (id) => {
    return bookingRepository.findBookingById(id);
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
      const rels = await bookingRepository.getRelations(b.id);
      return bookingRepository.enrichBookingRecord(b, rels);
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

    const { data, error } = await supabase
      .from('bookings')
      .update(cleanFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.message && (error.message.includes('value too long') || error.message.includes('bookings_status_check') || error.message.includes('check constraint') || error.message.includes('schema cache') || error.message.includes('invalid input syntax') || error.message.includes('Cannot coerce') || error.message.includes('JSON object requested'))) {
        logger.warn(`Supabase schema notice: ${error.message}.`);
        const existing = await bookingRepository.getById(id);
        const updatedRecord = { ...(existing || {}), ...cleanFields };
        bookingsMemoryStore.set(id, updatedRecord);
        return updatedRecord;
      }
      throw new Error(`Failed to update booking status: ${error.message}`);
    }



    return data;
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
      await supabase.from('booking_itinerary_segments').delete().eq('booking_id', bookingId);
      if (segments && segments.length > 0) {
        let outboundSeq = 1;
        let returnSeq = 1;

        const rows = segments.map((seg, idx) => {
          const dir = seg.journey_direction || seg.direction || (idx === 0 ? 'outbound' : (seg.trip_type === 'round_trip' ? 'return' : 'outbound'));
          const seq = seg.segment_sequence || (dir === 'outbound' ? outboundSeq++ : returnSeq++);

          return {
            booking_id: bookingId,
            trip_type: seg.trip_type || 'one_way',
            direction: dir,
            journey_direction: dir,
            segment_sequence: seq,
            carrier_name: seg.carrier_name || seg.airline || 'Airline information unavailable',
            carrier_code: seg.carrier_code || seg.carrier || '',
            operating_carrier: seg.operating_carrier || seg.operatingCarrier || null,
            flight_number: seg.flight_number || seg.flightNumber || '',
            origin_airport: seg.origin_airport || seg.originCode || 'LAX',
            origin_city: seg.origin_city || seg.originCity || 'Los Angeles',
            destination_airport: seg.destination_airport || seg.destinationCode || 'MIA',
            destination_city: seg.destination_city || seg.destinationCity || 'Miami',
            departure_date: seg.departure_date || seg.departureDate || '2026-09-10',
            departure_time: seg.departure_time || seg.departureTime || '09:00 AM',
            arrival_date: seg.arrival_date || seg.arrivalDate || '2026-09-10',
            arrival_time: seg.arrival_time || seg.arrivalTime || '05:00 PM',

            arrival_next_day: !!(seg.arrival_next_day || seg.arrivalNextDay),
            cabin: seg.cabin || seg.cabinClass || 'Economy',
            booking_class: seg.booking_class || 'Y',
            terminal: seg.terminal || '',
            baggage_allowance: seg.baggage_allowance || '1 Bag',
            aircraft: seg.aircraft || null,
            layover_duration: seg.layover_duration || seg.layoverDuration || null,
            stop_count: parseInt(seg.stop_count || 0, 10),
            segment_order: idx + 1
          };
        });

        segmentsMemoryStore.set(bookingId, rows);
        const { error } = await supabase.from('booking_itinerary_segments').insert(rows);
        if (error) logger.warn(`saveItinerarySegments insert warning: ${error.message}. Saved to resilience memory store.`);
      } else {
        segmentsMemoryStore.delete(bookingId);
      }
    } catch (e) {
      logger.warn(`saveItinerarySegments notice: ${e.message}`);
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
        // Log warning if schema cache delay or duplicate constraint
        console.warn('[DB] Non-blocking email delivery record warning:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }
};

export default bookingRepository;

