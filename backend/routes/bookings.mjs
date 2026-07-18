import express from 'express';
const router = express.Router();
import {
  createBooking,
  getBookingByCode,
  getBookingById,
  getBookingsByEmail,
  searchBookings,
  saveAbandonedBooking,
  deleteAbandonedBooking,
} from '../services/supabase-booking-service.mjs';
import { sendBookingConfirmation } from '../services/email-service.mjs';

// ─── Helper ───────────────────────────────────────────────────────────────────
function calculateAge(dobString) {
  if (!dobString) return 0;
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// ─── SEARCH bookings by code / email / name ───────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Search query parameter is required.' });

    const bookings = await searchBookings(query);
    res.json({ success: true, data: bookings });
  } catch (error) {
    console.error('Search bookings error:', error);
    res.status(500).json({ error: 'Failed to search bookings.' });
  }
});

// ─── GET bookings by user email ───────────────────────────────────────────────
router.get('/user/:email', async (req, res) => {
  try {
    const bookings = await getBookingsByEmail(req.params.email);
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user bookings.' });
  }
});

// ─── CREATE new flight booking ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      customerName,
      email,
      phone,
      passengers,
      flight,
      returnFlight,
      originalApiPrice,
      displayedWebsitePrice,
      paymentStatus,
      transactionId,
      currency = 'USD',
      status = 'PENDING',
      specialRequests,
      billingAddress,
    } = req.body || {};

    // ── Validation ────────────────────────────────────────────
    if (!customerName || !email || !phone || !passengers || !flight || !displayedWebsitePrice) {
      return res.status(400).json({ error: 'Missing required booking fields.' });
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid primary email address.' });
    }

    const passengerList = Array.isArray(passengers) ? passengers : JSON.parse(passengers || '[]');
    if (passengerList.length === 0) {
      return res.status(400).json({ error: 'At least one passenger must be listed.' });
    }

    // Passenger age rules
    for (const traveler of passengerList) {
      const age = calculateAge(traveler.dateOfBirth);
      const role = (traveler.role || 'adult').toLowerCase();
      if (role === 'adult' && age < 18 && age > 0) {
        return res.status(400).json({
          error: `Passenger ${traveler.firstName} ${traveler.lastName} is marked as Adult but is under 18.`,
        });
      }
    }

    // ── Create in Supabase ────────────────────────────────────
    const newBooking = await createBooking({
      customerName,
      email,
      phone,
      passengers: passengerList,
      flight,
      returnFlight,
      transactionId,
      displayedWebsitePrice,
      originalApiPrice,
      currency,
      status,
      paymentStatus: paymentStatus || 'paid',
      specialRequests,
      billingAddress,
    });

    // ── Send confirmation email (non-blocking) ────────────────
    sendBookingConfirmation(newBooking).catch(err =>
      console.error('Confirmation email error:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Booking request created successfully.',
      data: newBooking,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit booking request.' });
  }
});

// ─── SAVE abandoned / in-progress booking ─────────────────────────────────────
router.post('/abandoned', async (req, res) => {
  try {
    const result = await saveAbandonedBooking(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Abandoned booking error:', error);
    res.status(500).json({ error: 'Failed to save abandoned booking.' });
  }
});

// ─── DELETE abandoned booking (on successful payment) ─────────────────────────
router.delete('/abandoned/:sessionKey', async (req, res) => {
  try {
    await deleteAbandonedBooking(req.params.sessionKey);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete abandoned booking.' });
  }
});

// ─── GET booking by confirmation code ─────────────────────────────────────────
router.get('/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    // Try as confirmation code first, then as UUID id
    let booking = await getBookingByCode(reference.toUpperCase());
    if (!booking) {
      booking = await getBookingById(reference);
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking details.' });
  }
});

export default router;
