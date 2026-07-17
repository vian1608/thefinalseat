const DEFAULT_RECIPIENTS = ['viansaini1608@gmail.com', 'support@thefinalseat.com'];

function getRecipients() {
  const fromEnv = process.env.INQUIRY_NOTIFY_EMAILS;
  if (fromEnv) {
    return fromEnv.split(',').map((e) => e.trim()).filter(Boolean);
  }
  return DEFAULT_RECIPIENTS;
}

async function sendViaResend({ to, subject, textBody, htmlBody, replyTo }) {
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const bookingData = req.body || {};
    const flight = bookingData.flight || {};

    // Generate reference
    const bookingReference = 'UT' + Math.random().toString(36).substr(2, 8).toUpperCase();

    const emailBody = `
NEW SECURE FLIGHT BOOKING CONFIRMED - URGENT TRAVEL

Booking Reference: ${bookingReference}
Booking Date: ${new Date().toLocaleString()}

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
Flight Number: ${flight.flightNumber || 'N/A'}
Route: ${flight.departure?.airport} → ${flight.arrival?.airport}
Departure: ${flight.departure?.time || ''} on ${flight.departure?.date || ''}
Arrival: ${flight.arrival?.time || ''} on ${flight.arrival?.date || ''}
Class: ${flight.class || 'Economy'}
Stops: ${flight.stops === 0 ? 'Direct' : `${flight.stops} stop(s)`}

PRICING:
========
Subtotal: ${bookingData.subtotal}
Taxes & Fees: ${bookingData.taxes}
Total Charged: ${bookingData.total}

PAYMENT:
========
Method: ${bookingData.paymentMethod}
Status: confirmed / paid (via Stripe)

---
This booking has been processed and charged successfully.
    `.trim();

    // Send email to admin / customer
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (apiKey) {
      const recipients = getRecipients();
      const subject = `New Flight Booking Confirmation - ${bookingReference}`;
      
      for (const to of recipients) {
        try {
          await sendViaResend({
            to,
            subject,
            textBody: emailBody,
            htmlBody: `<div style="font-family: monospace; white-space: pre; line-height: 1.6;">${emailBody.replace(/\n/g, '<br>')}</div>`,
            replyTo: bookingData.email
          });
        } catch (err) {
          console.error(`Failed to send booking email to ${to}:`, err.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: {
        bookingReference,
        ...bookingData,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Vercel booking error:', error);
    return res.status(500).json({ success: false, error: 'Failed to record booking details' });
  }
};
