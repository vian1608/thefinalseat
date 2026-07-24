import crypto from 'crypto';
import axios from 'axios';
import env from '../../config/env.mjs';
import logger from '../../config/logger.mjs';

const WHOP_BASE_URL = 'https://api.whop.com/v5';

export const whopService = {
  /**
   * Create a one-time Whop checkout configuration for a flight booking
   */
  createCheckoutConfiguration: async ({
    bookingId,
    bookingReference,
    customerEmail,
    amount,
    currency = 'USD'
  }) => {
    const formattedAmount = parseFloat(amount);
    if (isNaN(formattedAmount) || formattedAmount <= 0) {
      throw new Error('Invalid authoritative price for Whop checkout configuration');
    }

    const metadata = {
      bookingId: String(bookingId),
      bookingReference: String(bookingReference || ''),
      customerEmail: String(customerEmail || ''),
      paymentType: 'flight_booking',
      expectedAmount: formattedAmount.toFixed(2),
      currency: currency.toUpperCase()
    };

    // If WHOP_API_KEY is configured, call Whop official API
    if (env.whopApiKey) {
      try {
        const response = await axios.post(
          `${WHOP_BASE_URL}/app/checkout_configurations`,
          {
            company_id: env.whopCompanyId || undefined,
            plan: {
              initial_price: formattedAmount,
              plan_type: 'one_time',
              release_method: 'buy_now',
              currency: currency.toLowerCase(),
              promo_codes_enabled: false
            },
            metadata
          },
          {
            headers: {
              'Authorization': `Bearer ${env.whopApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const data = response.data;
        const sessionId = data.id || data.checkout_configuration_id;
        const planId = data.plan_id || (data.plan && data.plan.id);

        logger.info(`Whop checkout configuration created for booking ${bookingId}: ${sessionId}`);
        return {
          sessionId,
          planId: planId || `plan_${sessionId}`,
          raw: data
        };
      } catch (err) {
        logger.error(`Whop API error creating checkout: ${err.response?.data?.message || err.message}`);
        throw new Error(`Whop Checkout API error: ${err.response?.data?.message || err.message}`);
      }
    }

    // Sandbox / Test fallback when WHOP_API_KEY is not set in dev
    logger.warn('WHOP_API_KEY is not set. Generating Whop sandbox test checkout session.');
    const mockSessionId = `chk_sb_${bookingId.substring(0, 8)}_${Date.now()}`;
    const mockPlanId = `plan_sb_${bookingId.substring(0, 8)}`;
    return {
      sessionId: mockSessionId,
      planId: mockPlanId,
      raw: { id: mockSessionId, plan_id: mockPlanId, metadata }
    };
  },

  /**
   * Verify Whop Webhook HMAC SHA256 Signature
   */
  verifyWebhookSignature: (rawBody, headers) => {
    const secret = env.whopWebhookSecret;
    const webhookId = headers['webhook-id'] || headers['x-whop-id'];
    const webhookTimestamp = headers['webhook-timestamp'] || headers['x-whop-timestamp'];
    const webhookSignature = headers['webhook-signature'] || headers['x-whop-signature'];

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      logger.warn('Missing Whop webhook signature headers');
      return false;
    }

    // In dev/test when WHOP_WEBHOOK_SECRET is not configured, allow mock test signature
    if (!secret) {
      if (process.env.NODE_ENV === 'test' || webhookSignature.startsWith('v1,test_sig')) {
        return true;
      }
      logger.warn('WHOP_WEBHOOK_SECRET is missing in environment.');
      return false;
    }

    try {
      const payloadString = rawBody instanceof Buffer ? rawBody.toString('utf8') : String(rawBody);
      const signaturePayload = `${webhookId}.${webhookTimestamp}.${payloadString}`;
      
      // Parse signatures (Whop/Svix header format: v1,signature or v1=signature)
      const parts = webhookSignature.split(' ');
      const signatures = parts.map(p => {
        const [, sig] = p.includes(',') ? p.split(',') : p.split('=');
        return sig || p;
      });

      const computedHmac = crypto
        .createHmac('sha256', secret)
        .update(signaturePayload)
        .digest('base64');

      const computedHex = crypto
        .createHmac('sha256', secret)
        .update(signaturePayload)
        .digest('hex');

      return signatures.some(sig => sig === computedHmac || sig === computedHex || sig === `v1,${computedHmac}`);
    } catch (err) {
      logger.error(`Error verifying Whop webhook signature: ${err.message}`);
      return false;
    }
  }
};

export default whopService;
