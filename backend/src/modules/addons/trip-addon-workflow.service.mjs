import bookingRepository from '../bookings/booking.repository.mjs';
import env from '../../config/env.mjs';
import logger from '../../config/logger.mjs';
import {
  parseTripAddonsFromInternalNotes,
  persistTripAddonSnapshot,
  publicTripAddonProjection,
} from './trip-addon.repository.mjs';

const BAGGAGE_STATUSES = Object.freeze([
  'REQUESTED',
  'CHECKING_AVAILABILITY',
  'AVAILABLE',
  'PRICE_CONFIRMED',
  'OFFER_SENT',
  'AWAITING_PAYMENT',
  'PAID',
  'PURCHASE_PENDING',
  'CONFIRMED',
  'UNAVAILABLE',
  'DECLINED_BY_CUSTOMER',
  'PRICE_EXPIRED',
  'PAYMENT_FAILED',
  'PURCHASE_FAILED',
  'REFUNDED',
  'CANCELLED',
]);

const PRICE_REQUIRED_STATUSES = new Set([
  'PRICE_CONFIRMED', 'OFFER_SENT', 'AWAITING_PAYMENT', 'PAID', 'PURCHASE_PENDING', 'CONFIRMED', 'REFUNDED',
]);

function workflowError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function moneyOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Number(number.toFixed(2));
}

function normalizeHttpsUrl(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  let url;
  try { url = new URL(text); } catch { throw workflowError('Payment link must be a valid HTTPS URL.', 'INVALID_BAGGAGE_PAYMENT_URL'); }
  if (url.protocol !== 'https:') throw workflowError('Payment link must use HTTPS.', 'INVALID_BAGGAGE_PAYMENT_URL');
  return url.toString();
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw workflowError('Quote expiry must be a valid date/time.', 'INVALID_BAGGAGE_QUOTE_EXPIRY');
  return date.toISOString();
}

function paymentStatusFor(status) {
  if (['PAID', 'PURCHASE_PENDING', 'CONFIRMED'].includes(status)) return 'PAID';
  if (status === 'REFUNDED') return 'REFUNDED';
  if (status === 'PAYMENT_FAILED') return 'FAILED';
  if (['PRICE_CONFIRMED', 'OFFER_SENT', 'AWAITING_PAYMENT'].includes(status)) return 'AWAITING_PAYMENT';
  return 'NOT_REQUIRED_YET';
}

function upgradeSnapshot(snapshot = {}) {
  const now = new Date().toISOString();
  return {
    ...snapshot,
    version: 'TRIP_ADDONS_V2',
    currency: snapshot.currency || 'USD',
    baggage: (Array.isArray(snapshot.baggage) ? snapshot.baggage : []).map((item = {}) => ({
      requestId: item.requestId || `bag_${Number(item.travelerIndex) || 0}_${String(item.direction || 'OUTBOUND').toLowerCase()}`,
      addonType: 'CHECKED_BAGGAGE',
      travelerIndex: Number(item.travelerIndex) || 0,
      direction: String(item.direction || 'OUTBOUND').toUpperCase(),
      quantity: Math.max(1, Math.min(3, Number.parseInt(item.quantity, 10) || 1)),
      weightKg: Number(item.weightKg) || 23,
      priceMode: 'POST_RESERVATION_QUOTE',
      currency: item.currency || snapshot.currency || 'USD',
      paymentDueNow: 0,
      supplierCost: moneyOrNull(item.supplierCost),
      customerPrice: moneyOrNull(item.customerPrice),
      quoteValidUntil: item.quoteValidUntil || null,
      paymentUrl: item.paymentUrl || null,
      paymentStatus: item.paymentStatus || paymentStatusFor(item.status || 'REQUESTED'),
      supplierReference: item.supplierReference || null,
      status: BAGGAGE_STATUSES.includes(String(item.status || '').toUpperCase()) ? String(item.status).toUpperCase() : 'REQUESTED',
      requiresSeparatePayment: true,
      termsVersion: item.termsVersion || 'BAGGAGE_REQUEST_V2',
      message: item.message || 'Baggage is subject to airline availability. The confirmed fee is paid separately after the reservation.',
      adminNotes: item.adminNotes || '',
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
    })),
  };
}

async function loadBooking(reference) {
  const booking = await bookingRepository.getById(reference);
  if (!booking) throw workflowError(`Booking '${reference}' was not found.`, 'BOOKING_NOT_FOUND', 404);
  return booking;
}

async function loadSnapshot(reference) {
  const booking = await loadBooking(reference);
  const snapshot = upgradeSnapshot(
    booking.tripAddons
      || booking.trip_addons
      || parseTripAddonsFromInternalNotes(booking.internal_notes || booking.internalNotes),
  );
  return { booking, snapshot };
}

