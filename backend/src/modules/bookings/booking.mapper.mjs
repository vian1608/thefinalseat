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
      payment_status: payload.paymentStatus || 'paid',
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
    const payment = payments[0] || {};
    const itinerary = itineraryMapper.toDomainModel(flights);

    const customerPrice = parseFloat(booking.customer_price || booking.total_amount) || 0;
    const supplierPrice = parseFloat(booking.supplier_price || booking.original_api_price || customerPrice) || 0;
    const discountPercent = typeof booking.discount_percent === 'number' ? booking.discount_percent : 10;
    const discountAmount = parseFloat(booking.discount_amount) || Math.max(0, supplierPrice - customerPrice);

    const pricing = {
      total: customerPrice,
      customerPrice,
      supplierPrice,
      originalApiPrice: supplierPrice,
      discountPercent,
      discountAmount,
      currency: (booking.currency || 'USD').toUpperCase(),
      priceCheckedAt: booking.price_checked_at || booking.created_at,
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
      amount: customerPrice,
      currency: booking.currency,
      
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
      payment: {
        provider: payment.payment_provider || 'stripe',
        stripeSessionId: payment.stripe_session_id || null,
        stripePaymentId: payment.stripe_payment_id || null,
        paymentAmount: parseFloat(payment.payment_amount || customerPrice) || 0,
        paymentStatus: payment.payment_status || 'paid',
        paymentDate: payment.payment_date
      },
      payment_details: payment,
      
      bookingStatus: booking.status,
      status: booking.status,
      paymentStatus: booking.payment_status,
      internalNotes: booking.internal_notes,
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
        currency: b.currency,
        status: b.status,
        bookingStatus: b.status,
        paymentStatus: b.payment_status,
        created_at: b.created_at,
        updated_at: b.updated_at
      };
    });
  }
};

export default bookingMapper;
