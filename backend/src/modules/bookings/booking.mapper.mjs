import { itineraryMapper } from '../itineraries/itinerary.mapper.mjs';

export const bookingMapper = {
  toDatabaseInsert: (bookingReference, payload) => {
    const rawCustomerPrice = parseFloat(payload.customer_price || payload.displayedWebsitePrice || 0);
    const rawSupplierPrice = parseFloat(payload.supplier_price || payload.originalApiPrice || rawCustomerPrice);
    const isMock = !!payload.isMock;
    const discountPercent = isMock ? 0 : (parseFloat(payload.discount_percent) || 10);
    const discountAmount = isMock ? 0 : (parseFloat(payload.discount_amount) || Math.max(0, rawSupplierPrice - rawCustomerPrice));

    return {
      confirmation_code: bookingReference,
      status: payload.status || 'PENDING',
      payment_status: payload.paymentStatus || 'pending',  // default pending — NEVER 'paid' before capture
      total_amount: rawCustomerPrice,
      customer_price: rawCustomerPrice,
      supplier_price: rawSupplierPrice,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      price_checked_at: new Date().toISOString(),
      currency: (payload.currency || 'USD').toUpperCase(),
      passenger_name: payload.customerName,
      email: payload.email,
      phone: payload.phone,
      original_api_price: rawSupplierPrice,
    };
  },

  toCanonicalModel: (booking, travellers = [], contacts = [], flights = [], payments = []) => {
    if (!booking) return null;

    const contact = contacts[0] || {};
    const paymentRecord = payments[0] || {};
    const itinerary = itineraryMapper.toDomainModel(flights);

    const hasCustomerPrice = (booking.customer_price !== undefined && booking.customer_price !== null) || (booking.total_amount !== undefined && booking.total_amount !== null);
    const hasSupplierPrice = (booking.supplier_price !== undefined && booking.supplier_price !== null) || (booking.original_api_price !== undefined && booking.original_api_price !== null);

    const customerTotal = hasCustomerPrice ? (parseFloat(booking.customer_price ?? booking.total_amount) || 0) : null;
    const supplierCost = hasSupplierPrice ? (parseFloat(booking.supplier_price ?? booking.original_api_price) || 0) : customerTotal;
    const discount = booking.discount_amount !== undefined && booking.discount_amount !== null ? parseFloat(booking.discount_amount) : (customerTotal !== null && supplierCost !== null ? Math.max(0, supplierCost - customerTotal) : null);

    const baseFare = booking.base_fare !== undefined && booking.base_fare !== null ? parseFloat(booking.base_fare) : supplierCost;
    const taxes = booking.taxes !== undefined && booking.taxes !== null ? parseFloat(booking.taxes) : 45.00;
    const serviceFee = booking.service_fee !== undefined && booking.service_fee !== null ? parseFloat(booking.service_fee) : 15.00;
    const margin = (customerTotal !== null && supplierCost !== null) ? (customerTotal - supplierCost) : null;
    const currency = (booking.currency || 'USD').toUpperCase();

    const authorizedAmount = booking.authorized_amount !== undefined && booking.authorized_amount !== null
      ? parseFloat(booking.authorized_amount)
      : (booking.authorization?.authorizedAmount ?? customerTotal);

    const isPaid = (booking.payment_status || '').toLowerCase() === 'paid' || (paymentRecord.payment_status || '').toLowerCase() === 'paid';
    const isRefunded = (booking.payment_status || '').toLowerCase() === 'refunded' || (paymentRecord.payment_status || '').toLowerCase() === 'refunded';

    const paidAmount = booking.paid_amount !== undefined && booking.paid_amount !== null
      ? parseFloat(booking.paid_amount)
      : (paymentRecord.payment_amount ? parseFloat(paymentRecord.payment_amount) : (isPaid ? customerTotal : null));

    const refundedAmount = booking.refund_amount !== undefined && booking.refund_amount !== null
      ? parseFloat(booking.refund_amount)
      : (paymentRecord.refund_amount ? parseFloat(paymentRecord.refund_amount) : (isRefunded ? customerTotal : 0));

    const pricing = {
      baseFare,
      taxes,
      serviceFee,
      discount,
      customerTotal,
      supplierCost,
      margin,
      currency,
      total: customerTotal ?? 0,
      customerPrice: customerTotal ?? 0,
      supplierPrice: supplierCost ?? 0,
      originalApiPrice: supplierCost ?? 0,
      discountPercent: typeof booking.discount_percent === 'number' ? booking.discount_percent : 10,
      discountAmount: discount ?? 0,
      priceCheckedAt: booking.price_checked_at || booking.created_at
    };

    const authorization = {
      authorizedAmount,
      status: booking.authorization_status || (booking.authorization_email_sent_at ? 'AWAITING_PASSENGER' : 'NOT_SENT'),
      emailSentAt: booking.authorization_email_sent_at || null,
      token: booking.authorization_token || null
    };

    const paymentModel = {
      provider: paymentRecord.payment_provider || booking.payment_provider || 'stripe',
      stripeSessionId: paymentRecord.stripe_session_id || null,
      stripePaymentId: paymentRecord.stripe_payment_id || null,
      paymentAmount: parseFloat(paymentRecord.payment_amount || customerTotal || 0) || 0,
      paymentStatus: (booking.payment_status || paymentRecord.payment_status || 'PENDING').toUpperCase(),
      status: (booking.payment_status || paymentRecord.payment_status || 'PENDING').toUpperCase(),
      paymentDate: paymentRecord.payment_date || booking.paid_at || null,
      paidAmount,
      refundedAmount
    };

    return {
      id: booking.id,
      confirmationCode: booking.confirmation_code,
      bookingReference: booking.confirmation_code,
      customer: {
        name: booking.passenger_name,
        email: booking.email,
        phone: booking.phone,
        contactDetail: contact
      },
      passenger_name: booking.passenger_name,
      email: booking.email,
      phone: booking.phone,
      amount: customerTotal ?? 0,
      currency: booking.currency || 'USD',
      
      travellers: travellers.map(t => ({
        id: t.id,
        role: t.role,
        title: t.title,
        firstName: t.first_name,
        middleName: t.middle_name,
        lastName: t.last_name,
        dateOfBirth: t.date_of_birth,
        gender: t.gender,
        nationality: t.nationality,
        passportNumber: t.passport_number,
        passportExpiry: t.passport_expiry
      })),
      traveller_details: travellers,

      itinerary,
      flight_details: itinerary,
      
      pricing,
      authorization,
      payment: paymentModel,
      payment_details: paymentRecord,
      
      bookingStatus: booking.status,
      status: booking.status,
      paymentStatus: booking.payment_status,
      internalNotes: booking.internal_notes,
      airline_code: booking.airline_code,
      airline_name: booking.airline_name,
      airline_logo_url: booking.airline_logo_url,
      airline_confirmation_number: booking.airline_confirmation_number,
      airline_pnr: booking.airline_confirmation_number,
      pnr: booking.airline_confirmation_number,
      ticket_number: booking.ticket_number,
      ticket_issued_at: booking.ticket_issued_at,
      ticket_notes: booking.ticket_notes,
      supplier_confirmation: booking.supplier_confirmation,
      airlineCode: booking.airline_code,
      airlineName: booking.airline_name,
      airlineLogoUrl: booking.airline_logo_url,
      airlineConfirmationNumber: booking.airline_confirmation_number,
      ticketNumber: booking.ticket_number,
      ticketIssuedAt: booking.ticket_issued_at,
      ticketNotes: booking.ticket_notes,
      supplierConfirmation: booking.supplier_confirmation,
      createdAt: booking.created_at,
      updatedAt: booking.updated_at,
      created_at: booking.created_at,
      updated_at: booking.updated_at
    };
  },

  toSummaryList: (bookings) => {
    return bookings.map(b => {
      const customerPrice = parseFloat(b.customer_price || b.total_amount) || 0;
      const supplierPrice = parseFloat(b.supplier_price || b.original_api_price || customerPrice) || 0;
      const discountAmount = parseFloat(b.discount_amount) || Math.max(0, supplierPrice - customerPrice);
      const currency = (b.currency || 'USD').toUpperCase();
      return {
        id: b.id,
        confirmationCode: b.confirmation_code,
        bookingReference: b.confirmation_code,
        passenger_name: b.passenger_name,
        customerName: b.passenger_name,
        email: b.email,
        phone: b.phone,
        amount: customerPrice,
        customer_price: customerPrice,
        supplier_price: supplierPrice,
        discount_amount: discountAmount,
        discount_percent: typeof b.discount_percent === 'number' ? b.discount_percent : 10,
        total_amount: customerPrice,
        currency,
        status: b.status,
        bookingStatus: b.status,
        paymentStatus: b.payment_status,
        pricing: {
          baseFare: supplierPrice,
          taxes: 45.00,
          serviceFee: 15.00,
          discount: discountAmount,
          customerTotal: customerPrice,
          supplierCost: supplierPrice,
          margin: customerPrice - supplierPrice,
          currency
        },
        authorization: {
          authorizedAmount: customerPrice
        },
        payment: {
          paidAmount: (b.payment_status || '').toLowerCase() === 'paid' ? customerPrice : null,
          refundedAmount: (b.payment_status || '').toLowerCase() === 'refunded' ? customerPrice : 0
        },
        airline_code: b.airline_code,
        airline_name: b.airline_name,
        airline_logo_url: b.airline_logo_url,
        airline_confirmation_number: b.airline_confirmation_number,
        airline_pnr: b.airline_confirmation_number,
        pnr: b.airline_confirmation_number,
        ticket_number: b.ticket_number,
        ticket_issued_at: b.ticket_issued_at,
        ticket_notes: b.ticket_notes,
        supplier_confirmation: b.supplier_confirmation,
        airlineCode: b.airline_code,
        airlineName: b.airline_name,
        airlineLogoUrl: b.airline_logo_url,
        airlineConfirmationNumber: b.airline_confirmation_number,
        ticketNumber: b.ticket_number,
        ticketIssuedAt: b.ticket_issued_at,
        created_at: b.created_at,
        updated_at: b.updated_at
      };
    });
  }
};

export default bookingMapper;
