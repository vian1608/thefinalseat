import express from 'express';
const router = express.Router();

// Import all route modules
import flightsRouter from './flights.mjs';
import airportsRouter from './airports.mjs';
import authRouter from './Users/Users.mjs';
import bookingsRouter from './bookings.mjs';
import adminRouter from './admin.mjs';
import paymentsRouter from './payments.mjs';
import inquiriesRouter from './inquiries.mjs';

// Mount all routes
router.use('/flights', flightsRouter);
router.use('/airports', airportsRouter);
router.use('/auth', authRouter);
router.use('/bookings', bookingsRouter);
router.use('/admin', adminRouter);
router.use('/payments', paymentsRouter);
router.use('/inquiries', inquiriesRouter);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Urgent Travel API is running',
    timestamp: new Date().toISOString()
  });
});

export default router;
