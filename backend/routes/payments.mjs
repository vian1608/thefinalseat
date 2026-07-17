import express from 'express';
const router = express.Router();
import Razorpay from 'razorpay';
import { createHmac } from 'crypto';
import axios from 'axios';

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

// --- STRIPE ENDPOINTS ---

// Get Stripe Publishable Key
router.get('/stripe/config', (req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return res.status(500).json({ error: 'Stripe publishable key is not configured' });
  }
  res.json({ publishableKey });
});

// Create Stripe Checkout Session
router.post('/stripe/create-checkout-session', async (req, res) => {
  try {
    const { type, email, amount, name, phone, origin, destination, notes, planName, planDescription, flight, passenger } = req.body;

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: 'Stripe secret key is not configured' });
    }

    if (!amount || !type || !email) {
      return res.status(400).json({ error: 'Missing required parameters: amount, type, and email' });
    }

    const hostOrigin = req.headers.origin || 'http://localhost:3000';

    const params = new URLSearchParams();
    params.append('payment_method_types[0]', 'card');
    params.append('mode', 'payment');
    params.append('customer_email', email);

    if (type === 'consulting') {
      params.append('line_items[0][price_data][currency]', 'usd');
      params.append('line_items[0][price_data][product_data][name]', planName || 'Travel Logistics Consulting Fee');
      params.append('line_items[0][price_data][product_data][description]', planDescription || 'Urgent travel planning and itinerary support services');
      params.append('line_items[0][price_data][unit_amount]', Math.round(amount * 100).toString());
      params.append('line_items[0][quantity]', '1');

      params.append('success_url', `${hostOrigin}/confirmation/success?session_id={CHECKOUT_SESSION_ID}&type=consulting`);
      params.append('cancel_url', `${hostOrigin}/payment?status=cancelled`);

      // Metadata
      params.append('metadata[type]', 'consulting');
      params.append('metadata[name]', name || '');
      params.append('metadata[email]', email);
      params.append('metadata[phone]', phone || '');
      params.append('metadata[origin]', origin || '');
      params.append('metadata[destination]', destination || '');
      params.append('metadata[notes]', notes || '');
      params.append('metadata[plan_name]', planName || '');
    } else if (type === 'booking') {
      if (!flight || !passenger) {
        return res.status(400).json({ error: 'Flight and passenger details are required for booking payment' });
      }

      const departureAirport = flight.departure?.airport || 'Origin';
      const arrivalAirport = flight.arrival?.airport || 'Destination';

      params.append('line_items[0][price_data][currency]', 'usd');
      params.append('line_items[0][price_data][product_data][name]', `Flight Ticket: ${departureAirport} to ${arrivalAirport}`);
      params.append('line_items[0][price_data][product_data][description]', `${flight.airline || 'Carrier'} Flight ${flight.flightNumber || ''} (${flight.class || 'Economy'})`);
      params.append('line_items[0][price_data][unit_amount]', Math.round(amount * 100).toString());
      params.append('line_items[0][quantity]', '1');

      params.append('success_url', `${hostOrigin}/confirmation/success?session_id={CHECKOUT_SESSION_ID}&type=booking`);
      params.append('cancel_url', `${hostOrigin}/booking?status=cancelled`);

      // Metadata - keep fields flat and short (Stripe 500 char limit per value)
      params.append('metadata[type]', 'booking');
      params.append('metadata[firstName]', passenger.firstName || '');
      params.append('metadata[lastName]', passenger.lastName || '');
      params.append('metadata[email]', passenger.email || '');
      params.append('metadata[phone]', passenger.phone || '');
      params.append('metadata[dateOfBirth]', passenger.dateOfBirth || '');
      params.append('metadata[gender]', passenger.gender || '');
      params.append('metadata[nationality]', passenger.nationality || '');
      params.append('metadata[passportNumber]', passenger.passportNumber || '');
      params.append('metadata[passportExpiry]', passenger.passportExpiry || '');
      params.append('metadata[emergencyName]', passenger.emergencyName || '');
      params.append('metadata[emergencyPhone]', passenger.emergencyPhone || '');
      params.append('metadata[emergencyRelationship]', passenger.emergencyRelationship || '');
      
      // Flight details metadata
      params.append('metadata[flight_airline]', flight.airline || '');
      params.append('metadata[flight_number]', flight.flightNumber || '');
      params.append('metadata[flight_route]', `${departureAirport} to ${arrivalAirport}`);
      params.append('metadata[flight_dep_time]', `${flight.departure?.date || ''} ${flight.departure?.time || ''}`);
      params.append('metadata[flight_arr_time]', `${flight.arrival?.date || ''} ${flight.arrival?.time || ''}`);
      params.append('metadata[flight_class]', flight.class || 'Economy');
      params.append('metadata[flight_stops]', (flight.stops || 0).toString());
    } else {
      return res.status(400).json({ error: 'Invalid checkout type' });
    }

    const response = await axios.post('https://api.stripe.com/v1/checkout/sessions', params.toString(), {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    res.json({
      success: true,
      url: response.data.url,
      id: response.data.id
    });
  } catch (error) {
    console.error('Stripe session creation error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to initiate secure Stripe checkout' });
  }
});

// Retrieve Stripe Session Status
router.get('/stripe/session-status', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: 'Stripe secret key is not configured' });
    }

    const response = await axios.get(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`
      }
    });

    const session = response.data;

    res.json({
      success: true,
      status: session.payment_status, // 'paid', 'unpaid', etc.
      customer_email: session.customer_details?.email || session.customer_email,
      amount_total: session.amount_total / 100, // convert from cents
      metadata: session.metadata
    });
  } catch (error) {
    console.error('Stripe session query error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to check transaction status' });
  }
});

export default router;

