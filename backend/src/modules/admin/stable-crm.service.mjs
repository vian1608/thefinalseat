import supabase from '../../integrations/supabase/supabase.client.mjs';
import logger from '../../config/logger.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';
import {
  sendBookingRequestReceivedEmail,
  sendPassengerAuthorizationEmail,
  sendFinalTicketEmail
} from '../../integrations/resend/resend.service.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_SENT_STATES = new Set(['SENT', 'DELIVERED', 'ACCEPTED']);

const money = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fallback;
};

const cents = (value) => Math.round(money(value) * 100);

const safeString = (value) => String(value ?? '').trim();

const makeError = (message, code = 'CRM_OPERATION_FAILED', status = 400, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
};

const isMissingRelationError = (error) => {
  const text = String(error?.message || '').toLowerCase();
  return text.includes('does not exist') || text.includes('schema cache') || text.includes('not found');
};

const normalizeEmailStatus = (value) => {
  const raw = safeString(value).toUpperCase();
  if (!raw) return 'NOT_SENT';
  if (raw === 'NOT_SENT' || raw === 'UNATTEMPTED') return 'NOT_SENT';
  if (raw === 'AWAITING_AUTHORIZATION') return 'SENT';
  return raw;
};

async function resolveBooking(identifier) {
  const value = safeString(identifier);
  if (!value) throw makeError('A booking identifier is required.', 'BOOKING_IDENTIFIER_REQUIRED', 400);

  const query = UUID_RE.test(value)
    ? supabase.from('bookings').select('*').eq('id', value).maybeSingle()
    : supabase.from('bookings').select('*').eq('confirmation_code', value).maybeSingle();

  const { data, error } = await query;
  if (error) {
    throw makeError(`Unable to load the booking from Supabase: ${error.message}`, 'BOOKING_LOOKUP_FAILED', 500);
  }
  if (!data) {
    throw makeError(`Booking '${value}' was not found.`, 'BOOKING_NOT_FOUND', 404);
  }
  return data;
}

async function readPriceRevision(bookingId) {
  const { data, error } = await supabase
    .from('booking_price_revisions')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && !isMissingRelationError(error)) {
    logger.warn(`[StableCRM] price revision read failed for ${bookingId}: ${error.message}`);
  }
  return data || null;
}

async function readPaymentSplits(bookingId) {
  let result = await supabase
    .from('payment_authorization_splits')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (result.error && isMissingRelationError(result.error)) {
    result = await supabase
      .from('payment_splits')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });
  }

  if (result.error) {
    if (isMissingRelationError(result.error)) return [];
    throw makeError(`Unable to load payment splits: ${result.error.message}`, 'PAYMENT_SPLITS_READ_FAILED', 500);
  }

  return (result.data || []).map((row) => ({
    id: row.id,
    booking_id: row.booking_id,
    merchant_name: row.merchant_name || row.merchantName || row.name || '',
    merchantName: row.merchant_name || row.merchantName || row.name || '',
    amount: money(row.amount),
    currency: (row.currency || 'USD').toUpperCase(),
    created_at: row.created_at || null
  }));
}

async function readLatestAuthorization(bookingId) {
  const { data, error } = await supabase
    .from('passenger_authorizations')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && !isMissingRelationError(error)) {
    logger.warn(`[StableCRM] authorization read failed for ${bookingId}: ${error.message}`);
  }
  return data || null;
}

function derivePricing(booking, revision) {
  const customerTotal = money(
    booking.customer_price ?? booking.total_amount ?? revision?.customer_total,
    0
  );
  const supplierFare = money(
    booking.supplier_fare ?? revision?.supplier_fare ?? booking.supplier_price ?? booking.original_api_price,
    0
  );
  const taxes = money(
    booking.taxes_and_fees ?? revision?.taxes_and_fees ?? revision?.taxes ?? booking.taxes,
    0
  );
  const storedMarkup = booking.agency_markup ?? revision?.agency_markup ?? revision?.service_fee;
  const agencyMarkup = storedMarkup === undefined || storedMarkup === null
    ? money(customerTotal - supplierFare - taxes)
    : money(storedMarkup);

  return {
    supplierFare,
    supplier_fare: supplierFare,
    baseFare: supplierFare,
    taxes,
    taxesAndFees: taxes,
    taxes_and_fees: taxes,
    agencyMarkup,
    agency_markup: agencyMarkup,
    serviceFee: agencyMarkup,
    customerTotal,
    customer_price: customerTotal,
    total: customerTotal,
    currency: (booking.currency || revision?.currency || 'USD').toUpperCase(),
    reason: booking.price_change_reason || revision?.reason || '',
    margin: money(customerTotal - supplierFare - taxes),
    updatedAt: revision?.created_at || booking.updated_at || null
  };
}

