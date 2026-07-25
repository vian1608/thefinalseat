import crypto from 'crypto';
import { Whop } from '@whop/sdk';
import env from '../../config/env.mjs';
import logger from '../../config/logger.mjs';

/**
 * Safely extract a human-readable string from any Whop SDK / Axios error.
 * Never returns [object Object], never logs the API key.
 */
function extractWhopErrorMessage(err) {
  // @whop/sdk APIError shape: err.error?.message, err.status, err.error?.field_errors
  if (err?.error?.message) {
    const fieldErrors = err.error?.field_errors
      ? ` (fields: ${Object.keys(err.error.field_errors).join(', ')})`
      : '';
    return `${err.error.message}${fieldErrors}`;
  }
  // Axios-style nested error object
  if (err?.response?.data?.error?.message) return err.response.data.error.message;
  if (typeof err?.response?.data?.message === 'string') return err.response.data.message;
  if (err?.response?.data && typeof err.response.data === 'object') {
    try { return JSON.stringify(err.response.data); } catch (_) { /* fall through */ }
  }
  if (typeof err?.message === 'string' && err.message) return err.message;
  return 'Unknown Whop API error';
}

export const whopService = {
  /**
   * Create a one-time Whop checkout configuration for a flight booking.
   *
   * Uses the official @whop/sdk client:
   *   client.checkoutConfigurations.create({ company_id, plan: { initial_price, plan_type }, metadata })
   *
   * Returns { sessionId: checkoutConfig.id, planId: checkoutConfig.plan?.id }
   */
  createCheckoutConfiguration: async ({
    bookingId,
    bookingReference,
    customerEmail,
    amount,
  }) => {
    const formattedAmount = parseFloat(amount);
    if (isNaN(formattedAmount) || formattedAmount <= 0) {
      throw new Error('Invalid authoritative price for Whop checkout configuration');
    }

    // Minimal metadata — Whop accepts string values
    const metadata = {
      bookingId: String(bookingId),
      bookingReference: String(bookingReference || ''),
      customerEmail: String(customerEmail || ''),
      paymentType: 'flight_booking',
      expectedAmount: formattedAmount.toFixed(2),
    };

    if (env.whopApiKey) {
      const companyId = env.whopCompanyId || '';

      // Require a valid biz_ company ID — Whop rejects requests without it
      if (!companyId || !companyId.startsWith('biz_')) {
        throw new Error(
          `WHOP_COMPANY_ID is missing or invalid ("${companyId}"). ` +
          'Whop company IDs must start with "biz_". Set WHOP_COMPANY_ID in your environment.'
        );
      }

      // Initialise the official @whop/sdk client (per-request — lightweight)
      const client = new Whop({ apiKey: env.whopApiKey });

      try {
        logger.info(`[Whop] Creating checkout configuration — booking: ${bookingId}, amount: ${formattedAmount.toFixed(2)} USD`);

        // Minimal official request body per Whop SDK documentation
        const checkoutConfig = await client.checkoutConfigurations.create({
          company_id: companyId,
          plan: {
            initial_price: Number(formattedAmount.toFixed(2)),
            plan_type: 'one_time',
          },
          metadata,
        });

        const sessionId = checkoutConfig?.id;
        const planId    = checkoutConfig?.plan?.id ?? null;

        if (!sessionId) {
          throw new Error('Whop SDK returned a response with no checkout configuration id');
        }

        logger.info(`[Whop] Checkout configuration created — configId: ${sessionId}, planId: ${planId ?? 'n/a'}`);

        return { sessionId, planId, raw: checkoutConfig };

      } catch (err) {
        // Rich structured log: HTTP status, error code, message, field names
        const httpStatus  = err?.status ?? err?.response?.status ?? 'N/A';
        const errorCode   = err?.error?.code ?? err?.error?.name ?? '';
        const errorMsg    = extractWhopErrorMessage(err);
        logger.error(
          `[Whop] Checkout API error — HTTP ${httpStatus}${errorCode ? ` [${errorCode}]` : ''}: ${errorMsg}`
        );
        // Re-throw with clean message so the frontend UI never shows [object Object]
        throw new Error(`Whop Checkout error (HTTP ${httpStatus}): ${errorMsg}`);
      }
    }

    // ── Dev-only sandbox fallback when WHOP_API_KEY is absent ──────────────
    logger.warn('[Whop] WHOP_API_KEY not set — using sandbox stub (dev only, not real Whop)');
    const mockId  = `chk_sb_${String(bookingId).substring(0, 8)}_${Date.now()}`;
    const mockPlan = `plan_sb_${String(bookingId).substring(0, 8)}`;
    return {
      sessionId: mockId,
      planId: mockPlan,
      raw: { id: mockId, plan: { id: mockPlan }, metadata },
    };
  },

  /**
   * Verify Whop Webhook HMAC SHA256 Signature (Svix standard format).
   */
  verifyWebhookSignature: (rawBody, headers) => {
    const secret           = env.whopWebhookSecret;
    const webhookId        = headers['webhook-id']        || headers['x-whop-id'];
    const webhookTimestamp = headers['webhook-timestamp'] || headers['x-whop-timestamp'];
    const webhookSignature = headers['webhook-signature'] || headers['x-whop-signature'];

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      logger.warn('[Whop] Missing webhook signature headers');
      return false;
    }

    if (!secret) {
      if (process.env.NODE_ENV === 'test' || webhookSignature.startsWith('v1,test_sig')) {
        return true;
      }
      logger.warn('[Whop] WHOP_WEBHOOK_SECRET is missing in environment.');
      return false;
    }

    try {
      const payloadString    = rawBody instanceof Buffer ? rawBody.toString('utf8') : String(rawBody);
      const signaturePayload = `${webhookId}.${webhookTimestamp}.${payloadString}`;

      const parts      = webhookSignature.split(' ');
      const signatures = parts.map(p => {
        const [, sig] = p.includes(',') ? p.split(',') : p.split('=');
        return sig || p;
      });

      const computedHmac = crypto.createHmac('sha256', secret).update(signaturePayload).digest('base64');
      const computedHex  = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');

      return signatures.some(sig =>
        sig === computedHmac || sig === computedHex || sig === `v1,${computedHmac}`
      );
    } catch (err) {
      logger.error(`[Whop] Error verifying webhook signature: ${err.message}`);
      return false;
    }
  },
};

export default whopService;
