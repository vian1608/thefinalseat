const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_RECIPIENTS = [
  'support@thefinalseat.com',
  'viansaini1608@gmail.com',
];

function getRecipients() {
  const fromEnv = process.env.INQUIRY_NOTIFY_EMAILS;
  if (fromEnv) {
    return fromEnv.split(',').map((e) => e.trim()).filter(Boolean);
  }
  return DEFAULT_RECIPIENTS;
}

function buildInquiryText(inquiry) {
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

async function emailInquiry(inquiry) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { emailed: false };
  }

  const recipients = getRecipients();
  const isFlights = inquiry.serviceType === 'flights';
  const subjectLabel = isFlights
    ? 'Air Logistics Advisory'
    : 'Amtrak / Rail Logistics Advisory';
  const textBody = buildInquiryText(inquiry);
  const htmlBody = `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${textBody.replace(/\n/g, '<br>')}</div>`;
  const subject = `${subjectLabel} — ${inquiry.name}`;

  const sentTo = [];
  for (const to of recipients) {
    try {
      await sendViaResend({
        to,
        subject,
        textBody,
        htmlBody,
        replyTo: inquiry.email,
      });
      sentTo.push(to);
    } catch (err) {
      console.error(`Resend failed for ${to}:`, err.message);
    }
  }

  return { emailed: sentTo.length > 0, sentTo };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const {
      serviceType,
      name,
      email,
      phone,
      origin,
      destination,
      tripType,
      travelDate,
      returnDate,
      passengers,
      cabinClass,
      notes,
    } = req.body || {};

    if (!serviceType || !['flights', 'rail'].includes(serviceType)) {
      return res.status(400).json({
        success: false,
        error: 'serviceType must be "flights" or "rail".',
      });
    }

    if (!name?.trim() || !email?.trim() || !origin?.trim() || !destination?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, origin, and destination are required.',
      });
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.',
      });
    }

    const inquiry = {
      serviceType,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || '',
      origin: origin.trim(),
      destination: destination.trim(),
      tripType: tripType || '',
      travelDate: travelDate || '',
      returnDate: returnDate || '',
      passengers: passengers || '1',
      cabinClass: cabinClass || '',
      notes: notes?.trim() || '',
    };

    const { emailed } = await emailInquiry(inquiry);

    const customerMessage = emailed
      ? 'Thank you! Your consulting inquiry was submitted. Our team will contact you shortly.'
      : 'Thank you! Your inquiry was received. Our team will contact you shortly.';

    return res.status(201).json({
      success: true,
      message: customerMessage,
      emailed,
    });
  } catch (error) {
    console.error('Consulting inquiry error:', error);
    return res.status(500).json({
      success: false,
      error:
        'Unable to submit your inquiry right now. Please email support@thefinalseat.com directly.',
    });
  }
};
