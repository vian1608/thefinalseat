import express from 'express';
const router = express.Router();
import { sendBookingConfirmation } from '../services/email-service.mjs';

// In-memory bookings store (replace with database in production)
const bookings = [];

// Create booking
router.post('/', async (req, res) => {
  try {
    const bookingData = req.body;

    // Generate booking reference
    const bookingReference = 'UT' + Math.random().toString(36).substr(2, 8).toUpperCase();

    const booking = {
      id: Date.now().toString(),
      bookingReference,
      ...bookingData,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    bookings.push(booking);

    // Send confirmation email
    try {
      await sendBookingConfirmation(booking);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the booking if email fails
    }

    res.json({
      success: true,
      message: 'Booking confirmed successfully',
      data: booking
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get user bookings
router.get('/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userBookings = bookings.filter(b => b.userId === userId);
    res.json({ success: true, data: userBookings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get booking by reference
router.get('/:reference', (req, res) => {
  try {
    const { reference } = req.params;
    const booking = bookings.find(b => b.bookingReference === reference);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

export default router;
