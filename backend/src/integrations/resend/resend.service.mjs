import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import env from '../../config/env.mjs';
import logger from '../../config/logger.mjs';
import bookingRepository from '../../modules/bookings/booking.repository.mjs';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INQUIRIES_FILE = path.join(__dirname, '../../../../data/inquiries.jsonl');

const PLACEHOLDER_EMAIL_VALUES = [
  'your-email@gmail.com',
  'your-email-password',
  'your-app-password',
  '',
];

function getInquiryRecipients() {
  const fromEnv = env.inquiryNotifyEmails;
  if (fromEnv) {
    return fromEnv.split(',').map((e) => e.trim()).filter(Boolean);
  }
  return ['support@thefinalseat.com', 'viansaini1608@gmail.com'];
}

function isSmtpConfigured() {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();
  if (!user || !pass) return false;
  if (PLACEHOLDER_EMAIL_VALUES.includes(user.toLowerCase())) return false;
  if (PLACEHOLDER_EMAIL_VALUES.includes(pass.toLowerCase())) return false;
  return true;
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendViaResendOne({ to, subject, textBody, htmlBody, replyTo }) {
  const apiKey = env.resendApiKey?.trim();
  const from = env.resendFrom?.trim() || 'The Final Seat <support@thefinalseat.com>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,

      to: [to],
      subject,
      text: textBody,
      html: htmlBody,
      reply_to: replyTo,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Resend error (${response.status})`);
  }
  return data.id;
}

async function sendViaResend({ recipients, subject, textBody, htmlBody, replyTo }) {
  const apiKey = env.resendApiKey?.trim();
  if (!apiKey) return null;

  const sentTo = [];
  const failures = [];
  let lastMessageId = null;

  for (const to of recipients) {
    try {
      const messageId = await sendViaResendOne({
        to,
        subject,
        textBody,
        htmlBody,
        replyTo,
      });
      lastMessageId = messageId;
      sentTo.push(to);
      logger.info(`Resend sent to ${to}:`, messageId);
    } catch (err) {
      failures.push({ to, error: err.message });
      logger.error(`Resend failed for ${to}:`, err.message);
    }
  }

  if (sentTo.length > 0) {
    return { provider: 'resend', messageId: lastMessageId || sentTo.join(','), sentTo, failures };
  }


  if (failures.length > 0) {
    throw new Error(failures.map((f) => `${f.to}: ${f.error}`).join('; '));
  }

  return null;
}

async function sendViaSmtp({ recipients, subject, textBody, htmlBody, replyTo }) {
  if (!isSmtpConfigured()) return null;

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: `"The Final Seat LLC" <${process.env.EMAIL_USER}>`,
    to: recipients.join(', '),
    replyTo,
    subject,
    text: textBody,
    html: htmlBody,
  });

  return { provider: 'smtp', messageId: info.messageId };
}

export const saveInquiryToFile = async (inquiry) => {
  const record = { ...inquiry, receivedAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(INQUIRIES_FILE), { recursive: true });
  await fs.appendFile(INQUIRIES_FILE, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
};

export const sendConsultingInquiry = async (inquiry) => {
  const recipients = getInquiryRecipients();
  const isFlights = inquiry.serviceType === 'flights';
  const isPayment = inquiry.serviceType === 'consulting-payment';

  const subjectLabel = isPayment
    ? 'Secure Consulting Payment'
    : isFlights
      ? 'Air Logistics Advisory'
      : 'Amtrak / Rail Logistics Advisory';

  // Format inquiry text
  let textBody = '';
  if (isPayment) {
    textBody = [
      `NEW SECURE CONSULTING PAYMENT RECEIVED`,
      `The Final Seat LLC`,
      `======================================`,
      ``,
      `CONTACT`,
      `=======`,
      `Name: ${inquiry.name}`,
      `Email: ${inquiry.email}`,
      `Phone: ${inquiry.phone || 'Not provided'}`,
      ``,
      `BILLING DETAILS`,
      `===============`,
      `City/State: ${inquiry.origin}, ${inquiry.destination}`,
      `Payment details & notes:`,
      inquiry.notes || 'None',
      ``,
      `Submitted: ${new Date().toLocaleString()}`,
      `Source: Secure Online Checkout`,
      `======================================`
    ].join('\n');
  } else {
    const lines = [
      `NEW ${isFlights ? 'AIR' : 'RAIL'} LOGISTICS CONSULTING INQUIRY`,
      `The Final Seat LLC`,
      ``,
      `CONTACT`,
      `=======`,
      `Name: ${inquiry.name}`,
      `Email: ${inquiry.email}`,
      `Phone: ${inquiry.phone || 'Not provided'}`,
      ``,
      `ITINERARY`,
      `=========`,
      `Origin: ${inquiry.origin}`,
      `Destination: ${inquiry.destination}`,
    ];

    if (isFlights) {
      lines.push(
        `Trip type: ${inquiry.tripType || 'Not specified'}`,
        `Departure date: ${inquiry.travelDate || 'Flexible'}`,
      );
      if (inquiry.tripType === 'roundtrip') {
        lines.push(`Return date: ${inquiry.returnDate || 'Flexible'}`);
      }
      lines.push(`Preferred cabin: ${inquiry.cabinClass || 'Not specified'}`);
    } else {
      lines.push(`Preferred travel date: ${inquiry.travelDate || 'Flexible'}`);
    }

    lines.push(
      `Passengers: ${inquiry.passengers || '1'}`,
      ``,
      `ADVISORY NOTES`,
      `==============`,
      inquiry.notes || 'None',
      ``,
      `Submitted: ${new Date().toLocaleString()}`,
      `Source: ${isFlights ? 'Flights landing page' : 'Amtrak / Rail landing page'}`,
    );
    textBody = lines.join('\n');
  }

  const htmlBody = textBody.replace(/\n/g, '<br>');
  const subject = `${subjectLabel} — ${inquiry.name}`;

  await saveInquiryToFile(inquiry);

  const payload = {
    recipients,
    subject,
    textBody,
    htmlBody: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
    replyTo: inquiry.email,
  };

  const errors = [];

  if (env.resendApiKey?.trim()) {
    try {
      const result = await sendViaResend(payload);
      if (result?.sentTo?.length) {
        logger.info('Consulting inquiry emailed via Resend →', result.sentTo.join(', '));
        return {
          success: true,
          emailed: true,
          provider: 'resend',
          messageId: result.messageId,
          sentTo: result.sentTo,
        };
      }
    } catch (err) {
      errors.push(`Resend: ${err.message}`);
      logger.error('Resend failed:', err.message);
    }
  }

  if (isSmtpConfigured()) {
    try {
      const result = await sendViaSmtp(payload);
      if (result) {
        logger.info('Consulting inquiry emailed via SMTP →', recipients.join(', '));
        return { success: true, emailed: true, provider: 'smtp', messageId: result.messageId };
      }
    } catch (err) {
      errors.push(`SMTP: ${err.message}`);
      logger.error('SMTP failed:', err.message);
    }
  }

  logger.info('Consulting inquiry saved (email not sent). Details:\n', textBody);
  if (errors.length) logger.error('Email errors:', errors.join('; '));

  return {
    success: true,
    emailed: false,
    message: 'Inquiry received. Configure RESEND_API_KEY or SMTP variables to enable email delivery.',
    errors,
  };
};

function formatUsDate(dateVal) {
  if (!dateVal) return 'Scheduled';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatUsTime(timeVal) {
  if (!timeVal) return 'Scheduled';
  const str = String(timeVal);
  if (str.includes('T') || str.includes('-')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
  }
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let hrs = parseInt(match[1], 10);
    const mins = match[2];
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12 || 12;
    return `${hrs}:${mins} ${ampm}`;
  }
  return str;
}

export const sendBookingConfirmation = async (booking, options = {}) => {
  try {
    const bookingId = booking.id || booking.booking_id;
    const sentAt = booking.confirmation_email_sent_at || booking.confirmationEmailSentAt;

    // Idempotency check: Skip duplicate sends unless forced (e.g. admin action)
    if (sentAt && !options.force) {
      logger.info(`[Email] Skipping duplicate confirmation email for booking ${bookingId} (already sent at ${sentAt})`);
      return { success: true, duplicate: true, sentAt };
    }

    const rawPassengers = booking.passengers || booking.traveller_details || booking.travellers;
    const passengers = Array.isArray(rawPassengers)
      ? rawPassengers
      : (typeof rawPassengers === 'string' ? JSON.parse(rawPassengers || '[]') : []);

    const firstPassenger = passengers[0] || {};
    const passengerName = booking.customerName || booking.passenger_name || `${firstPassenger.firstName || firstPassenger.first_name || ''} ${firstPassenger.lastName || firstPassenger.last_name || ''}`.trim() || 'Valued Customer';
    const passengerFirstName = firstPassenger.firstName || firstPassenger.first_name || passengerName.split(' ')[0] || 'Valued Customer';
    const confirmationCode = booking.bookingReference || booking.confirmation_code || booking.confirmationCode || 'TFS-PENDING';
    const customerEmail = booking.email || booking.customerEmail || '';

    const customerPrice = parseFloat(booking.customer_price || booking.displayedWebsitePrice || booking.total_amount || booking.amount || 0);
    const amountPaid = customerPrice.toFixed(2);
    const currency = (booking.currency || 'USD').toUpperCase();
    const currencySymbol = currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : (currency === 'GBP' ? '£' : '$'));

    const rawPaymentProvider = (booking.payment_provider || booking.paymentProvider || 'whop').toLowerCase();
    let paymentMethod = 'Credit / Debit Card';
    if (rawPaymentProvider.includes('paypal')) {
      paymentMethod = 'PayPal';
    } else if (rawPaymentProvider.includes('whop') || rawPaymentProvider.includes('card') || rawPaymentProvider.includes('stripe')) {
      paymentMethod = 'Credit / Debit Card';
    }

    const rawDate = booking.paid_at || booking.bookingDate || booking.created_at || new Date().toISOString();
    const paymentDate = formatUsDate(rawDate);

    const passengerCount = passengers.length > 0 ? `${passengers.length}` : '1';

    // Extract flights
    const flightsList = Array.isArray(booking.flights) ? booking.flights : [];
    const outbound = flightsList.find(f => f.direction === 'outbound') || flightsList[0] || booking.flight || booking.flight_details || booking.outbound_flight || {};
    const returnFlight = flightsList.find(f => f.direction === 'return') || flightsList[1] || booking.returnFlight || booking.return_flight || null;
    const hasReturnFlight = !!returnFlight && Object.keys(returnFlight).length > 0;

    // Outbound Flight Fields
    const outboundAirline = outbound.carrier || outbound.airline || booking.carrier || booking.airline || 'Commercial Airline';
    const outboundFlightNumber = outbound.flight_number || outbound.flightNumber || outbound.number || '';
    const outboundOriginCode = outbound.origin_code || outbound.departure_airport || outbound.departure?.airport || outbound.origin || 'DEP';
    const outboundOriginCity = outbound.origin_city || outbound.departure_city || outbound.departure?.city || outboundOriginCode;
    const outboundDestinationCode = outbound.destination_code || outbound.arrival_airport || outbound.arrival?.airport || outbound.destination || 'ARR';
    const outboundDestinationCity = outbound.destination_city || outbound.arrival_city || outbound.arrival?.city || outboundDestinationCode;
    const outboundDepartureDate = formatUsDate(outbound.departure_date || outbound.departure_time || outbound.departureTime);
    const outboundDepartureTime = formatUsTime(outbound.departure_time || outbound.departureTime || outbound.departure_date);
    const outboundArrivalDate = formatUsDate(outbound.arrival_date || outbound.arrival_time || outbound.arrivalTime);
    const outboundArrivalTime = formatUsTime(outbound.arrival_time || outbound.arrivalTime || outbound.arrival_date);
    const outboundCabin = outbound.cabin_class || outbound.cabin || outbound.class || 'Economy';
    const outboundStops = outbound.stops !== undefined ? (outbound.stops === 0 ? 'Nonstop' : `${outbound.stops} Stop${outbound.stops > 1 ? 's' : ''}`) : 'Nonstop';

    // Load HTML Template
    const templatePath = path.join(__dirname, 'templates/booking-confirmation.html');
    let html = await fs.readFile(templatePath, 'utf8');

    // Handle {{#if hasReturnFlight}}...{{/if}}
    if (hasReturnFlight) {
      // Unwrap block
      html = html.replace(/\{\{#if hasReturnFlight\}\}/g, '').replace(/\{\{\/if\}\}/g, '');

      const returnAirline = returnFlight.carrier || returnFlight.airline || outboundAirline;
      const returnFlightNumber = returnFlight.flight_number || returnFlight.flightNumber || returnFlight.number || '';
      const returnOriginCode = returnFlight.origin_code || returnFlight.departure_airport || returnFlight.departure?.airport || outboundDestinationCode;
      const returnOriginCity = returnFlight.origin_city || returnFlight.departure_city || returnFlight.departure?.city || returnOriginCode;
      const returnDestinationCode = returnFlight.destination_code || returnFlight.arrival_airport || returnFlight.arrival?.airport || outboundOriginCode;
      const returnDestinationCity = returnFlight.destination_city || returnFlight.arrival_city || returnFlight.arrival?.city || returnDestinationCode;
      const returnDepartureDate = formatUsDate(returnFlight.departure_date || returnFlight.departure_time || returnFlight.departureTime);
      const returnDepartureTime = formatUsTime(returnFlight.departure_time || returnFlight.departureTime || returnFlight.departure_date);
      const returnArrivalDate = formatUsDate(returnFlight.arrival_date || returnFlight.arrival_time || returnFlight.arrivalTime);
      const returnArrivalTime = formatUsTime(returnFlight.arrival_time || returnFlight.arrivalTime || returnFlight.arrival_date);
      const returnCabin = returnFlight.cabin_class || returnFlight.cabin || returnFlight.class || outboundCabin;
      const returnStops = returnFlight.stops !== undefined ? (returnFlight.stops === 0 ? 'Nonstop' : `${returnFlight.stops} Stop${returnFlight.stops > 1 ? 's' : ''}`) : 'Nonstop';

      const returnReplacements = {
        '{{returnAirline}}': returnAirline,
        '{{returnFlightNumber}}': returnFlightNumber,
        '{{returnOriginCity}}': returnOriginCity,
        '{{returnOriginCode}}': returnOriginCode,
        '{{returnDestinationCity}}': returnDestinationCity,
        '{{returnDestinationCode}}': returnDestinationCode,
        '{{returnDepartureDate}}': returnDepartureDate,
        '{{returnDepartureTime}}': returnDepartureTime,
        '{{returnArrivalDate}}': returnArrivalDate,
        '{{returnArrivalTime}}': returnArrivalTime,
        '{{returnCabin}}': returnCabin,
        '{{returnStops}}': returnStops
      };

      for (const [key, val] of Object.entries(returnReplacements)) {
        html = html.replaceAll(key, val || '');
      }
    } else {
      // Remove return flight block entirely for one-way trips
      html = html.replace(/\{\{#if hasReturnFlight\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    }

    // Standard Replacements
    const replacements = {
      '{{confirmationCode}}': confirmationCode,
      '{{passengerFirstName}}': passengerFirstName,
      '{{passengerName}}': passengerName,
      '{{currencySymbol}}': currencySymbol,
      '{{amountPaid}}': amountPaid,
      '{{currency}}': currency,
      '{{paymentMethod}}': paymentMethod,
      '{{paymentDate}}': paymentDate,
      '{{passengerCount}}': passengerCount,
      '{{customerEmail}}': customerEmail,
      '{{outboundAirline}}': outboundAirline,
      '{{outboundFlightNumber}}': outboundFlightNumber,
      '{{outboundOriginCity}}': outboundOriginCity,
      '{{outboundOriginCode}}': outboundOriginCode,
      '{{outboundDestinationCity}}': outboundDestinationCity,
      '{{outboundDestinationCode}}': outboundDestinationCode,
      '{{outboundDepartureDate}}': outboundDepartureDate,
      '{{outboundDepartureTime}}': outboundDepartureTime,
      '{{outboundArrivalDate}}': outboundArrivalDate,
      '{{outboundArrivalTime}}': outboundArrivalTime,
      '{{outboundCabin}}': outboundCabin,
      '{{outboundStops}}': outboundStops
    };

    for (const [key, val] of Object.entries(replacements)) {
      html = html.replaceAll(key, val || '');
    }

    // Safety clean any residual template placeholders
    html = html.replace(/\{\{[^}]+\\}\}/g, '');

    // Plaintext Fallback
    const customerTextBody = `
THE FINAL SEAT — TEMPORARY RESERVATION CONFIRMATION

Thank you, ${passengerFirstName}!

Your payment of ${currencySymbol}${amountPaid} ${currency} has been received successfully via ${paymentMethod} on ${paymentDate}.

TEMPORARY CONFIRMATION NUMBER: ${confirmationCode}

PASSENGER DETAILS:
Primary Passenger: ${passengerName}
Number of Travelers: ${passengerCount}
Contact Email: ${customerEmail}

FLIGHT ITINERARY:
Outbound: ${outboundAirline} ${outboundFlightNumber} (${outboundOriginCity} [${outboundOriginCode}] to ${outboundDestinationCity} [${outboundDestinationCode}])
Departure: ${outboundDepartureDate} ${outboundDepartureTime}
Arrival: ${outboundArrivalDate} ${outboundArrivalTime}
Cabin: ${outboundCabin} | Stops: ${outboundStops}
${hasReturnFlight ? `
Return: ${outboundAirline} (${outboundDestinationCity} to ${outboundOriginCity})
` : ''}
IMPORTANT NOTICE:
${confirmationCode} is a temporary confirmation number issued by The Final Seat. It is not the airline's final PNR, ticket number, or electronic ticket. Please wait for the separate email containing your final airline-issued confirmation details.

Track your reservation at: https://www.thefinalseat.com/my-bookings?code=${confirmationCode}

Support 24/7: Call +1 (213) 965-9727 or Email support@thefinalseat.com
    `.trim();

    const subject = `Payment Received — Temporary Confirmation ${confirmationCode}`;
    let emailMessageId = `log_${Date.now()}`;

    if (env.resendApiKey?.trim()) {
      try {
        const result = await sendViaResend({
          recipients: [customerEmail],
          subject,
          textBody: customerTextBody,
          htmlBody: html,
          replyTo: 'support@thefinalseat.com',
        });
        if (result && result.messageId) {
          emailMessageId = result.messageId;
        }
      } catch (rErr) {
        logger.error(`Resend email error for booking ${bookingId}:`, rErr.message);
      }
    } else if (isSmtpConfigured()) {
      try {
        const transporter = getTransporter();
        const info = await transporter.sendMail({
          from: env.resendFrom || 'The Final Seat <support@thefinalseat.com>',
          to: customerEmail,
          subject,
          text: customerTextBody,
          html,
        });
        emailMessageId = info.messageId || emailMessageId;
        logger.info(`SMTP confirmation email sent to ${customerEmail} for booking ${confirmationCode}`);
      } catch (sErr) {
        logger.error(`SMTP email error for booking ${bookingId}:`, sErr.message);
      }
    } else {
      logger.warn(`No email API key / SMTP configured. Confirmation email for ${confirmationCode} printed to logs.`);
    }

    if (bookingId) {
      await bookingRepository.markConfirmationEmailSent(bookingId, emailMessageId);
    }

    return { success: true, emailId: emailMessageId };

  } catch (error) {
    logger.error('[Email] Non-blocking error in sendBookingConfirmation:', error.message);
    return { success: false, error: error.message };
  }
};


export const sendPaymentFailedEmail = async (booking, reason = 'Payment processing failed') => {
  try {
    const bookingId = booking.id || booking.booking_id;
    const email = booking.email || booking.customerEmail || '';
    if (!email) return { success: false, error: 'No recipient email provided' };

    const bookingReference = booking.confirmation_code || booking.bookingReference || 'TFS-RETRY';
    const customerName = booking.passenger_name || booking.customerName || 'Valued Customer';
    const frontendUrl = env.frontendUrl || 'https://thefinalseat.com';
    const retryUrl = `${frontendUrl}/booking`;

    const textBody = `
Dear ${customerName},

We were unable to process your payment for booking confirmation reference ${bookingReference}.

Reason: ${reason}

Your reservation remains on hold. Please retry your payment using the link below to confirm your flight:
${retryUrl}

If you require assistance, contact our 24/7 support desk:
Email: support@thefinalseat.com
Phone: +1 (888) 210-8656

The Final Seat LLC
    `.trim();

    const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
  <h2 style="color: #dc2626;">Payment Action Required</h2>
  <p>Dear ${customerName},</p>
  <p>We were unable to process your payment for reservation <strong>${bookingReference}</strong>.</p>
  <p style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px; color: #991b1b;">
    <strong>Details:</strong> ${reason}
  </p>
  <p>Please click the button below to retry your payment and secure your flight tickets:</p>
  <p style="text-align: center; margin: 24px 0;">
    <a href="${retryUrl}" style="background: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Retry Payment Now &rarr;</a>
  </p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
  <p style="font-size: 12px; color: #64748b;">
    The Final Seat LLC &middot; Support: support@thefinalseat.com | +1 (888) 210-8656
  </p>
</div>
    `.trim();

    let messageId = `failed_${Date.now()}`;
    if (env.resendApiKey?.trim()) {
      const res = await sendViaResend({
        recipients: [email],
        subject: `Payment Failed — ${bookingReference} | The Final Seat`,
        textBody,
        htmlBody,
        replyTo: 'support@thefinalseat.com'
      });
      if (res && res.messageId) messageId = res.messageId;
    }

    return { success: true, messageId };
  } catch (err) {
    logger.error(`[Email] Error sending payment failed email: ${err.message}`);
    return { success: false, error: err.message };
  }
};