function findRequest(snapshot, requestId) {
  const item = snapshot.baggage.find((request) => request.requestId === requestId);
  if (!item) throw workflowError(`Baggage request '${requestId}' was not found.`, 'BAGGAGE_REQUEST_NOT_FOUND', 404);
  return item;
}

async function updateRequest(reference, requestId, patch = {}, actor = 'admin') {
  const { booking, snapshot } = await loadSnapshot(reference);
  const current = findRequest(snapshot, requestId);
  const nextStatus = String(patch.status || current.status || 'REQUESTED').trim().toUpperCase();
  if (!BAGGAGE_STATUSES.includes(nextStatus)) {
    throw workflowError(`Invalid baggage status '${nextStatus}'.`, 'INVALID_BAGGAGE_STATUS');
  }

  const supplierCost = patch.supplierCost !== undefined ? moneyOrNull(patch.supplierCost) : current.supplierCost;
  const customerPrice = patch.customerPrice !== undefined ? moneyOrNull(patch.customerPrice) : current.customerPrice;
  if (patch.supplierCost !== undefined && supplierCost === null && patch.supplierCost !== '' && patch.supplierCost !== null) {
    throw workflowError('Supplier baggage cost must be zero or a positive amount.', 'INVALID_BAGGAGE_SUPPLIER_COST');
  }
  if (patch.customerPrice !== undefined && customerPrice === null && patch.customerPrice !== '' && patch.customerPrice !== null) {
    throw workflowError('Customer baggage price must be zero or a positive amount.', 'INVALID_BAGGAGE_CUSTOMER_PRICE');
  }
  if (PRICE_REQUIRED_STATUSES.has(nextStatus) && !(customerPrice > 0)) {
    throw workflowError('Enter the confirmed customer baggage price before moving to this status.', 'BAGGAGE_PRICE_REQUIRED');
  }

  const paymentUrl = patch.paymentUrl !== undefined ? normalizeHttpsUrl(patch.paymentUrl) : current.paymentUrl;
  const quoteValidUntil = patch.quoteValidUntil !== undefined ? normalizeDate(patch.quoteValidUntil) : current.quoteValidUntil;
  if (['OFFER_SENT', 'AWAITING_PAYMENT'].includes(nextStatus) && !paymentUrl) {
    throw workflowError('Add the separate HTTPS baggage payment link before sending an offer or awaiting payment.', 'BAGGAGE_PAYMENT_LINK_REQUIRED');
  }

  const updated = {
    ...current,
    supplierCost,
    customerPrice,
    quoteValidUntil,
    paymentUrl,
    supplierReference: patch.supplierReference !== undefined ? String(patch.supplierReference || '').trim() || null : current.supplierReference,
    adminNotes: patch.adminNotes !== undefined ? String(patch.adminNotes || '').trim() : current.adminNotes,
    status: nextStatus,
    paymentStatus: paymentStatusFor(nextStatus),
    updatedAt: new Date().toISOString(),
  };
  updated.message = nextStatus === 'CONFIRMED'
    ? 'Your extra baggage has been confirmed.'
    : nextStatus === 'UNAVAILABLE'
      ? 'The airline or supplier could not confirm this baggage request.'
      : nextStatus === 'AWAITING_PAYMENT' || nextStatus === 'OFFER_SENT' || nextStatus === 'PRICE_CONFIRMED'
        ? 'Baggage availability and price have been confirmed. Baggage is paid separately from airfare.'
        : nextStatus === 'PAID' || nextStatus === 'PURCHASE_PENDING'
          ? 'Separate baggage payment has been received. The baggage purchase is being completed.'
          : 'Baggage is subject to airline availability. The confirmed fee is paid separately after the reservation.';

  snapshot.baggage = snapshot.baggage.map((item) => item.requestId === requestId ? updated : item);
  const persisted = await persistTripAddonSnapshot(booking.id, snapshot);
  if (!persisted) throw workflowError('Unable to save baggage workflow state.', 'BAGGAGE_WORKFLOW_SAVE_FAILED', 500);

  await bookingRepository.recordAuditLog({
    bookingId: booking.id,
    action: 'BAGGAGE_REQUEST_UPDATED',
    oldValue: { requestId, status: current.status, supplierCost: current.supplierCost, customerPrice: current.customerPrice },
    newValue: { requestId, status: updated.status, supplierCost: updated.supplierCost, customerPrice: updated.customerPrice, paymentStatus: updated.paymentStatus },
    actor,
  });

  return { booking, snapshot, request: updated };
}