function deriveEmailActivity(booking, complete) {
  const activity = complete?.emailActivity || {};
  const bookingRequest = activity.bookingRequest || {};
  const authorization = activity.authorization || {};
  const finalTicket = activity.finalTicket || {};

  const normalized = {
    bookingRequest: {
      status: normalizeEmailStatus(bookingRequest.status || booking.booking_request_email_status),
      recipient: bookingRequest.recipient || booking.booking_request_email_recipient || booking.email || null,
      sentAt: bookingRequest.sentAt || booking.booking_request_email_sent_at || null,
      providerMessageId: bookingRequest.providerMessageId || booking.booking_request_email_id || null,
      error: bookingRequest.error || booking.booking_request_email_error || null
    },
    authorization: {
      status: normalizeEmailStatus(authorization.status || booking.authorization_email_status),
      recipient: authorization.recipient || booking.authorization_email_recipient || booking.email || null,
      sentAt: authorization.sentAt || booking.authorization_email_sent_at || null,
      expiresAt: authorization.expiresAt || booking.authorization_expires_at || null,
      providerMessageId: authorization.providerMessageId || booking.authorization_email_id || null,
      error: authorization.error || booking.authorization_email_error || null
    },
    finalTicket: {
      status: normalizeEmailStatus(finalTicket.status || booking.final_confirmation_email_status),
      recipient: finalTicket.recipient || booking.final_confirmation_email_recipient || booking.email || null,
      sentAt: finalTicket.sentAt || booking.final_confirmation_email_sent_at || null,
      providerMessageId: finalTicket.providerMessageId || booking.final_confirmation_email_id || null,
      error: finalTicket.error || booking.final_confirmation_email_error || null
    }
  };

  normalized.count = Object.values(normalized).filter(
    (item) => item && typeof item === 'object' && EMAIL_SENT_STATES.has(item.status)
  ).length;

  return normalized;
}

async function buildStableBooking(identifier) {
  const booking = await resolveBooking(identifier);

  let complete = null;
  try {
    complete = await bookingRepository.getCompleteBookingById(booking.id);
  } catch (error) {
    logger.warn(`[StableCRM] legacy enrichment failed for ${booking.id}: ${error.message}`);
  }

  const [revision, paymentSplits, latestAuthorization] = await Promise.all([
    readPriceRevision(booking.id),
    readPaymentSplits(booking.id),
    readLatestAuthorization(booking.id)
  ]);

  const pricing = derivePricing(booking, revision);
  const splitTotal = money(paymentSplits.reduce((sum, split) => sum + money(split.amount), 0));
  const authorizationAmount = money(
    latestAuthorization?.authorized_amount ?? latestAuthorization?.amount ?? booking.authorized_amount ?? pricing.customerTotal,
    pricing.customerTotal
  );

  const integrity = {
    bookingTotal: pricing.customerTotal,
    splitTotal,
    authorizationAmount,
    splitsMatchBooking: paymentSplits.length === 0 || cents(splitTotal) === cents(pricing.customerTotal),
    authorizationMatchesBooking: cents(authorizationAmount) === cents(pricing.customerTotal)
  };
  integrity.ok = integrity.splitsMatchBooking && integrity.authorizationMatchesBooking;

  const emailActivity = deriveEmailActivity(booking, complete);

  return {
    ...(complete || {}),
    ...booking,
    id: booking.id,
    databaseBookingId: booking.id,
    confirmationCode: booking.confirmation_code,
    confirmation_code: booking.confirmation_code,
    bookingReference: booking.confirmation_code,
    customerName: booking.passenger_name,
    passenger_name: booking.passenger_name,
    amount: pricing.customerTotal,
    customer_price: pricing.customerTotal,
    total_amount: pricing.customerTotal,
    supplier_fare: pricing.supplierFare,
    taxes_and_fees: pricing.taxes,
    agency_markup: pricing.agencyMarkup,
    pricing,
    paymentSplits,
    payment_splits: paymentSplits,
    authorized_amount: authorizationAmount,
    authorization: {
      ...(complete?.authorization || {}),
      authorizedAmount: authorizationAmount,
      status: safeString(latestAuthorization?.status || booking.authorization_status || 'NOT_SENT').toUpperCase(),
      sentAt: emailActivity.authorization.sentAt,
      expiresAt: emailActivity.authorization.expiresAt
    },
    payment: {
      ...(complete?.payment || {}),
      status: safeString(booking.payment_status || complete?.payment?.status || 'PENDING').toUpperCase(),
      paymentStatus: safeString(booking.payment_status || complete?.payment?.paymentStatus || 'PENDING').toUpperCase(),
      authorizedAmount: splitTotal || pricing.customerTotal,
      transactionReference: booking.transaction_reference || booking.provider_payment_id || complete?.payment?.transactionReference || null
    },
    emailActivity,
    financialIntegrity: integrity,
    stableCrmVersion: 1
  };
}

