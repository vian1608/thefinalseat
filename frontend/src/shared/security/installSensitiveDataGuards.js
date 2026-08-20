import api from '../api/api';

const FORBIDDEN_KEYS = new Set([
  'cardnumber',
  'card_number',
  'pan',
  'cvv',
  'cvc',
  'cid',
  'cch',
  'securitycode',
  'security_code',
]);

const SAFE_CARD_REFERENCE_KEY = 'tfsSafeCardReference';
const DEFAULT_FETCH_TIMEOUT_MS = 30000;

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function sanitizeSensitivePayload(value, keyName = '') {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSensitivePayload(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((clean, [key, child]) => {
      const normalizedKey = key.toLowerCase();
      if (FORBIDDEN_KEYS.has(normalizedKey)) return clean;

      if (normalizedKey === 'cardlast4' || normalizedKey === 'card_last4') {
        const last4 = digits(child).slice(-4);
        clean[key] = last4 || null;
        return clean;
      }

      clean[key] = sanitizeSensitivePayload(child, key);
      return clean;
    }, {});
  }

  if (typeof value === 'string') {
    const normalizedKey = String(keyName || '').toLowerCase();
    if (FORBIDDEN_KEYS.has(normalizedKey)) return '[REDACTED]';
  }

  return value;
}

function readSafeCardReference() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SAFE_CARD_REFERENCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const last4 = digits(parsed?.last4).slice(-4);
    const cardBrand = String(parsed?.cardBrand || '').trim();
    const cardExpDate = String(parsed?.cardExpDate || '').trim();
    if (!cardBrand || !/^\d{4}$/.test(last4) || !/^\d{2}\/\d{4}$/.test(cardExpDate)) return null;
    return { cardBrand, last4, cardExpDate };
  } catch {
    return null;
  }
}

function isCustomerBookingCreate(config) {
  if (typeof window === 'undefined') return false;
  const method = String(config?.method || 'get').toLowerCase();
  const url = String(config?.url || '').split('?')[0];
  const hasCheckoutSession = Boolean(sessionStorage.getItem('checkoutSessionToken'));
  return method === 'post' && url === '/bookings' && hasCheckoutSession;
}

function applySafeCheckoutPaymentReference(config, data) {
  if (!isCustomerBookingCreate(config) || !data || typeof data !== 'object' || Array.isArray(data)) return data;

  const reference = readSafeCardReference();
  if (!reference) return data;

  const existingMethod = data.paymentMethod && typeof data.paymentMethod === 'object'
    ? data.paymentMethod
    : {};

  return {
    ...data,
    payment_provider: 'INTERNAL_REFERENCE',
    cardBrand: reference.cardBrand,
    cardLast4: reference.last4,
    cardExpDate: reference.cardExpDate,
    paymentMethod: {
      ...existingMethod,
      cardBrand: reference.cardBrand,
      cardLast4: reference.last4,
      cardExpDate: reference.cardExpDate,
    },
  };
}

function sanitizeAxiosData(data, config = null) {
  if (!data) return data;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      const withReference = applySafeCheckoutPaymentReference(config, parsed);
      return JSON.stringify(sanitizeSensitivePayload(withReference));
    } catch {
      return data;
    }
  }
  return sanitizeSensitivePayload(applySafeCheckoutPaymentReference(config, data));
}

function redactForConsole(value, keyName = '') {
  if (Array.isArray(value)) return value.map((item) => redactForConsole(item));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      if (FORBIDDEN_KEYS.has(normalizedKey)) {
        output[key] = '[REDACTED]';
      } else if (normalizedKey === 'cardlast4' || normalizedKey === 'card_last4') {
        output[key] = digits(child).slice(-4) || '[REDACTED]';
      } else {
        output[key] = redactForConsole(child, key);
      }
    }
    return output;
  }
  if (typeof value === 'string') {
    if (FORBIDDEN_KEYS.has(String(keyName).toLowerCase())) return '[REDACTED]';
    return value.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED CARD]');
  }
  return value;
}

function isSameOriginApiRequest(input) {
  if (typeof window === 'undefined') return false;
  try {
    const raw = typeof input === 'string' ? input : input?.url;
    if (!raw) return false;
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function installApiFetchTimeout() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    // Respect explicit caller cancellation/timeout behavior.
    if (!isSameOriginApiRequest(input) || init.signal) {
      return originalFetch(input, init);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);
    return originalFetch(input, { ...init, signal: controller.signal })
      .finally(() => window.clearTimeout(timer));
  };
}

function normalizeInquiryErrorShape(error) {
  const url = String(error?.config?.url || '');
  if (!url.includes('/inquiries/consulting')) return error;

  const responseError = error?.response?.data?.error;
  if (responseError && typeof responseError === 'object') {
    const message = responseError.message || error.userMessage || error.message || 'Unable to submit your request right now.';
    error.response.data.error = String(message);
    error.userMessage = String(message);
  }
  return error;
}

let installed = false;

export function installSensitiveDataGuards() {
  if (installed) return;
  installed = true;

  api.interceptors.request.use((config) => {
    config.data = sanitizeAxiosData(config.data, config);
    return config;
  });

  // Some legacy landing pages read response.data.error directly. Guarantee
  // that inquiry failures are always render-safe strings rather than objects.
  api.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(normalizeInquiryErrorShape(error))
  );

  installApiFetchTimeout();

  if (process.env.NODE_ENV === 'production' && typeof console !== 'undefined') {
    ['log', 'info', 'debug', 'warn', 'error'].forEach((method) => {
      const original = console[method]?.bind(console);
      if (!original) return;
      console[method] = (...args) => original(...args.map((arg) => redactForConsole(arg)));
    });
  }
}

export default installSensitiveDataGuards;