async function sendOfferEmail(reference, requestId, actor = 'admin') {
  const { booking, snapshot } = await loadSnapshot(reference);
  const request = findRequest(snapshot, requestId);
  if (!(request.customerPrice > 0)) throw workflowError('A confirmed baggage price is required before sending an offer.', 'BAGGAGE_PRICE_REQUIRED');
  const paymentUrl = normalizeHttpsUrl(request.paymentUrl);
  if (!paymentUrl) throw workflowError('A separate HTTPS baggage payment link is required before sending an offer.', 'BAGGAGE_PAYMENT_LINK_REQUIRED');

  const apiKey = env.resendApiKey?.trim();
  if (!apiKey) throw workflowError('Baggage offer email is not configured because RESEND_API_KEY is unavailable.', 'EMAIL_NOT_CONFIGURED', 503);
  const to = String(booking.email || '').trim().toLowerCase();
  if (!to) throw workflowError('Booking has no customer email address.', 'BOOKING_EMAIL_MISSING');

  const passenger = Array.isArray(booking.travellers) ? booking.travellers[request.travelerIndex] : null;
  const passengerName = passenger
    ? [passenger.first_name || passenger.firstName, passenger.middle_name || passenger.middleName, passenger.last_name || passenger.lastName].filter(Boolean).join(' ')
    : `Passenger #${request.travelerIndex + 1}`;
  const directionLabel = request.direction === 'RETURN' ? 'return journey' : 'outbound journey';
  const expiryText = request.quoteValidUntil ? new Date(request.quoteValidUntil).toLocaleString('en-US') : 'until the airline/supplier price changes';
  const amount = Number(request.customerPrice).toFixed(2);
  const subject = `Baggage price confirmed — ${booking.confirmation_code || booking.confirmationCode}`;
  const text = [
    `Your extra baggage request is available.`,
    `Booking: ${booking.confirmation_code || booking.confirmationCode}`,
    `Passenger: ${passengerName}`,
    `Journey: ${directionLabel}`,
    `Requested baggage: ${request.quantity} checked bag${request.quantity === 1 ? '' : 's'} (up to ${request.weightKg || 23} kg / 50 lb each)`,
    `Confirmed baggage price: $${amount} ${request.currency || 'USD'}`,
    `Quote valid: ${expiryText}`,
    `Pay separately for baggage: ${paymentUrl}`,
    `This baggage fee is separate from your airfare. Baggage will only be purchased after payment is received, and airline/supplier rules continue to apply.`,
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033"><h2 style="color:#8b1538">Your baggage request is available</h2><p><strong>Booking:</strong> ${booking.confirmation_code || booking.confirmationCode}</p><p><strong>Passenger:</strong> ${passengerName}<br><strong>Journey:</strong> ${directionLabel}<br><strong>Extra baggage:</strong> ${request.quantity} checked bag${request.quantity === 1 ? '' : 's'} (up to ${request.weightKg || 23} kg / 50 lb each)</p><div style="padding:16px;border:1px solid #ead5dc;border-radius:10px;background:#fffafb"><strong>Confirmed baggage price: $${amount} ${request.currency || 'USD'}</strong><br><small>Valid ${expiryText}</small></div><p><a href="${paymentUrl}" style="display:inline-block;padding:12px 18px;background:#8b1538;color:white;text-decoration:none;border-radius:8px;font-weight:700">Pay for baggage separately</a></p><p style="font-size:13px;color:#64748b">This baggage fee is separate from your airfare. Baggage will only be purchased after payment is received. Airline/supplier availability, weight/size limits and fare rules continue to apply.</p></div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.resendFrom?.trim() || 'The Final Seat <support@thefinalseat.com>',
      to: [to],
      subject,
      text,
      html,
      reply_to: 'support@thefinalseat.com',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw workflowError(data.message || `Email provider returned ${response.status}.`, 'BAGGAGE_OFFER_EMAIL_FAILED', 502);

  const updated = await updateRequest(reference, requestId, { status: 'OFFER_SENT' }, actor);
  try {
    await bookingRepository.saveEmailActivity(booking.id, {
      template_type: 'BAGGAGE_OFFER',
      recipient: to,
      provider: 'Resend',
      provider_message_id: data.id || null,
      status: 'SENT',
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn(`[TripAddons] Baggage email activity logging warning: ${error.message}`);
  }
  return { ...updated, email: { sent: true, messageId: data.id || null, recipient: to } };
}

const tripAddonWorkflowService = {
  BAGGAGE_STATUSES,
  loadSnapshot,
  getPublic: async (reference) => {
    const { snapshot } = await loadSnapshot(reference);
    return publicTripAddonProjection(snapshot);
  },
  updateRequest,
  sendOfferEmail,
};

export default tripAddonWorkflowService;
