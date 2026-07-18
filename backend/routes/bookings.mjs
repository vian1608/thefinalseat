import express from 'express';
const router = express.Router();
import Booking from '../models/booking/Booking.mjs';
import { sendBookingConfirmation } from '../services/email-service.mjs';

// Helper to generate reference: TFS-YYYYMMDD-XXXX
function generateBookingReference() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `TFS-${dateStr}-${randomDigits}`;
}

// Helper to calculate age in years from DOB string
function calculateAge(dobString) {
  if (!dobString) return 0;
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Create new flight booking in SQL DB
router.post('/', async (req, res) => {
  try {
    const { customerName, email, phone, passengers, flight, originalApiPrice, displayedWebsitePrice, paymentStatus, transactionId } = req.body || {};

    // 1. Basic Required Validation
    if (!customerName || !email || !phone || !passengers || !flight || !originalApiPrice || !displayedWebsitePrice) {
      return res.status(400).json({ error: 'Missing required booking fields.' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid primary email address.' });
    }

    // 2. Validate Passenger Count matches
    const passengerList = Array.isArray(passengers) ? passengers : JSON.parse(passengers || '[]');
    if (passengerList.length === 0) {
      return res.status(400).json({ error: 'At least one passenger must be listed on the booking.' });
    }

    // 3. Passenger Age Rules Validation
    for (const traveler of passengerList) {
      const age = calculateAge(traveler.dateOfBirth);
      const role = (traveler.role || 'adult').toLowerCase(); // 'adult', 'child', 'infant'
      
      if (role === 'adult' && age < 18) {
        return res.status(400).json({
          error: `Passenger ${traveler.firstName} ${traveler.lastName} is marked as Adult but is under 18 years old (Age: ${age}).`
        });
      }
      if (role === 'child' && (age < 2 || age >= 18)) {
        return res.status(400).json({
          error: `Passenger ${traveler.firstName} ${traveler.lastName} is marked as Child but age is ${age} (Must be between 2 and 17).`
        });
      }
      if (role === 'infant' && age >= 2) {
        return res.status(400).json({
          error: `Passenger ${traveler.firstName} ${traveler.lastName} is marked as Infant but is ${age} years old (Must be under 2).`
        });
      }
    }

    // 4. Verify payment status with Stripe (if not mock testing)
    let amountPaid = displayedWebsitePrice;
    if (transactionId && transactionId !== 'mock-transaction') {
      try {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${transactionId}`, {
          headers: { 'Authorization': `Bearer ${secretKey}` }
        });
        if (!stripeRes.ok) {
          return res.status(400).json({ error: 'Failed to verify transaction with Stripe.' });
        }
        const session = await stripeRes.json();
        if (session.payment_status !== 'paid') {
          return res.status(400).json({ error: 'Stripe payment has not been successfully processed.' });
        }
        amountPaid = session.amount_total / 100;
      } catch (stripeErr) {
        console.error('Stripe verification failed:', stripeErr.message);
        return res.status(400).json({ error: 'Stripe gateway validation failed.' });
      }
    }

    // 5. Generate reference code
    const bookingReference = generateBookingReference();

    // 6. Create Booking in MySQL database
    const newBooking = await Booking.create({
      bookingReference,
      bookingDate: new Date(),
      customerName,
      email,
      phone,
      passengers: passengerList,
      flight: typeof flight === 'string' ? JSON.parse(flight) : flight,
      originalApiPrice: parseFloat(originalApiPrice),
      displayedWebsitePrice: parseFloat(amountPaid),
      paymentStatus: paymentStatus || 'paid',
      transactionId: transactionId || '',
      bookingStatus: 'pending', // Default is pending confirmation
      internalNotes: ''
    });

    // 6. Send confirmation emails asynchronously
    try {
      await sendBookingConfirmation(newBooking);
    } catch (emailError) {
      console.error('Failed to send booking confirmation email:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Booking request created successfully.',
      data: newBooking
    });
  } catch (error) {
    console.error('Create booking endpoint error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit booking request.' });
  }
});

// Get user bookings by email
router.get('/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const userBookings = await Booking.findAll({
      where: { email },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: userBookings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user bookings' });
  }
});

// Get booking by reference
router.get('/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const booking = await Booking.findOne({
      where: { bookingReference: reference }
    });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

export default router;
