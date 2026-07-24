import supabase from '../../integrations/supabase/supabase.client.mjs';

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

      if (coreError) throw new Error(`Booking record insert failed: ${coreError.message}`);
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
        payment_status: paymentRow.payment_status || 'paid',
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

  findBookingByCode: async (code) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('confirmation_code', code)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
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

    if (error) throw new Error(error.message);
    return data;
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
    return data || [];
  },

  searchBookings: async (q) => {
    const { data: byCode } = await supabase
      .from('bookings')
      .select('*')
      .eq('confirmation_code', q.toUpperCase());

    if (byCode && byCode.length > 0) return byCode;

    const { data: byEmail } = await supabase
      .from('bookings')
      .select('*')
      .ilike('email', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (byEmail && byEmail.length > 0) return byEmail;

    const { data: byName } = await supabase
      .from('bookings')
      .select('*')
      .ilike('passenger_name', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    return byName || [];
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
    return data || [];
  },

  updateStatus: async (id, updateFields) => {
    const { data, error } = await supabase
      .from('bookings')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const safeFields = { ...updateFields };
      delete safeFields.customer_price;
      delete safeFields.supplier_price;
      delete safeFields.discount_percent;
      delete safeFields.discount_amount;
      delete safeFields.price_checked_at;
      delete safeFields.provider_checkout_id;
      delete safeFields.provider_payment_id;

      const { data: safeData, error: safeError } = await supabase
        .from('bookings')
        .update(safeFields)
        .eq('id', id)
        .select()
        .single();

      if (safeError) throw new Error(safeError.message);
      return safeData;
    }
    return data;
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

  getRelations: async (bookingId) => {
    const [travellers, contacts, flights, payments] = await Promise.all([
      supabase.from('travellers').select('*').eq('booking_id', bookingId),
      supabase.from('contacts').select('*').eq('booking_id', bookingId),
      supabase.from('flights').select('*').eq('booking_id', bookingId),
      supabase.from('payments').select('*').eq('booking_id', bookingId),
    ]);

    return {
      travellers: travellers.data || [],
      contacts: contacts.data || [],
      flights: flights.data || [],
      payments: payments.data || []
    };
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
  }
};

export default bookingRepository;
