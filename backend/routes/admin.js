const express = require('express');
const router = express.Router();

// In-memory admin credentials (replace with database in production)
const ADMIN_CREDENTIALS = {
  email: 'admin@urgenttravel.com',
  password: 'admin123' // Change this in production!
};

// In-memory bookings store (should be shared with bookings route)
// In production, use a database
let allBookings = [];

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
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get all bookings
router.get('/bookings', (req, res) => {
  try {
    res.json({
      success: true,
      data: allBookings,
      count: allBookings.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get booking statistics
router.get('/stats', (req, res) => {
  try {
    const stats = {
      totalBookings: allBookings.length,
      confirmedBookings: allBookings.filter(b => b.status === 'confirmed').length,
      totalRevenue: allBookings.reduce((sum, b) => {
        const price = parseFloat(b.total?.replace('$', '') || 0);
        return sum + price;
      }, 0),
      urgentBookings: allBookings.filter(b => b.flight?.isUrgent).length
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
