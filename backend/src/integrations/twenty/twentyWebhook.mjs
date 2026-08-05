import crypto from 'crypto';

const safeEqualHex = (left, right) => {
  try {
    const leftBuffer = Buffer.from(String(left || ''), 'hex');
    const rightBuffer = Buffer.from(String(right || ''), 'hex');
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
};

export const verifyTwentyWebhook = ({ rawBody, signature, timestamp, secret, toleranceSeconds = 300 }) => {
  if (!secret) {
    return { valid: false, code: 'TWENTY_WEBHOOK_SECRET_MISSING' };
  }

  if (!signature || !timestamp || !rawBody) {
    return { valid: false, code: 'TWENTY_WEBHOOK_HEADERS_MISSING' };
  }

  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    return { valid: false, code: 'TWENTY_WEBHOOK_TIMESTAMP_INVALID' };
  }

  const timestampSeconds = parsedTimestamp > 10_000_000_000
    ? Math.floor(parsedTimestamp / 1000)
    : parsedTimestamp;

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (age > toleranceSeconds) {
    return { valid: false, code: 'TWENTY_WEBHOOK_TIMESTAMP_EXPIRED' };
  }

  const bodyText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}:${bodyText}`)
    .digest('hex');

  return safeEqualHex(expected, signature)
    ? { valid: true }
    : { valid: false, code: 'TWENTY_WEBHOOK_SIGNATURE_INVALID' };
};

export const parseTwentyWebhookBody = (rawBody) => {
  const bodyText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  return JSON.parse(bodyText);
};