async function listBookings({ page = 1, pageSize = 25, search = '' } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(5, Number(pageSize) || 25));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from('bookings')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  const term = safeString(search).replace(/[,%()]/g, ' ');
  if (term) {
    query = query.or(`confirmation_code.ilike.%${term}%,passenger_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw makeError(`Unable to load CRM bookings: ${error.message}`, 'BOOKING_LIST_FAILED', 500);
  }

  const bookings = (data || []).map((booking) => {
    const pricing = derivePricing(booking, null);
    return {
      id: booking.id,
      databaseBookingId: booking.id,
      confirmationCode: booking.confirmation_code,
      confirmation_code: booking.confirmation_code,
      passenger_name: booking.passenger_name,
      customerName: booking.passenger_name,
      email: booking.email,
      phone: booking.phone,
      amount: pricing.customerTotal,
      customer_price: pricing.customerTotal,
      total_amount: pricing.customerTotal,
      currency: pricing.currency,
      status: safeString(booking.status || 'PENDING').toUpperCase(),
      payment_status: safeString(booking.payment_status || 'PENDING').toUpperCase(),
      authorization_status: safeString(booking.authorization_status || 'NOT_SENT').toUpperCase(),
      airline_name: booking.airline_name || null,
      origin_code: booking.origin_code || null,
      destination_code: booking.destination_code || null,
      created_at: booking.created_at,
      updated_at: booking.updated_at
    };
  });

  return {
    bookings,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / safePageSize))
    }
  };
}

async function insertPriceRevision({ bookingId, supplierFare, taxes, agencyMarkup, customerTotal, currency, reason, adminId }) {
  const primary = await supabase.from('booking_price_revisions').insert({
    booking_id: bookingId,
    supplier_fare: supplierFare,
    taxes,
    agency_markup: agencyMarkup,
    customer_total: customerTotal,
    currency,
    reason,
    admin_id: adminId,
    created_at: new Date().toISOString()
  });

  if (primary.error && !isMissingRelationError(primary.error)) {
    logger.warn(`[StableCRM] price revision insert failed for ${bookingId}: ${primary.error.message}`);
  }
}

async function savePricing(identifier, payload, adminId = 'admin') {
  const booking = await resolveBooking(identifier);
  const supplierFare = money(payload.supplierFare ?? payload.supplier_fare);
  const taxes = money(payload.taxesAndFees ?? payload.taxes ?? payload.taxes_and_fees);
  const customerTotal = money(payload.customerTotal ?? payload.customer_price ?? payload.total_amount);
  const agencyMarkup = payload.agencyMarkup === undefined || payload.agencyMarkup === null
    ? money(customerTotal - supplierFare - taxes)
    : money(payload.agencyMarkup);
  const currency = safeString(payload.currency || booking.currency || 'USD').toUpperCase();
  const reason = safeString(payload.reason);

  if (supplierFare < 0 || taxes < 0 || customerTotal <= 0) {
    throw makeError('Supplier fare and taxes must be non-negative, and customer total must be greater than zero.', 'INVALID_PRICING', 400);
  }
  if (!reason) {
    throw makeError('A price revision reason is required.', 'PRICE_REASON_REQUIRED', 400);
  }
  if (cents(supplierFare + taxes + agencyMarkup) !== cents(customerTotal)) {
    throw makeError('Supplier fare + taxes + agency markup must equal the customer total.', 'PRICING_TOTAL_MISMATCH', 400, {
      supplierFare,
      taxes,
      agencyMarkup,
      customerTotal
    });
  }

  const now = new Date().toISOString();
  const fullPayload = {
    supplier_fare: supplierFare,
    taxes_and_fees: taxes,
    agency_markup: agencyMarkup,
    customer_price: customerTotal,
    total_amount: customerTotal,
    authorized_amount: customerTotal,
    currency,
    price_change_reason: reason,
    updated_at: now
  };

  let updateResult = await supabase
    .from('bookings')
    .update(fullPayload)
    .eq('id', booking.id)
    .select('*')
    .single();

  if (updateResult.error && isMissingRelationError(updateResult.error)) {
    // Compatibility path for databases that have not yet received the canonical metadata columns.
    updateResult = await supabase
      .from('bookings')
      .update({
        customer_price: customerTotal,
        total_amount: customerTotal,
        currency,
        updated_at: now
      })
      .eq('id', booking.id)
      .select('*')
      .single();
  }

  if (updateResult.error || !updateResult.data) {
    throw makeError(
      `Pricing was not saved to Supabase: ${updateResult.error?.message || 'No row was updated.'}`,
      'PRICING_DATABASE_WRITE_FAILED',
      500
    );
  }

  await insertPriceRevision({
    bookingId: booking.id,
    supplierFare,
    taxes,
    agencyMarkup,
    customerTotal,
    currency,
    reason,
    adminId
  });

  // Keep only unsent/pending authorization drafts synchronized. Never send email from a pricing save.
  const authUpdate = await supabase
    .from('passenger_authorizations')
    .update({ authorized_amount: customerTotal, amount: customerTotal, updated_at: now })
    .eq('booking_id', booking.id)
    .in('status', ['NOT_SENT', 'PENDING', 'DRAFT']);
  if (authUpdate.error && !isMissingRelationError(authUpdate.error)) {
    logger.warn(`[StableCRM] pending authorization amount sync failed for ${booking.id}: ${authUpdate.error.message}`);
  }

  const { data: verified, error: verifyError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', booking.id)
    .single();

  if (verifyError || !verified || cents(verified.customer_price ?? verified.total_amount) !== cents(customerTotal)) {
    throw makeError('Supabase read-after-write verification failed. The saved booking total did not match the requested total.', 'PRICING_VERIFICATION_FAILED', 500);
  }

  return buildStableBooking(booking.id);
}

async function replacePaymentSplits(booking, normalizedSplits) {
  const oldSplits = await readPaymentSplits(booking.id);

  const deletion = await supabase
    .from('payment_authorization_splits')
    .delete()
    .eq('booking_id', booking.id);

  if (deletion.error) {
    throw makeError(`Unable to replace payment splits: ${deletion.error.message}`, 'PAYMENT_SPLIT_DELETE_FAILED', 500);
  }

  if (normalizedSplits.length > 0) {
    const insertion = await supabase
      .from('payment_authorization_splits')
      .insert(normalizedSplits.map((split) => ({
        booking_id: booking.id,
        merchant_name: split.merchantName,
        amount: split.amount,
        currency: split.currency,
        created_at: new Date().toISOString()
      })));

    if (insertion.error) {
      // Best-effort restore of the previous persisted set.
      if (oldSplits.length > 0) {
        await supabase.from('payment_authorization_splits').insert(oldSplits.map((split) => ({
          booking_id: booking.id,
          merchant_name: split.merchantName,
          amount: split.amount,
          currency: split.currency,
          created_at: split.created_at || new Date().toISOString()
        })));
      }
      throw makeError(`Unable to save payment splits: ${insertion.error.message}`, 'PAYMENT_SPLIT_INSERT_FAILED', 500);
    }
  }
}

async function savePayment(identifier, payload, adminId = 'admin') {
  const booking = await resolveBooking(identifier);
  const bookingTotal = money(booking.customer_price ?? booking.total_amount);
  const requestedStatus = safeString(payload.paymentState || payload.paymentStatus || booking.payment_status || 'PENDING').toUpperCase();
  const allowedStatuses = new Set(['PENDING', 'PROCESSING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED']);
  if (!allowedStatuses.has(requestedStatus)) {
    throw makeError(`Unsupported payment state '${requestedStatus}'.`, 'INVALID_PAYMENT_STATUS', 400);
  }

  const rawSplits = Array.isArray(payload.splits) ? payload.splits : [];
  if (rawSplits.length === 0) {
    throw makeError('At least one merchant payment split is required.', 'PAYMENT_SPLITS_REQUIRED', 400);
  }

  const normalizedSplits = rawSplits.map((split, index) => {
    const merchantName = safeString(split.merchantName || split.merchant_name);
    const amount = money(split.amount);
    if (!merchantName) throw makeError(`Payment split ${index + 1} requires a merchant name.`, 'MERCHANT_NAME_REQUIRED', 400);
    if (amount <= 0) throw makeError(`Payment split ${index + 1} must be greater than zero.`, 'INVALID_SPLIT_AMOUNT', 400);
    return {
      merchantName,
      amount,
      currency: safeString(split.currency || booking.currency || 'USD').toUpperCase()
    };
  });

  const splitTotal = money(normalizedSplits.reduce((sum, split) => sum + split.amount, 0));
  if (cents(splitTotal) !== cents(bookingTotal)) {
    throw makeError(
      `Payment split total $${splitTotal.toFixed(2)} must equal the persisted booking total $${bookingTotal.toFixed(2)}. Save Pricing first when the booking amount changes.`,
      'PAYMENT_TOTAL_MISMATCH',
      400,
      { bookingTotal, splitTotal }
    );
  }

  await replacePaymentSplits(booking, normalizedSplits);

  const reference = safeString(payload.transactionReference || payload.referenceId) || null;
  if (requestedStatus === 'PAID' && !reference) {
    throw makeError('A transaction reference is required when marking a payment Paid.', 'TRANSACTION_REFERENCE_REQUIRED', 400);
  }

  const bookingUpdate = {
    payment_status: requestedStatus,
    authorized_amount: bookingTotal,
    transaction_reference: reference,
    updated_at: new Date().toISOString()
  };

  let update = await supabase
    .from('bookings')
    .update(bookingUpdate)
    .eq('id', booking.id)
    .select('*')
    .single();

  if (update.error && isMissingRelationError(update.error)) {
    update = await supabase
      .from('bookings')
      .update({
        payment_status: requestedStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', booking.id)
      .select('*')
      .single();
  }

  if (update.error || !update.data) {
    throw makeError(`Payment state was not saved to Supabase: ${update.error?.message || 'No row was updated.'}`, 'PAYMENT_DATABASE_WRITE_FAILED', 500);
  }

  const paymentRow = {
    booking_id: booking.id,
    payment_status: requestedStatus.toLowerCase(),
    payment_amount: bookingTotal,
    currency: safeString(booking.currency || 'USD').toUpperCase(),
    provider_payment_id: reference,
    payment_date: new Date().toISOString()
  };

  const existingPayment = await supabase.from('payments').select('id').eq('booking_id', booking.id).limit(1).maybeSingle();
  if (!existingPayment.error && existingPayment.data?.id) {
    const paymentUpdate = await supabase.from('payments').update(paymentRow).eq('id', existingPayment.data.id);
    if (paymentUpdate.error) logger.warn(`[StableCRM] payments row update failed for ${booking.id}: ${paymentUpdate.error.message}`);
  } else if (!existingPayment.error) {
    const paymentInsert = await supabase.from('payments').insert(paymentRow);
    if (paymentInsert.error) logger.warn(`[StableCRM] payments row insert failed for ${booking.id}: ${paymentInsert.error.message}`);
  }

  const verifiedSplits = await readPaymentSplits(booking.id);
  const verifiedTotal = money(verifiedSplits.reduce((sum, split) => sum + split.amount, 0));
  if (cents(verifiedTotal) !== cents(bookingTotal)) {
    throw makeError('Payment read-after-write verification failed. The persisted split total did not match the booking total.', 'PAYMENT_VERIFICATION_FAILED', 500);
  }

  logger.info(`[StableCRM] payment saved booking=${booking.id} admin=${adminId} total=${bookingTotal}`);
  return buildStableBooking(booking.id);
}

async function saveStatus(identifier, payload) {
  const booking = await resolveBooking(identifier);
  const allowed = new Set(['PENDING', 'AWAITING_AUTHORIZATION', 'AUTHORIZED', 'READY_FOR_TICKETING', 'TICKETED', 'DONE', 'FAILED', 'CANCELLED']);
  const status = safeString(payload.status || booking.status).toUpperCase();
  if (!allowed.has(status)) throw makeError(`Unsupported booking status '${status}'.`, 'INVALID_BOOKING_STATUS', 400);

  const updatePayload = {
    status,
    internal_notes: payload.internalNotes ?? payload.internal_notes ?? booking.internal_notes ?? '',
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('bookings').update(updatePayload).eq('id', booking.id).select('*').single();
  if (error || !data) throw makeError(`Booking status was not saved: ${error?.message || 'No row was updated.'}`, 'STATUS_DATABASE_WRITE_FAILED', 500);
  return buildStableBooking(booking.id);
}

async function saveTicket(identifier, payload, adminId = 'admin') {
  const booking = await resolveBooking(identifier);
  const pnr = safeString(payload.airlineConfirmationNumber || payload.airlinePnr || payload.pnr).toUpperCase();
  if (pnr && !/^[A-Z0-9]{6}$/.test(pnr)) {
    throw makeError('Airline PNR must contain exactly 6 letters or numbers.', 'INVALID_PNR', 400);
  }

  await bookingRepository.saveTicketDetails(booking.id, {
    airlineName: safeString(payload.airlineName),
    airlineCode: safeString(payload.airlineCode).toUpperCase(),
    airlineLogoUrl: safeString(payload.airlineLogoUrl),
    airlineConfirmationNumber: pnr,
    airlinePnr: pnr,
    ticketNumber: safeString(payload.ticketNumber),
    ticketIssuedAt: payload.ticketIssuedAt || null,
    ticketNotes: safeString(payload.ticketNotes),
    supplierConfirmation: safeString(payload.supplierConfirmation)
  }, adminId);

  return buildStableBooking(booking.id);
}

async function sendEmail(identifier, type, { force = false } = {}) {
  const booking = await resolveBooking(identifier);
  const normalizedType = safeString(type).toLowerCase().replace(/_/g, '-');

  let result;
  if (normalizedType === 'booking-request' || normalizedType === 'confirmation') {
    result = await sendBookingRequestReceivedEmail(booking.id, { force });
  } else if (normalizedType === 'authorization') {
    const stable = await buildStableBooking(booking.id);
    if (!stable.financialIntegrity.ok) {
      throw makeError(
        'Authorization email cannot be sent until booking total, payment splits, and authorization amount match.',
        'FINANCIAL_INTEGRITY_FAILED',
        409,
        stable.financialIntegrity
      );
    }
    result = await sendPassengerAuthorizationEmail(booking.id);
  } else if (normalizedType === 'final-ticket') {
    const pnr = safeString(booking.airline_confirmation_number || booking.airline_pnr || booking.pnr).toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(pnr)) {
      throw makeError('Save a valid 6-character airline PNR before sending the final ticket email.', 'PNR_REQUIRED', 409);
    }
    result = await sendFinalTicketEmail(booking.id);
  } else {
    throw makeError(`Unsupported email type '${type}'.`, 'INVALID_EMAIL_TYPE', 400);
  }

  if (!result?.success) {
    throw makeError(result?.error || result?.errorMessage || 'The email provider did not confirm delivery.', 'EMAIL_SEND_FAILED', 502);
  }

  return {
    email: result,
    booking: await buildStableBooking(booking.id)
  };
}

export const stableCrmService = {
  listBookings,
  getBooking: buildStableBooking,
  savePricing,
  savePayment,
  saveStatus,
  saveTicket,
  sendEmail
};

export default stableCrmService;
