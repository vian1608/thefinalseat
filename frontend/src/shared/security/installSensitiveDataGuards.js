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

function sanitizeAxiosData(data) {
  if (!data) return data;
  if (typeof data === 'string') {
    try {
      return JSON.stringify(sanitizeSensitivePayload(JSON.parse(data)));
    } catch {
      return data;
    }
  }
  return sanitizeSensitivePayload(data);
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
    // Defense-in-depth: redact standalone 13-19 digit payment-card-like sequences.
    return value.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED CARD]');
  }
  return value;
}

let installed = false;

export function installSensitiveDataGuards() {
  if (installed) return;
  installed = true;

  api.interceptors.request.use((config) => {
    config.data = sanitizeAxiosData(config.data);
    return config;
  });

  if (process.env.NODE_ENV === 'production' && typeof console !== 'undefined') {
    ['log', 'info', 'debug', 'warn', 'error'].forEach((method) => {
      const original = console[method]?.bind(console);
      if (!original) return;
      console[method] = (...args) => original(...args.map((arg) => redactForConsole(arg)));
    });
  }
}

export default installSensitiveDataGuards;
