import env from '../../config/env.mjs';
import logger from '../../config/logger.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';

const esc = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const money = (value) => Number(Number(value || 0).toFixed(2));

export async function sendTripAddonBookingSummaryEmail(bookingId, tripAddons = {}) {
  if (!bookingId || (!tripAddons?.flexAssist?.selected && !tripAddons?.baggage?.length)) return { skipped: true };
  const booking = await bookingRepository.getById(bookingId);
  if (!booking?.email) return { skipped: true, reason: 'BOOKING_EMAIL_MISSING' };
  const apiKey = String(env.resendApiKey || '').trim();
  if (!apiKey) return { skipped: true, reason: 'RESEND_NOT_CONFIGURED' };

  const existing = await bookingRepository.getEmailDeliveryStatus?.(bookingId, 'TRIP_ADDONS_SUMMARY').catch(() => null);
  if (existing?.status === 'SENT') return { skipped: true, duplicate: true, messageId: existing.provider_message_id };

  const total = money(booking.customer_price || booking.total_amount);
  const flex = tripAddons?.flexAssist?.selected ? money(tripAddons.flexAssist.price) : 0;
  const ticket = Number.isFinite(Number(booking.ticket_component_total))
    ? money(booking.ticket_component_total)
    : money(total - flex);
  const currency = String(booking.currency || tripAddons.currency || 'USD').toUpperCase();
  const ref = booking.confirmation_code || booking.confirmationCode || bookingId;
  const bags = Array.isArray(tripAddons.baggage) ? tripAddons.baggage : [];

  const baggageText = bags.length
    ? bags.map((b) => `Passenger #${Number(b.travelerIndex) + 1} — ${b.direction === 'RETURN' ? 'Return' : 'Outbound'}: ${b.quantity} extra checked bag${Number(b.quantity) === 1 ? '' : 's'} — $0.00 now, pending airline confirmation`).join('\n')
    : 'No extra baggage requested.';
  const text = [
    'THE FINAL SEAT — RESERVATION TRIP OPTIONS',
    `Booking: ${ref}`,
    '',
    'PRICE BREAKDOWN',
    `Ticket component: $${ticket.toFixed(2)} ${currency}`,
    ...(tripAddons?.flexAssist?.selected ? [`Flex Assist (10%): $${flex.toFixed(2)} ${currency} — ${tripAddons.flexAssist.termsVersion || 'FLEX_V1'}`] : []),
    ...(bags.length ? ['Checked baggage request: $0.00 now'] : []),
    `Total authorized with airfare checkout: $${total.toFixed(2)} ${currency}`,
    '',
    'CHECKED BAGGAGE', baggageText,
    '',
    ...(tripAddons?.flexAssist?.selected ? ['FLEX ASSIST', 'Flex Assist is an agency service for eligible change/rebooking assistance. It is not travel insurance and does not convert the underlying airline fare into a flexible fare. Airline fare differences, taxes, penalties, availability and fare rules may still apply.', ''] : []),
    'Baggage is not purchased or guaranteed by the airfare payment. If available, the confirmed baggage fee will be offered and paid separately before supplier purchase.',
  ].join('\n');

  const baggageHtml = bags.length ? `<ul>${bags.map((b) => `<li>Passenger #${Number(b.travelerIndex) + 1} · ${b.direction === 'RETURN' ? 'Return' : 'Outbound'} · ${Number(b.quantity) || 1} extra checked bag${Number(b.quantity) === 1 ? '' : 's'} — <strong>$0.00 now</strong>, pending airline confirmation</li>`).join('')}</ul>` : '<p>No extra baggage requested.</p>';
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:640px;margin:auto"><h2 style="color:#7f0d2f">Your reservation trip options</h2><p><strong>Booking:</strong> ${esc(ref)}</p><div style="border:1px solid #ead5dc;border-radius:12px;padding:16px;background:#fffafb"><div style="display:flex;justify-content:space-between"><span>Ticket component</span><strong>$${ticket.toFixed(2)} ${esc(currency)}</strong></div>${tripAddons?.flexAssist?.selected ? `<div style="display:flex;justify-content:space-between;margin-top:8px"><span>Flex Assist (10%)</span><strong>$${flex.toFixed(2)} ${esc(currency)}</strong></div>` : ''}${bags.length ? '<div style="display:flex;justify-content:space-between;margin-top:8px"><span>Checked baggage request</span><strong>$0.00 now</strong></div>' : ''}<div style="border-top:1px solid #ead5dc;margin-top:12px;padding-top:12px;display:flex;justify-content:space-between"><strong>Total authorized</strong><strong>$${total.toFixed(2)} ${esc(currency)}</strong></div></div>${tripAddons?.flexAssist?.selected ? `<h3>Flex Assist</h3><p>Active under <strong>${esc(tripAddons.flexAssist.termsVersion || 'FLEX_V1')}</strong>. Flex Assist provides agency change/rebooking assistance; it is not travel insurance or an airline flexible fare. Fare differences, taxes, penalties, availability and airline/supplier rules may still apply.</p>` : ''}<h3>Checked baggage</h3>${baggageHtml}<p style="font-size:13px;color:#64748b">Baggage remains a request until airline/supplier availability and the exact fee are confirmed. Any baggage payment is separate from airfare, and payment receipt is not the same as supplier confirmation.</p></div>`;

  await bookingRepository.upsertEmailDeliveryRecord?.({
    booking_id: bookingId,
    confirmation_code: ref,
    email_type: 'TRIP_ADDONS_SUMMARY',
    recipient: booking.email,
    status: 'PENDING',
    provider: 'RESEND',
    attempt_count: Number(existing?.attempt_count || 0) + 1,
  }).catch(() => null);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.resendFrom?.trim() || 'The Final Seat <support@thefinalseat.com>',
      to: [booking.email],
      subject: `Your trip options — ${ref}`,
      text,
      html,
      reply_to: 'support@thefinalseat.com',
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    await bookingRepository.upsertEmailDeliveryRecord?.({ booking_id: bookingId, confirmation_code: ref, email_type: 'TRIP_ADDONS_SUMMARY', recipient: booking.email, status: 'FAILED', provider: 'RESEND', error_message: body.message || `Resend ${response.status}` }).catch(() => null);
    throw new Error(body.message || `Resend error (${response.status})`);
  }

  await bookingRepository.upsertEmailDeliveryRecord?.({ booking_id: bookingId, confirmation_code: ref, email_type: 'TRIP_ADDONS_SUMMARY', recipient: booking.email, status: 'SENT', provider: 'RESEND', provider_message_id: body.id || null, sent_at: new Date().toISOString() }).catch(() => null);
  logger.info(`[TripAddons] itemized booking add-on email sent for ${ref}`);
  return { success: true, messageId: body.id || null };
}

export default sendTripAddonBookingSummaryEmail;
