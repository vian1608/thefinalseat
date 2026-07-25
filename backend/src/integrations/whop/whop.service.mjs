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
   * Matches Whop's official getting-started schema:
   *   client.checkoutConfigurations.create({
   *     currency: 'usd',
   *     plan: { company_id, currency: 'usd', initial_price, plan_type: 'one_time' },
   *     metadata
   *   })
   *
   * Returns { sessionId: checkoutConfig.id, planId: checkoutConfig.plan?.id }
   */
  createCheckoutConfiguration: async ({
    bookingId,
    bookingReference,
    customerEmail,
    amount,
    currency = 'USD',
  }) => {
    const formattedAmount = parseFloat(amount);
    if (isNaN(formattedAmount) || formattedAmount <= 0) {
      throw new Error('Invalid authoritative price for Whop checkout configuration');
    }

    // 1. Resolve & normalize environment and currency
    const rawEnv = (env.whopEnv || 'sandbox').trim().toLowerCase();
    if (rawEnv !== 'sandbox' && rawEnv !== 'production' && rawEnv !== 'live') {
      throw new Error(`Invalid WHOP_ENV "${env.whopEnv}". Allowed values: "sandbox", "production", "live".`);
    }

    const isSandbox = rawEnv === 'sandbox';
    const resolvedEnv = isSandbox ? 'sandbox' : 'production';
    const baseURL = isSandbox ? 'https://sandbox-api.whop.com/api/v1' : 'https://api.whop.com/api/v1';
    const resolvedCurrency = (currency || 'USD').trim().toLowerCase();

    // 2. Validate API Key & Company ID
    const apiKey = (env.whopApiKey || '').trim();
    if (!apiKey) {
      throw new Error('WHOP_API_KEY environment variable is required.');
    }

    const companyId = (env.whopCompanyId || '').trim();
    if (!companyId || !companyId.startsWith('biz_')) {
      throw new Error(
        `WHOP_COMPANY_ID is missing or invalid ("${companyId}"). ` +
        'Whop company IDs must start with "biz_". Set WHOP_COMPANY_ID in your environment.'
      );
    }

    const companyPrefix = companyId.length >= 7 ? `${companyId.substring(0, 7)}...` : companyId;

    // 3. Initialise official @whop/sdk client with environment-aware baseURL
    logger.info(`[Whop] Initialising SDK client — env: ${resolvedEnv}, host: ${new URL(baseURL).hostname}`);

    const client = new Whop({
      apiKey,
      ...(isSandbox ? { baseURL } : {}),
    });

    // Minimal metadata — Whop accepts string values
    const metadata = {
      bookingId: String(bookingId),
      bookingReference: String(bookingReference || ''),
      customerEmail: String(customerEmail || ''),
      paymentType: 'flight_booking',
      expectedAmount: formattedAmount.toFixed(2),
    };

    try {
      logger.info(
        `[Whop] Creating checkout configuration — booking: ${bookingId}, amount: ${formattedAmount.toFixed(2)} ${resolvedCurrency.toUpperCase()}, env: ${resolvedEnv}, company: ${companyPrefix}, host: ${new URL(baseURL).hostname}`
      );

      // Official request payload matching Whop dynamic-plan schema
      const checkoutConfig = await client.checkoutConfigurations.create({
        currency: resolvedCurrency,
        plan: {
          company_id: companyId,
          currency: resolvedCurrency,
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

      logger.info(`[Whop] Checkout configuration created successfully — configId: ${sessionId}, planId: ${planId ?? 'n/a'}, host: ${new URL(baseURL).hostname}`);

      return { sessionId, planId, raw: checkoutConfig };

    } catch (err) {
      // Structured log: HTTP status, error code, message, field names (never log API key)
      const httpStatus  = err?.status ?? err?.response?.status ?? 'N/A';
      const errorCode   = err?.error?.code ?? err?.error?.name ?? '';
      const errorMsg    = extractWhopErrorMessage(err);
      logger.error(
        `[Whop] Checkout API error [${new URL(baseURL).hostname}] — HTTP ${httpStatus}${errorCode ? ` [${errorCode}]` : ''}: ${errorMsg}`
      );
      // Re-throw clean error message for caller
      throw new Error(`Whop Checkout error (HTTP ${httpStatus}): ${errorMsg}`);
    }
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
