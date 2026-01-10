import express from 'express';
const router = express.Router();
import Razorpay from 'razorpay';
import { createHmac } from 'crypto';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_1234567890',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_secret_key'
});

// Create Razorpay order
router.post('/razorpay/create-order', async (req, res) => {
  try {
    const { amount, currency = 'USD' } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise/cents
      currency: currency,
      receipt: 'UT_' + Date.now(),
      notes: {
        booking_type: 'flight_booking',
        source: 'urgent_travel_website'
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Verify Razorpay payment
router.post('/razorpay/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const hmac = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_secret_key');
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      res.json({
        success: true,
        message: 'Payment verified successfully'
      });
    } else {
      res.status(400).json({ error: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

export default router;
