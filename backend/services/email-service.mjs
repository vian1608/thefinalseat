import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INQUIRIES_FILE = path.join(__dirname, '../data/inquiries.jsonl');

const PLACEHOLDER_EMAIL_VALUES = [
  'your-email@gmail.com',
  'your-email-password',
  'your-app-password',
  '',
];

const DEFAULT_INQUIRY_RECIPIENTS = [
  'support@thefinalseat.com',
  'viansaini1608@gmail.com',
];

function getInquiryRecipients() {
  const fromEnv = process.env.INQUIRY_NOTIFY_EMAILS;
  if (fromEnv) {
    return fromEnv.split(',').map((e) => e.trim()).filter(Boolean);
  }
  return DEFAULT_INQUIRY_RECIPIENTS;
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

function buildConsultingInquiryText(inquiry) {
  const isFlights = inquiry.serviceType === 'flights';
  const lines = [
    `NEW ${isFlights ? 'AIR' : 'RAIL'} LOGISTICS CONSULTING INQUIRY`,
    'The Final Seat LLC',
    '',
    'CONTACT',
    '=======',
    `Name: ${inquiry.name}`,
    `Email: ${inquiry.email}`,
    `Phone: ${inquiry.phone || 'Not provided'}`,
    '',
    'ITINERARY',
    '=========',
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
    '',
    'ADVISORY NOTES',
    '==============',
    inquiry.notes || 'None',
    '',
    `Submitted: ${new Date().toLocaleString()}`,
    `Source: ${isFlights ? 'Flights landing page' : 'Amtrak / Rail landing page'}`,
  );

  return lines.join('\n');
}

async function sendViaResendOne({ to, subject, textBody, htmlBody, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM?.trim() ||
    'The Final Seat LLC <onboarding@resend.dev>';

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
  const apiKey = process.env.RESEND_API_KEY?.trim();
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
      console.log(`Resend sent to ${to}:`, messageId);
    } catch (err) {
      failures.push({ to, error: err.message });
      console.error(`Resend failed for ${to}:`, err.message);
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

export async function saveInquiryToFile(inquiry) {
  const record = { ...inquiry, receivedAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(INQUIRIES_FILE), { recursive: true });
  await fs.appendFile(INQUIRIES_FILE, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

export async function sendConsultingInquiry(inquiry) {
  const recipients = getInquiryRecipients();
  const isFlights = inquiry.serviceType === 'flights';
  const subjectLabel = isFlights
    ? 'Air Logistics Advisory'
    : 'Amtrak / Rail Logistics Advisory';
  const textBody = buildConsultingInquiryText(inquiry);
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

  if (process.env.RESEND_API_KEY?.trim()) {
    try {
      const result = await sendViaResend(payload);
      if (result?.sentTo?.length) {
        console.log('Consulting inquiry emailed via Resend →', result.sentTo.join(', '));
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
      console.error('Resend failed:', err.message);
    }
  }

  if (isSmtpConfigured()) {
    try {
      const result = await sendViaSmtp(payload);
      if (result) {
        console.log('Consulting inquiry emailed via SMTP →', recipients.join(', '));
        return { success: true, emailed: true, provider: 'smtp', messageId: result.messageId };
      }
    } catch (err) {
      errors.push(`SMTP: ${err.message}`);
      console.error('SMTP failed:', err.message);
    }
  }

  console.log('Consulting inquiry saved (email not sent). Details:\n', textBody);
  if (errors.length) console.error('Email errors:', errors.join('; '));

  return {
    success: true,
    emailed: false,
    message:
      'Inquiry received. Configure RESEND_API_KEY or Gmail SMTP in backend/.env to enable email delivery.',
    errors,
  };
}

// Send booking confirmation email
export async function sendBookingConfirmation(bookingData) {
  try {
    const flight = bookingData.flight || {};

    const emailBody = `
NEW FLIGHT BOOKING - URGENT TRAVEL

Booking Reference: ${bookingData.bookingReference}
Booking Date: ${new Date(bookingData.createdAt).toLocaleString()}

PASSENGER DETAILS:
==================
Name: ${bookingData.firstName} ${bookingData.lastName}
Email: ${bookingData.email}
Phone: ${bookingData.phone}
Date of Birth: ${bookingData.dateOfBirth}
Gender: ${bookingData.gender}
Nationality: ${bookingData.nationality}
Passport Number: ${bookingData.passportNumber}
Passport Expiry: ${bookingData.passportExpiry}

EMERGENCY CONTACT:
==================
Name: ${bookingData.emergencyName}
Phone: ${bookingData.emergencyPhone}
Relationship: ${bookingData.emergencyRelationship}

FLIGHT DETAILS:
===============
Airline: ${flight.airline}
Flight Number: ${flight.flightNumber}
Route: ${flight.departure?.airport} → ${flight.arrival?.airport}
Departure: ${flight.departure?.time} on ${flight.departure?.date}
Arrival: ${flight.arrival?.time} on ${flight.arrival?.date}
Duration: ${flight.duration}
Class: ${flight.class}
Stops: ${flight.stops === 0 ? 'Direct' : `${flight.stops} stop(s)`}

PRICING:
========
Subtotal: ${bookingData.subtotal || flight.price?.formatted}
Taxes: ${bookingData.taxes || '$0.00'}
Total: ${bookingData.total || flight.price?.formatted}

PAYMENT:
========
Method: ${bookingData.paymentMethod || 'N/A'}
Status: ${bookingData.paymentStatus || 'Pending'}

SPECIAL NOTES:
==============
Urgent Booking: ${flight.isUrgent ? 'Yes' : 'No'}
Source: Urgent Travel Website

---
This booking was made through the Urgent Travel website.
Please contact the passenger directly for any queries.
    `.trim();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL || bookingData.email,
      subject: `New Flight Booking - ${bookingData.bookingReference}`,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br>'),
    };

    if (isSmtpConfigured()) {
      const transporter = getTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    }

    console.log('Email not configured, skipping send');
    return { success: true, message: 'Email not configured' };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

export default {
  sendBookingConfirmation,
  sendConsultingInquiry,
  saveInquiryToFile,
};
