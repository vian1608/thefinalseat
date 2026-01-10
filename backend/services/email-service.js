const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send booking confirmation email
async function sendBookingConfirmation(bookingData) {
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
      html: emailBody.replace(/\n/g, '<br>')
    };

    // Only send if email is configured
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } else {
      console.log('Email not configured, skipping send');
      return { success: true, message: 'Email not configured' };
    }
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = {
  sendBookingConfirmation
};
