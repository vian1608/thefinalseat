module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { session_id } = req.query || {};
  if (!session_id) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'Stripe secret key is not configured' });
  }

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`
      }
    });

    const session = await response.json();
    if (!response.ok) {
      throw new Error(session.error?.message || 'Failed to retrieve session from Stripe');
    }

    res.status(200).json({
      success: true,
      status: session.payment_status,
      customer_email: session.customer_details?.email || session.customer_email,
      amount_total: session.amount_total / 100,
      metadata: session.metadata
    });
  } catch (error) {
    console.error('Stripe status check error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to check transaction status' });
  }
};
