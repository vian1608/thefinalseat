module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { type, email, amount, name, phone, origin, destination, notes, planName, planDescription, flight, passenger } = req.body || {};

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ error: 'Stripe secret key is not configured' });
    }

    if (!amount || !type || !email) {
      return res.status(400).json({ error: 'Missing required parameters: amount, type, and email' });
    }

    const hostOrigin = req.headers.origin || 'https://thefinalseat.com';

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

      // Metadata
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

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const session = await response.json();
    if (!response.ok) {
      throw new Error(session.error?.message || 'Stripe API checkout session creation failed');
    }

    res.status(200).json({
      success: true,
      url: session.url,
      id: session.id
    });
  } catch (error) {
    console.error('Stripe session creation error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to initiate secure Stripe checkout' });
  }
};
