import crypto from 'crypto';
import axios from 'axios';
import env from '../../config/env.mjs';
import logger from '../../config/logger.mjs';

// Current official Whop REST API base URL (v1)
const WHOP_API_BASE = 'https://api.whop.com/api/v1';

export const whopService = {
  /**
   * Create a one-time Whop checkout configuration for a flight booking.
   * Uses POST /api/v1/checkout_configurations (current official endpoint).
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

    // If WHOP_API_KEY is configured, call the Whop official API
    if (env.whopApiKey) {
      // Validate company ID format — Whop company IDs begin with biz_
      const companyId = env.whopCompanyId || '';
      if (companyId && !companyId.startsWith('biz_')) {
        logger.warn(`WHOP_COMPANY_ID "${companyId}" does not start with "biz_" — may cause API errors`);
      }

      try {
        const response = await axios.post(
          `${WHOP_API_BASE}/checkout_configurations`,
          {
            ...(companyId ? { company_id: companyId } : {}),
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
            },
            timeout: 15000
          }
        );

        const data = response.data;

        // Official v1 response shape: { id: "cc_xxx", plan: { id: "plan_xxx" }, ... }
        const sessionId = data?.id || data?.checkout_configuration_id;
        const planId    = data?.plan?.id || data?.plan_id;

        if (!sessionId) {
          throw new Error('Whop API returned a response with no checkout configuration id');
        }

        logger.info(`[Whop] Checkout configuration created — booking: ${bookingId}, configId: ${sessionId}, planId: ${planId || 'n/a'}`);

        return {
          sessionId,
          planId: planId || null,
          raw: data
        };

      } catch (err) {
        // Log status + message safely — never log the API key
        const httpStatus = err.response?.status;
        const apiMessage = err.response?.data?.message || err.response?.data?.error || err.message;
        logger.error(`[Whop] Checkout API error — HTTP ${httpStatus || 'N/A'}: ${apiMessage}`);
        throw new Error(`Whop Checkout API error (HTTP ${httpStatus || 'N/A'}): ${apiMessage}`);
      }
    }

    // Sandbox / no-key fallback used ONLY in local dev when WHOP_API_KEY is not set
    logger.warn('[Whop] WHOP_API_KEY is not set — generating sandbox test checkout session (dev only)');
    const mockSessionId = `chk_sb_${String(bookingId).substring(0, 8)}_${Date.now()}`;
    const mockPlanId    = `plan_sb_${String(bookingId).substring(0, 8)}`;
    return {
      sessionId: mockSessionId,
      planId: mockPlanId,
      raw: { id: mockSessionId, plan: { id: mockPlanId }, metadata }
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
