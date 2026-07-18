import express from 'express';
const router = express.Router();
import { Op } from 'sequelize';
import Booking from '../models/booking/Booking.mjs';

// In-memory admin credentials (used for simple login protection)
const ADMIN_CREDENTIALS = {
  email: 'admin@urgenttravel.com',
  password: 'admin123'
};

// Admin login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      res.json({
        success: true,
        message: 'Admin login successful',
        admin: { email }
      });
    } else {
      res.status(401).json({ error: 'Invalid admin credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to authenticate admin' });
  }
});

// Get bookings with search filters and status filtering
router.get('/bookings', async (req, res) => {
  try {
    const { reference, name, email, date, status } = req.query;
    const whereConditions = {};

    if (reference) {
      whereConditions.bookingReference = { [Op.like]: `%${reference}%` };
    }
    if (name) {
      whereConditions.customerName = { [Op.like]: `%${name}%` };
    }
    if (email) {
      whereConditions.email = { [Op.like]: `%${email}%` };
    }
    if (status) {
      whereConditions.bookingStatus = status;
    }
    if (date) {
      // Find bookings on that specific date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      whereConditions.createdAt = {
        [Op.between]: [startOfDay, endOfDay]
      };
    }

    const bookings = await Booking.findAll({
      where: whereConditions,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: bookings,
      count: bookings.length
    });
  } catch (error) {
    console.error('Admin fetch bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings list from database.' });
  }
});

// Fetch detailed booking by SQL ID
router.get('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve booking detail.' });
  }
});

// Update booking status, internal notes, or traveler details
router.put('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { bookingStatus, internalNotes, passengers, customerName, email, phone } = req.body || {};

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Update fields if provided in request body
    if (bookingStatus) booking.bookingStatus = bookingStatus;
    if (internalNotes !== undefined) booking.internalNotes = internalNotes;
    if (passengers) booking.passengers = passengers;
    if (customerName) booking.customerName = customerName;
    if (email) booking.email = email;
    if (phone) booking.phone = phone;

    await booking.save();

    res.json({
      success: true,
      message: 'Booking details updated successfully.',
      data: booking
    });
  } catch (error) {
    console.error('Admin update booking error:', error);
    res.status(500).json({ error: 'Failed to update booking details.' });
  }
});

// Fetch stats dashboard metrics (Pending, Confirmed, Cancelled, Completed counts + revenue)
router.get('/stats', async (req, res) => {
  try {
    const bookings = await Booking.findAll();
    
    const stats = {
      totalBookings: bookings.length,
      pendingCount: bookings.filter(b => b.bookingStatus === 'pending').length,
      confirmedCount: bookings.filter(b => b.bookingStatus === 'confirmed').length,
      cancelledCount: bookings.filter(b => b.bookingStatus === 'cancelled').length,
      completedCount: bookings.filter(b => b.bookingStatus === 'completed').length,
      totalRevenue: bookings
        .filter(b => b.paymentStatus === 'paid' && b.bookingStatus !== 'cancelled')
        .reduce((sum, b) => sum + parseFloat(b.displayedWebsitePrice || 0), 0)
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Admin stats retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve stats dashboard metrics.' });
  }
});

export default router;
