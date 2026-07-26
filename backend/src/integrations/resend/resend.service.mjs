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
  const from = env.resendFrom?.trim();

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

  for (const to of recipients) {
    try {
      const messageId = await sendViaResendOne({
        to,
        subject,
        textBody,
        htmlBody,
        replyTo,
      });
      sentTo.push(to);
      logger.info(`Resend sent to ${to}:`, messageId);
    } catch (err) {
      failures.push({ to, error: err.message });
      logger.error(`Resend failed for ${to}:`, err.message);
    }
  }

  if (sentTo.length > 0) {
    return { provider: 'resend', messageId: sentTo.join(','), sentTo, failures };
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

export const sendBookingConfirmation = async (booking, options = {}) => {
  try {
    const bookingId = booking.id || booking.booking_id;
    const sentAt = booking.confirmation_email_sent_at || booking.confirmationEmailSentAt;

    // Idempotency check: Skip duplicate sends unless forced (e.g. admin action)
    if (sentAt && !options.force) {
      logger.info(`[Email] Skipping duplicate confirmation email for booking ${bookingId} (already sent at ${sentAt})`);
      return { success: true, duplicate: true, sentAt };
    }

    const flight = booking.flight || booking.flight_details || booking.outbound_flight || {};
    const returnFlight = booking.returnFlight || booking.return_flight || null;
    const rawPassengers = booking.passengers || booking.traveller_details || booking.travellers;
    const passengers = Array.isArray(rawPassengers)
      ? rawPassengers
      : (typeof rawPassengers === 'string' ? JSON.parse(rawPassengers || '[]') : []);

    const firstPassenger = passengers[0] || {};
    const firstName = firstPassenger.firstName || firstPassenger.first_name || (booking.customerName || booking.passenger_name || 'Customer').split(' ')[0];
    const customerName = booking.customerName || booking.passenger_name || `${firstPassenger.firstName || ''} ${firstPassenger.lastName || ''}`.trim() || 'Valued Customer';
    const bookingReference = booking.bookingReference || booking.confirmation_code || booking.confirmationCode || 'TFS-PENDING';
    
    const customerPrice = parseFloat(booking.customer_price || booking.displayedWebsitePrice || booking.total_amount || booking.amount || 0);
    const supplierPrice = parseFloat(booking.supplier_price || booking.original_api_price || customerPrice);
    const discountAmount = parseFloat(booking.discount_amount || Math.max(0, supplierPrice - customerPrice));
    
    const transactionId = booking.transactionId || booking.provider_payment_id || booking.payment_reference || 'Verified';
    const paymentProvider = (booking.payment_provider || booking.paymentProvider || 'Card (Whop Encrypted)').toUpperCase();
    const bookingDate = booking.bookingDate || booking.created_at || new Date().toISOString();
    const email = booking.email || booking.customerEmail || '';
    const phone = booking.phone || booking.customerPhone || '';
    const frontendUrl = env.frontendUrl || 'https://thefinalseat.com';

    const carrierName = booking.carrier || booking.airline || flight.airline || flight.carrier || 'Commercial Airline';
    const flightNumber = flight.flight_number || flight.flightNumber || flight.number || 'Scheduled';
    const origin = flight.origin_code || flight.departure_airport || flight.departure?.airport || flight.departureAirport || 'DEP';
    const destination = flight.destination_code || flight.arrival_airport || flight.arrival?.airport || flight.arrivalAirport || 'ARR';
    const departureTime = flight.departure_time || flight.departure?.time || flight.departure?.date || 'Scheduled';
    const cabinClass = flight.cabin_class || flight.class || 'Economy';

    const passengerTextLines = passengers.length > 0
      ? passengers.map((p, i) => {
          const fn = p.firstName || p.first_name || '';
          const ln = p.lastName || p.last_name || '';
          const dob = p.dateOfBirth || p.date_of_birth || 'N/A';
          const gen = p.gender || 'N/A';
          const pass = p.passportNumber || p.passport_number ? `, Passport: ${p.passportNumber || p.passport_number}` : '';
          return `${i + 1}. ${fn} ${ln} (DOB: ${dob}, Gender: ${gen}${pass})`;
        }).join('\n')
      : `1. ${customerName}`;

    // Plaintext Body
    const customerTextBody = `
====================================================
THE FINAL SEAT — TEMPORARY RESERVATION CONFIRMATION
====================================================

Dear ${firstName},

Thank you! Your payment of $${customerPrice.toFixed(2)} USD has been successfully received.

TEMPORARY CONFIRMATION NUMBER: ${bookingReference}

A confirmation email has been sent to ${email}. Please keep your temporary confirmation number for tracking your reservation. Your final electronic ticket and airline confirmation details will be emailed after fulfilment is completed.

NOTICE:
This email serves as a temporary reservation confirmation and receipt for your payment. It is NOT the airline's final electronic ticket number or PNR. Your official electronic ticket and airline confirmation details will be dispatched in a separate email once manual fulfilment is completed by our travel team.

====================================================
PAYMENT & RESERVATION RECEIPT
====================================================
Temporary Confirmation Number: ${bookingReference}
Payment Status: PAID & CONFIRMED
Amount Paid (Customer Total): $${customerPrice.toFixed(2)} USD
Supplier Airfare: $${supplierPrice.toFixed(2)} USD
Final Seat Subsidy (10% OFF): -$${discountAmount.toFixed(2)} USD
Payment Method: ${paymentProvider}
Transaction Reference: ${transactionId}
Booking Date: ${new Date(bookingDate).toLocaleString()}

FLIGHT ITINERARY:
Airline / Operator: ${carrierName}
Flight Number: ${flightNumber}
Route: ${origin} to ${destination}
Departure Date/Time: ${departureTime}
Cabin Class: ${cabinClass}
Travelers: ${passengers.length || 1}

PASSENGER MANIFEST:
${passengerTextLines}

WHAT HAPPENS NEXT:
1. Our travel specialists are verifying your passenger credentials and securing ticket issuance with the airline.
2. Once issued, your official airline PNR & Electronic Ticket document will be sent to ${email}.
3. You can check your booking status anytime at: ${frontendUrl}/my-bookings

Need immediate support? Contact us 24/7:
Email: support@thefinalseat.com
Phone: +1 (888) 210-8656

The Final Seat LLC · 5830 E 2nd St, Ste 7000, Casper, WY 82609
    `.trim();

    // HTML Email Template with Premium Branding
    const customerHtmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6fa; margin: 0; padding: 20px; color: #0f172a; }
    .email-card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(15,23,42,0.08); }
    .email-header { background: linear-gradient(135deg, #0f2744 0%, #1e3a5f 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
    .brand-title { font-size: 22px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin: 0 0 6px; }
    .brand-sub { font-size: 13px; color: rgba(255,255,255,0.75); margin: 0; }
    .email-body { padding: 28px; }
    .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; }
    .success-pill { display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-weight: 700; font-size: 13px; padding: 6px 16px; border-radius: 20px; margin: 12px 0 20px; }
    .ref-box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
    .ref-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; font-weight: 700; margin-bottom: 4px; }
    .ref-code { font-size: 24px; font-weight: 800; color: #1e3a5f; letter-spacing: 0.05em; margin: 0; }
    .breakdown-card { background: #fafbfd; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    .breakdown-title { font-size: 14px; font-weight: 700; color: #1e3a5f; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }
    .row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; color: #475569; }
    .row--total { border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 10px; font-size: 16px; font-weight: 800; color: #0f172a; }
    .row--discount { color: #047857; font-weight: 700; }
    .itinerary-card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    .itinerary-header { font-size: 13px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px; }
    .disclaimer-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 24px; color: #92400e; font-size: 13px; line-height: 1.6; }
    .disclaimer-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #78350f; display: block; }
    .cta-button { display: block; width: 100%; text-align: center; background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%); color: #ffffff !important; text-decoration: none; padding: 14px 20px; border-radius: 10px; font-weight: 700; font-size: 15px; box-sizing: border-box; margin-bottom: 24px; }
    .manifest-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
    .manifest-table th { background: #f1f5f9; text-align: left; padding: 8px 10px; color: #475569; font-weight: 700; }
    .manifest-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; background: #fafbfd; }
  </style>
</head>
<body>
  <div class="email-card">
    <div class="email-header">
      <div class="brand-title">The Final Seat</div>
      <div class="brand-sub">Instant Electronic Ticketing &amp; Travel Logistics</div>
    </div>
    
    <div class="email-body">
      <h2 class="greeting">Thank you, ${firstName}!</h2>
      <p style="font-size: 15px; color: #334155; margin-top: 4px; line-height: 1.6;">
        Your payment has been successfully received. We are currently processing your reservation request.
      </p>
      
      <div class="success-pill">✓ Payment Status: PAID &amp; CONFIRMED</div>
      
      <div class="ref-box">
        <div class="ref-label">Temporary Confirmation Number</div>
        <div class="ref-code">${bookingReference}</div>
      </div>
      
      <!-- Critical Disclaimer Box -->
      <div class="disclaimer-box">
        <span class="disclaimer-title">⚠️ Temporary Reservation Notice</span>
        This email serves as a <strong>temporary reservation confirmation and receipt for your payment</strong>. It is not the airline's final electronic ticket number or PNR. Your official electronic ticket and airline confirmation details will be emailed after manual fulfilment is completed by our travel specialists.
      </div>
      
      <!-- Receipt & Breakdown -->
      <div class="breakdown-card">
        <div class="breakdown-title">Payment &amp; Fare Receipt</div>
        <div class="row">
          <span>Supplier Airfare</span>
          <span style="text-decoration: line-through;">$${supplierPrice.toFixed(2)} USD</span>
        </div>
        ${discountAmount > 0 ? `
        <div class="row row--discount">
          <span>Final Seat Subsidy (10% OFF)</span>
          <span>-$${discountAmount.toFixed(2)} USD</span>
        </div>` : ''}
        <div class="row row--total">
          <span>Total Customer Amount Paid</span>
          <span style="color: #0f172a;">$${customerPrice.toFixed(2)} USD</span>
        </div>
        <div class="row" style="margin-top: 12px; font-size: 13px;">
          <span>Payment Gateway</span>
          <strong>${paymentProvider}</strong>
        </div>
        <div class="row" style="font-size: 13px;">
          <span>Transaction Reference</span>
          <code>${transactionId}</code>
        </div>
      </div>
      
      <!-- Itinerary Summary -->
      <div class="itinerary-card">
        <div class="itinerary-header">Flight Itinerary — ${carrierName}</div>
        <div class="row">
          <span>Route</span>
          <strong>${origin} &rarr; ${destination}</strong>
        </div>
        <div class="row">
          <span>Flight Number</span>
          <strong>${flightNumber}</strong>
        </div>
        <div class="row">
          <span>Departure Time</span>
          <strong>${departureTime}</strong>
        </div>
        <div class="row">
          <span>Cabin Class</span>
          <strong>${cabinClass}</strong>
        </div>
      </div>
      
      <!-- Passenger Manifest -->
      ${passengers.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; margin-bottom: 8px;">Passenger Manifest</div>
        <table class="manifest-table">
          <thead>
            <tr><th>#</th><th>Passenger Name</th><th>DOB</th><th>Gender</th></tr>
          </thead>
          <tbody>
            ${passengers.map((p, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${p.firstName || p.first_name} ${p.lastName || p.last_name}</strong></td>
                <td>${p.dateOfBirth || p.date_of_birth || 'N/A'}</td>
                <td style="text-transform: capitalize;">${p.gender || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <!-- Next Steps & Action CTA -->
      <a href="${frontendUrl}/my-bookings" class="cta-button">View My Booking on The Final Seat &rarr;</a>
      
      <div style="font-size: 13px; color: #64748b; line-height: 1.6; text-align: center;">
        Need assistance or changes? Contact our 24/7 travel desk:<br>
        <strong>Email:</strong> <a href="mailto:support@thefinalseat.com" style="color: #1e3a5f;">support@thefinalseat.com</a> &middot; 
        <strong>Phone:</strong> <a href="tel:+18882108656" style="color: #1e3a5f;">+1 (888) 210-8656</a>
      </div>
    </div>
    
    <div class="footer">
      The Final Seat LLC &middot; 5830 E 2nd St, Ste 7000, Casper, WY 82609<br>
      &copy; ${new Date().getFullYear()} The Final Seat LLC. All rights reserved.
    </div>
  </div>
</body>
</html>
    `.trim();

    let emailMessageId = `log_${Date.now()}`;
    let emailResult = null;

    // Send email using configured Resend API or Nodemailer SMTP
    if (env.resendApiKey?.trim()) {
      try {
        emailResult = await sendViaResend({
          recipients: [email],
          subject: `Temporary Reservation Confirmation — ${bookingReference} | The Final Seat`,
          textBody: customerTextBody,
          htmlBody: customerHtmlBody,
          replyTo: 'support@thefinalseat.com',
        });
        if (emailResult && emailResult.messageId) {
          emailMessageId = emailResult.messageId;
        }
      } catch (rErr) {
        logger.error(`Resend email error for booking ${bookingId}:`, rErr.message);
      }
    } else if (isSmtpConfigured()) {
      try {
        const transporter = getTransporter();
        const info = await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: `Temporary Reservation Confirmation — ${bookingReference} | The Final Seat`,
          text: customerTextBody,
          html: customerHtmlBody,
        });
        emailMessageId = info.messageId || emailMessageId;
        logger.info(`SMTP confirmation email sent to ${email} for booking ${bookingReference}`);
      } catch (sErr) {
        logger.error(`SMTP email error for booking ${bookingId}:`, sErr.message);
      }
    } else {
      logger.warn(`No email API key / SMTP configured. Confirmation email for ${bookingReference} printed to logs.`);
    }

    // Mark email sent idempotently in Supabase DB so duplicate webhooks do not trigger re-sends
    if (bookingId) {
      await bookingRepository.markConfirmationEmailSent(bookingId, emailMessageId);
    }

    return { success: true, emailId: emailMessageId };

  } catch (error) {
    logger.error('[Email] Non-blocking error in sendBookingConfirmation:', error.message);
    // Return gracefully without throwing so payment capture is never reversed by email errors
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


