const normalizeMoney = (value) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

const firstPresent = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

export const mapBookingToTwenty = (booking = {}) => {
  const confirmationCode = firstPresent(
    booking.confirmation_code,
    booking.confirmationCode,
    booking.booking_reference,
    booking.bookingReference,
  );

  if (!confirmationCode) {
    throw new Error('A booking confirmation code is required for Twenty synchronization.');
  }

  const primaryPassenger = booking.primaryPassenger || booking.passengers?.[0] || {};
  const contact = booking.contact || booking.contacts?.[0] || {};
  const pricing = booking.pricing || {};
  const totalAmount = normalizeMoney(firstPresent(
    pricing.customerTotal,
    pricing.customer_total,
    booking.customer_total,
    booking.total_amount,
    booking.amount,
  ));

  return {
    externalBookingId: String(firstPresent(booking.id, booking.booking_id, '')),
    bookingReference: String(confirmationCode),
    customerName: String(firstPresent(
      booking.customer_name,
      booking.customerName,
      primaryPassenger.fullName,
      `${primaryPassenger.first_name || primaryPassenger.firstName || ''} ${primaryPassenger.last_name || primaryPassenger.lastName || ''}`.trim(),
    ) || ''),
    customerEmail: String(firstPresent(
      booking.customer_email,
      booking.customerEmail,
      contact.email,
      primaryPassenger.email,
    ) || ''),
    customerPhone: String(firstPresent(
      booking.customer_phone,
      booking.customerPhone,
      contact.phone,
      primaryPassenger.phone,
    ) || ''),
    bookingStatus: String(firstPresent(booking.booking_status, booking.bookingStatus, booking.status, 'PENDING')).toUpperCase(),
    paymentStatus: String(firstPresent(booking.payment_status, booking.paymentStatus, 'PENDING')).toUpperCase(),
    authorizationStatus: String(firstPresent(booking.authorization_status, booking.authorizationStatus, 'NOT_SENT')).toUpperCase(),
    ticketingStatus: String(firstPresent(booking.ticketing_status, booking.ticketingStatus, 'NOT_TICKETED')).toUpperCase(),
    tripType: String(firstPresent(booking.trip_type, booking.tripType, 'ONE_WAY')).toUpperCase(),
    passengerCount: Number(firstPresent(booking.passenger_count, booking.passengerCount, booking.passengers?.length, 1)),
    customerTotal: totalAmount,
    currency: String(firstPresent(booking.currency, pricing.currency, 'USD')).toUpperCase(),
    supplierFare: normalizeMoney(firstPresent(pricing.supplierFare, pricing.supplier_fare, booking.supplier_fare)),
    taxesAndFees: normalizeMoney(firstPresent(pricing.taxesAndFees, pricing.taxes_and_fees, booking.taxes_and_fees)),
    agencyServiceFee: normalizeMoney(firstPresent(pricing.agencyMarkup, pricing.agency_markup, booking.agency_markup)),
    routeSummary: String(firstPresent(booking.route_summary, booking.routeSummary, booking.route, '')),
    carrierSummary: String(firstPresent(booking.carrier_summary, booking.carrierSummary, booking.carrier, '')),
    departureDate: firstPresent(booking.departure_date, booking.departureDate, null),
    returnDate: firstPresent(booking.return_date, booking.returnDate, null),
    internalNotes: String(firstPresent(booking.internal_notes, booking.internalNotes, '')),
    sourceUpdatedAt: firstPresent(booking.updated_at, booking.updatedAt, new Date().toISOString()),
  };
};

export const mapPaymentSplitToTwenty = (split = {}, bookingReference) => ({
  bookingReference: String(bookingReference || split.bookingReference || ''),
  externalSplitId: String(firstPresent(split.id, split.split_id, '')),
  merchantName: String(firstPresent(split.merchant_name, split.merchantName, '')).trim(),
  amount: normalizeMoney(split.amount),
  currency: String(firstPresent(split.currency, 'USD')).toUpperCase(),
  status: String(firstPresent(split.status, 'PENDING')).toUpperCase(),
  transactionReference: String(firstPresent(split.transaction_reference, split.transactionReference, '')),
});

export const mapFlightSegmentToTwenty = (segment = {}, bookingReference) => ({
  bookingReference: String(bookingReference || segment.bookingReference || ''),
  externalSegmentId: String(firstPresent(segment.id, segment.segment_id, '')),
  journeyType: String(firstPresent(segment.journey_type, segment.journeyType, 'OUTBOUND')).toUpperCase(),
  segmentOrder: Number(firstPresent(segment.segment_order, segment.segmentOrder, 1)),
  airlineName: String(firstPresent(segment.airline_name, segment.airlineName, '')),
  carrierCode: String(firstPresent(segment.carrier_code, segment.carrierCode, '')).toUpperCase(),
  flightNumber: String(firstPresent(segment.flight_number, segment.flightNumber, '')),
  originAirport: String(firstPresent(segment.origin_airport, segment.originAirport, '')).toUpperCase(),
  destinationAirport: String(firstPresent(segment.destination_airport, segment.destinationAirport, '')).toUpperCase(),
  departureAt: firstPresent(segment.departure_at, segment.departureAt, null),
  arrivalAt: firstPresent(segment.arrival_at, segment.arrivalAt, null),
  cabinClass: String(firstPresent(segment.cabin_class, segment.cabinClass, 'ECONOMY')).toUpperCase(),
});
