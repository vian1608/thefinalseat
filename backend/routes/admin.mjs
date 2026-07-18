import express from 'express';
const router = express.Router();
import {
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  getStats,
} from '../services/supabase-booking-service.mjs';

// ─── Admin Credentials (env-based) ───────────────────────────────────────────
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@thefinalseat.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ─── Admin Login ──────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      res.json({ success: true, message: 'Admin login successful', admin: { email } });
    } else {
      res.status(401).json({ error: 'Invalid admin credentials.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

// ─── Get All Bookings (with optional filters) ─────────────────────────────────
router.get('/bookings', async (req, res) => {
  try {
    const { reference, name, email, date, status } = req.query;
    const bookings = await getAllBookings({ reference, name, email, date, status });
    res.json({ success: true, data: bookings, count: bookings.length });
  } catch (error) {
    console.error('Admin fetch bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
});

// ─── Get Detailed Booking by ID ───────────────────────────────────────────────
router.get('/bookings/:id', async (req, res) => {
  try {
    const booking = await getBookingById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve booking.' });
  }
});

// ─── Update Booking (status, notes, passenger name, email, phone) ─────────────
router.put('/bookings/:id', async (req, res) => {
  try {
    const { bookingStatus, internalNotes, customerName, email, phone } = req.body || {};
    const updated = await updateBookingStatus(req.params.id, {
      status: bookingStatus,
      internal_notes: internalNotes,
      passenger_name: customerName,
      email,
      phone,
    });
    res.json({ success: true, message: 'Booking updated.', data: updated });
  } catch (error) {
    console.error('Admin update error:', error);
    res.status(500).json({ error: 'Failed to update booking.' });
  }
});

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
});

export default router;
