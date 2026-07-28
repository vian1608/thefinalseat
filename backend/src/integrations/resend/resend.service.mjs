import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import env from '../../config/env.mjs';
import logger from '../../config/logger.mjs';
import bookingRepository from '../../modules/bookings/booking.repository.mjs';
import passengerAuthorizationService from '../../modules/authorizations/passenger-authorization.service.mjs';



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

export const sendBookingRequestReceivedEmail = async (bookingId, { force = false } = {}) => {
  try {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };

    if (!force && booking.booking_request_email_status === 'SENT') {
      logger.info(`[Email] sendBookingRequestReceivedEmail skipped (already sent) for ${booking.confirmation_code}`);
      return { success: true, emailId: booking.booking_request_email_id, skipped: true };
    }

    const customerEmail = booking.email || booking.contacts?.[0]?.email || booking.travellers?.[0]?.email;
    if (!customerEmail || !customerEmail.includes('@')) {
      const errMsg = 'This booking does not have a valid passenger email address.';
      await bookingRepository.updateBookingStatus(bookingId, {
        booking_request_email_status: 'FAILED',
        booking_request_email_error: errMsg
      });
      return { success: false, error: errMsg };
    }

    const confirmationCode = booking.confirmation_code || booking.confirmationCode || 'TFS-PENDING';
    const passengerName = booking.passenger_name || 'Valued Passenger';
    const passengerFirstName = passengerName.split(' ')[0] || 'Passenger';
    const passengerCount = (booking.travellers?.length || 1).toString();
    const currency = booking.currency || 'USD';
    const currencySymbol = currency === 'EUR' ? '€' : (currency === 'GBP' ? '£' : '$');
    const customerTotal = parseFloat(booking.customer_price || booking.total_amount || 0).toFixed(2);
    const bookingDate = booking.created_at ? new Date(booking.created_at).toLocaleDateString() : new Date().toLocaleDateString();

    const outboundSegs = booking.outbound_segments || (booking.itinerary_segments ? booking.itinerary_segments.filter(s => s.journey_direction === 'outbound') : []);
    const returnSegs = booking.return_segments || (booking.itinerary_segments ? booking.itinerary_segments.filter(s => s.journey_direction === 'return') : []);

    const templatePath = path.join(__dirname, 'templates', 'booking-confirmation.html');
    let html = await fs.readFile(templatePath, 'utf8').catch(() => null);

    if (!html) {
      html = `<h2>Booking Request Received</h2><p>Thank you ${passengerFirstName}! Confirmation Number: <strong>${confirmationCode}</strong></p>`;
    }

    html = html.replace('Payment Confirmation', 'Booking Request Received');
    html = html.replace('Payment Successfully Received', 'Booking Request Received');
    html = html.replace('Your payment has been successfully processed.', 'Your booking request has been received.');
    html = html.replace(/This temporary confirmation number is not the airline's final PNR[\s\S]*?processing\./g, '');

    const replacements = {
      '{{confirmationCode}}': confirmationCode,
      '{{passengerFirstName}}': passengerFirstName,
      '{{passengerName}}': passengerName,
      '{{currencySymbol}}': currencySymbol,
      '{{amountPaid}}': customerTotal,
      '{{currency}}': currency,
      '{{paymentMethod}}': 'Card Authorization Pending',
      '{{paymentDate}}': bookingDate,
      '{{passengerCount}}': passengerCount,
      '{{customerEmail}}': customerEmail,
      '{{outboundAirline}}': outboundSegs[0]?.carrier_name || booking.carrier || 'Commercial Airline',
      '{{outboundFlightNumber}}': outboundSegs[0]?.flight_number || 'Scheduled',
      '{{outboundOriginCity}}': outboundSegs[0]?.origin_city || outboundSegs[0]?.origin_airport || 'Origin',
      '{{outboundOriginCode}}': outboundSegs[0]?.origin_airport || 'DEP',
      '{{outboundDestinationCity}}': outboundSegs[outboundSegs.length - 1]?.destination_city || outboundSegs[0]?.destination_airport || 'Destination',
      '{{outboundDestinationCode}}': outboundSegs[outboundSegs.length - 1]?.destination_airport || 'ARR',
      '{{outboundDepartureDate}}': outboundSegs[0]?.departure_date || 'Scheduled',
      '{{outboundDepartureTime}}': outboundSegs[0]?.departure_time || 'Scheduled',
      '{{outboundArrivalDate}}': outboundSegs[0]?.arrival_date || 'Scheduled',
      '{{outboundArrivalTime}}': outboundSegs[0]?.arrival_time || 'Scheduled',
      '{{outboundCabin}}': outboundSegs[0]?.cabin || 'Economy',
      '{{outboundStops}}': outboundSegs.length > 1 ? `${outboundSegs.length - 1} Stop(s)` : 'Nonstop'
    };

    for (const [key, val] of Object.entries(replacements)) {
      html = html.replaceAll(key, val || '');
    }

    if (returnSegs.length > 0) {
      const returnReplacements = {
        '{{returnAirline}}': returnSegs[0]?.carrier_name || 'Commercial Airline',
        '{{returnFlightNumber}}': returnSegs[0]?.flight_number || 'Scheduled',
        '{{returnOriginCity}}': returnSegs[0]?.origin_city || returnSegs[0]?.origin_airport || 'Origin',
        '{{returnOriginCode}}': returnSegs[0]?.origin_airport || 'DEP',
        '{{returnDestinationCity}}': returnSegs[returnSegs.length - 1]?.destination_city || returnSegs[0]?.destination_airport || 'Destination',
        '{{returnDestinationCode}}': returnSegs[returnSegs.length - 1]?.destination_airport || 'ARR',
        '{{returnDepartureDate}}': returnSegs[0]?.departure_date || 'Scheduled',
        '{{returnDepartureTime}}': returnSegs[0]?.departure_time || 'Scheduled',
        '{{returnArrivalDate}}': returnSegs[0]?.arrival_date || 'Scheduled',
        '{{returnArrivalTime}}': returnSegs[0]?.arrival_time || 'Scheduled',
        '{{returnCabin}}': returnSegs[0]?.cabin || 'Economy',
        '{{returnStops}}': returnSegs.length > 1 ? `${returnSegs.length - 1} Stop(s)` : 'Nonstop'
      };
      for (const [key, val] of Object.entries(returnReplacements)) {
        html = html.replaceAll(key, val || '');
      }
    } else {
      html = html.replace(/\{\{#if hasReturnFlight\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    }

    html = html.replace(/\{\{[^}]+\\}\}/g, '');

    const textBody = `
THE FINAL SEAT — BOOKING REQUEST RECEIVED

Thank you, ${passengerFirstName}!

Your booking request has been received for processing.

TEMPORARY CONFIRMATION NUMBER: ${confirmationCode}

PASSENGER DETAILS:
Primary Passenger: ${passengerName}
Number of Passengers: ${passengerCount}
Contact Email: ${customerEmail}

IMPORTANT NOTICE:
This temporary confirmation number is not the airline's final PNR or electronic ticket. Final airline confirmation and ticket details will be sent separately after processing.

Track your booking request at: https://www.thefinalseat.com/my-bookings?code=${confirmationCode}
Support: +1 (213) 965-9727 | support@thefinalseat.com
    `.trim();

    const subject = `Booking Request Received — ${confirmationCode}`;
    const result = await sendViaResend({
      recipients: [customerEmail],
      subject,
      textBody,
      htmlBody: html,
      replyTo: 'support@thefinalseat.com'
    });

    const emailId = result?.messageId || `msg_${Date.now()}`;
    const sentAt = new Date().toISOString();

    await bookingRepository.updateBookingStatus(bookingId, {
      booking_request_email_status: 'SENT',
      booking_request_email_id: emailId,
      booking_request_email_sent_at: sentAt,
      booking_request_email_recipient: customerEmail,
      booking_request_email_error: null
    });

    logger.info(`[Email Log] bookingId=${bookingId} confirmationCode=${confirmationCode} emailType=booking_request recipient=${customerEmail} providerMessageId=${emailId} result=success`);

    return { success: true, emailId };
  } catch (err) {
    const errorMsg = err.message || 'Email dispatch failed';
    logger.error(`[Email Log] bookingId=${bookingId} emailType=booking_request result=failed error=${errorMsg}`);
    await bookingRepository.updateBookingStatus(bookingId, {
      booking_request_email_status: 'FAILED',
      booking_request_email_error: errorMsg
    });
    return { success: false, error: errorMsg };
  }
};

export const sendPassengerAuthorizationEmail = async (bookingId) => {
  try {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };

    const customerEmail = booking.email || booking.contacts?.[0]?.email || booking.travellers?.[0]?.email;
    if (!customerEmail || !customerEmail.includes('@')) {
      const errMsg = 'This booking does not have a valid passenger email address.';
      await bookingRepository.updateBookingStatus(bookingId, {
        authorization_email_status: 'FAILED',
        authorization_email_error: errMsg
      });
      return { success: false, error: errMsg };
    }

    const authResult = await passengerAuthorizationService.createAuthorizationToken(booking);
    const token = authResult.token;
    const authUrl = `https://www.thefinalseat.com/authorize/${token}`;

    const confirmationCode = booking.confirmation_code || 'TFS-PENDING';
    const passengerName = booking.passenger_name || 'Valued Passenger';
    const passengerFirstName = passengerName.split(' ')[0] || 'Passenger';
    const amount = parseFloat(booking.customer_price || booking.total_amount || 0).toFixed(2);
    const currency = booking.currency || 'USD';

    const subject = `Action Required — Authorize Booking ${confirmationCode}`;
    const textBody = `
THE FINAL SEAT — ACTION REQUIRED: AUTHORIZE FLIGHT RESERVATION

Dear ${passengerFirstName},

Please review and authorize your flight reservation ${confirmationCode} for a total charge of $${amount} ${currency}.

Click the secure authorization link below to confirm your itinerary:
${authUrl}

This single-use link expires in 24 hours.

Support 24/7: +1 (213) 965-9727 | support@thefinalseat.com
    `.trim();

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #7f0d2f; padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px;">The Final Seat</h1>
          <p style="margin: 4px 0 0; color: #e2b84d; font-size: 13px;">Passenger Authorization Request</p>
        </div>
        <div style="padding: 24px; color: #334155;">
          <h2 style="color: #7f0d2f; margin-top: 0;">Action Required: Authorize Reservation</h2>
          <p>Dear <strong>${passengerFirstName}</strong>,</p>
          <p>Please review and confirm your flight details for temporary confirmation <strong>${confirmationCode}</strong>. Total authorized charge: <strong>$${amount} ${currency}</strong>.</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${authUrl}" style="background-color: #7f0d2f; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; display: inline-block;">Review &amp; Authorize Booking &rarr;</a>
          </div>
          <p style="font-size: 12px; color: #64748b;">This secure, single-use authorization link expires in 24 hours. Your saved card will only be processed after you review and authorize.</p>
        </div>
      </div>
    `;

    const result = await sendViaResend({
      recipients: [customerEmail],
      subject,
      textBody,
      htmlBody,
      replyTo: 'support@thefinalseat.com'
    });

    const emailId = result?.messageId || `msg_${Date.now()}`;
    const sentAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await bookingRepository.updateBookingStatus(bookingId, {
      status: 'AWAITING_AUTHORIZATION',
      authorization_email_status: 'SENT',
      authorization_email_id: emailId,
      authorization_email_sent_at: sentAt,
      authorization_email_recipient: customerEmail,
      authorization_email_error: null,
      authorization_expires_at: expiresAt
    });

    logger.info(`[Email Log] bookingId=${bookingId} confirmationCode=${confirmationCode} emailType=authorization recipient=${customerEmail} providerMessageId=${emailId} result=success`);

    return { success: true, emailId, authUrl };
  } catch (err) {
    const errorMsg = err.message || 'Authorization email dispatch failed';
    logger.error(`[Email Log] bookingId=${bookingId} emailType=authorization result=failed error=${errorMsg}`);
    await bookingRepository.updateBookingStatus(bookingId, {
      authorization_email_status: 'FAILED',
      authorization_email_error: errorMsg
    });
    return { success: false, error: errorMsg };
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

We were unable to process your payment for Booking ID ${bookingReference}.

Reason: ${reason}

Your reservation remains on hold. Please retry your payment using the link below to confirm your flight:
${retryUrl}

If you require assistance, contact our 24/7 support desk:
Email: support@thefinalseat.com
Phone: +1 (213) 965-9727

The Final Seat LLC
    `.trim();

    const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
  <h2 style="color: #dc2626;">Payment Action Required</h2>
  <p>Dear ${customerName},</p>
  <p>We were unable to process your payment for Booking ID <strong>${bookingReference}</strong>.</p>
  <p style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px; color: #991b1b;">
    <strong>Details:</strong> ${reason}
  </p>
  <p>Please click the button below to retry your payment and secure your flight tickets:</p>
  <p style="text-align: center; margin: 24px 0;">
    <a href="${retryUrl}" style="background: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Retry Payment Now &rarr;</a>
  </p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
  <p style="font-size: 12px; color: #64748b;">
    The Final Seat LLC &middot; Support: support@thefinalseat.com | +1 (213) 965-9727
  </p>
</div>
    `.trim();

    let messageId = `failed_${Date.now()}`;
    if (env.resendApiKey?.trim()) {
      const res = await sendViaResend({
        recipients: [email],
        subject: `Payment Action Required — Booking ID ${bookingReference} | The Final Seat`,
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

export const sendFinalTicketEmail = async (bookingInput) => {
  try {
    const booking = typeof bookingInput === 'object' ? bookingInput : await bookingRepository.getById(bookingInput);
    if (!booking) return { success: false, error: 'Booking not found' };

    const customerEmail = booking.email || booking.customerEmail || booking.contacts?.[0]?.email || booking.travellers?.[0]?.email;
    if (!customerEmail || !customerEmail.includes('@')) {
      const errMsg = 'This booking does not have a valid passenger email address.';
      await bookingRepository.updateBookingStatus(booking.id, {
        final_confirmation_email_status: 'FAILED',
        final_confirmation_email_error: errMsg
      });
      return { success: false, error: errMsg };
    }

    const bookingReference = booking.confirmation_code || booking.bookingReference || booking.id;
    const passengerName = booking.passenger_name || booking.customerName || 'Valued Passenger';
    const passengerFirstName = passengerName.split(' ')[0] || 'Passenger';
    const amountPaid = parseFloat(booking.customer_price || booking.total_amount || 0).toFixed(2);
    const currency = (booking.currency || 'USD').toUpperCase();

    const relations = await bookingRepository.getRelations(booking.id);
    const flights = relations.flights || booking.flights || [];
    const travellers = relations.travellers || booking.travellers || [];

    const outboundFlight = flights.find(f => f.journey_direction === 'outbound') || flights[0] || {};
    const returnFlight = flights.find(f => f.journey_direction === 'return') || flights[1] || null;

    const subject = `Official Flight E-Ticket & Confirmation — Booking ID ${bookingReference} | The Final Seat`;

    const textBody = `
THE FINAL SEAT — OFFICIAL FLIGHT E-TICKET CONFIRMATION

Dear ${passengerFirstName},

Your flight ticket has been issued successfully. Below are your official booking and e-ticket details:

BOOKING ID: ${bookingReference}
Passenger: ${passengerName} (${travellers.length || 1} Traveler(s))
Contact Email: ${customerEmail}

FLIGHT ITINERARY:
Outbound: ${outboundFlight.carrier_name || outboundFlight.carrier || 'Commercial Airline'} #${outboundFlight.flight_number || '101'}
From: ${outboundFlight.origin_airport || 'DEP'} (${outboundFlight.departure_date || 'Scheduled'})
To: ${outboundFlight.destination_airport || 'ARR'} (${outboundFlight.arrival_date || 'Scheduled'})
Cabin: ${outboundFlight.cabin || 'Economy'}

${returnFlight ? `Return: ${returnFlight.carrier_name || returnFlight.carrier || 'Commercial Airline'} #${returnFlight.flight_number || '202'}
From: ${returnFlight.origin_airport || 'ARR'} (${returnFlight.departure_date || 'Scheduled'})
To: ${returnFlight.destination_airport || 'DEP'} (${returnFlight.arrival_date || 'Scheduled'})
Cabin: ${returnFlight.cabin || 'Economy'}
` : ''}
PAYMENT SUMMARY:
Total Amount Paid: $${amountPaid} ${currency}
Payment Status: PAID & VERIFIED

Thank you for choosing The Final Seat! Have a wonderful trip.

24/7 Support Desk: +1 (213) 965-9727 | support@thefinalseat.com
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f8f4f5; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(79,16,43,0.12); }
    .header { background: #7f0d2f; color: #ffffff; padding: 24px; text-align: center; }
    .header h2 { margin: 0; font-size: 24px; color: #ffffff; }
    .sub { color: #f8dfe8; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; margin-top: 4px; }
    .body { padding: 28px; }
    .ticket-badge { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 20px; color: #166534; font-weight: bold; }
    .box { background: #fffaf0; border: 1px dashed #e2b84d; border-radius: 12px; padding: 16px; text-align: center; margin: 16px 0; }
    .box-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8b6b16; font-weight: 700; }
    .box-code { font-size: 26px; font-weight: 800; color: #7f0d2f; margin: 4px 0; }
    .flight-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .flight-title { font-weight: bold; color: #1e3a5f; margin-bottom: 6px; font-size: 14px; }
    .footer { background: #fbf8f9; padding: 20px; text-align: center; font-size: 12px; color: #748596; border-top: 1px solid #eadfe3; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>✈ The Final Seat</h2>
      <div class="sub">Official E-Ticket & Confirmation</div>
    </div>
    <div class="body">
      <div class="ticket-badge">✓ E-Ticket Issued Successfully</div>
      <p style="font-size: 15px; color: #475569; line-height: 1.5;">
        Dear <strong>${passengerFirstName}</strong>,<br>
        Your flight booking is confirmed and ticketed. Below are your official reservation details:
      </p>

      <div class="box">
        <div class="box-title">Booking ID</div>
        <div class="box-code">${bookingReference}</div>
        <div style="font-size: 13px; color: #6b5b43;">Passenger: <strong>${passengerName}</strong></div>
      </div>

      <div class="flight-section">
        <div class="flight-title">🛫 Outbound Flight: ${outboundFlight.carrier_name || 'Commercial Airline'} #${outboundFlight.flight_number || '101'}</div>
        <div style="font-size: 13px; color: #475569; line-height: 1.6;">
          <strong>From:</strong> ${outboundFlight.origin_airport || 'DEP'} (${outboundFlight.departure_date || 'Scheduled'} ${outboundFlight.departure_time || ''})<br>
          <strong>To:</strong> ${outboundFlight.destination_airport || 'ARR'} (${outboundFlight.arrival_date || 'Scheduled'} ${outboundFlight.arrival_time || ''})<br>
          <strong>Cabin:</strong> ${outboundFlight.cabin || 'Economy'}
        </div>
      </div>

      ${returnFlight ? `
      <div class="flight-section">
        <div class="flight-title">🛬 Return Flight: ${returnFlight.carrier_name || 'Commercial Airline'} #${returnFlight.flight_number || '202'}</div>
        <div style="font-size: 13px; color: #475569; line-height: 1.6;">
          <strong>From:</strong> ${returnFlight.origin_airport || 'ARR'} (${returnFlight.departure_date || 'Scheduled'} ${returnFlight.departure_time || ''})<br>
          <strong>To:</strong> ${returnFlight.destination_airport || 'DEP'} (${returnFlight.arrival_date || 'Scheduled'} ${returnFlight.arrival_time || ''})<br>
          <strong>Cabin:</strong> ${returnFlight.cabin || 'Economy'}
        </div>
      </div>
      ` : ''}

      <div style="background: #f1f5f9; border-radius: 8px; padding: 12px; font-size: 13px; color: #334155; margin-top: 16px;">
        <strong>Payment Status:</strong> Paid &amp; Confirmed ($${amountPaid} ${currency})
      </div>
    </div>
    <div class="footer">
      The Final Seat LLC &middot; 24/7 Customer Support: support@thefinalseat.com &middot; +1 (213) 965-9727
    </div>
  </div>
</body>
</html>
    `.trim();

    let emailMessageId = `ticket_log_${Date.now()}`;
    if (env.resendApiKey?.trim()) {
      const result = await sendViaResend({
        recipients: [customerEmail],
        subject,
        textBody,
        htmlBody,
        replyTo: 'support@thefinalseat.com'
      });
      if (result?.messageId) emailMessageId = result.messageId;
    }

    const sentAt = new Date().toISOString();
    await bookingRepository.updateBookingStatus(booking.id, {
      final_confirmation_email_status: 'SENT',
      final_confirmation_email_id: emailMessageId,
      final_confirmation_email_sent_at: sentAt,
      final_confirmation_email_recipient: customerEmail,
      final_confirmation_email_error: null
    });

    logger.info(`[Email Log] bookingId=${booking.id} confirmationCode=${bookingReference} emailType=final_confirmation recipient=${customerEmail} providerMessageId=${emailMessageId} result=success`);
    return { success: true, emailId: emailMessageId, sentAt };
  } catch (err) {
    const errorMsg = err.message || 'Final ticket email dispatch failed';
    logger.error(`[Email Log] emailType=final_confirmation result=failed error=${errorMsg}`);
    if (typeof bookingInput === 'string' || bookingInput?.id) {
      const targetId = typeof bookingInput === 'string' ? bookingInput : bookingInput.id;
      await bookingRepository.updateBookingStatus(targetId, {
        final_confirmation_email_status: 'FAILED',
        final_confirmation_email_error: errorMsg
      });
    }
    return { success: false, error: errorMsg };
  }
};



