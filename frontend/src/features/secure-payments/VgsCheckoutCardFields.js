import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';

const CARD_BRANDS = ['Visa', 'Mastercard', 'American Express', 'Discover', 'Other'];
const STORAGE_KEY = 'tfsSafeCardReference';

function parseExpiry(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(text)) {
    return { valid: false, message: 'Please enter the card expiration month and year.' };
  }

  const [yearText, monthText] = text.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { valid: false, message: 'Please enter a valid expiration date.' };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { valid: false, message: 'This card expiration date has already passed. Please enter a current card.' };
  }

  return {
    valid: true,
    month,
    year,
    formatted: `${String(month).padStart(2, '0')}/${year}`,
  };
}

function safeReference(cardBrand, last4, expiry) {
  const cleanLast4 = String(last4 || '').replace(/\D/g, '').slice(0, 4);
  const expiryCheck = parseExpiry(expiry);
  return {
    cardBrand: String(cardBrand || '').trim() || null,
    last4: /^\d{4}$/.test(cleanLast4) ? cleanLast4 : null,
    cardExpDate: expiryCheck.valid ? expiryCheck.formatted : null,
  };
}

function persistReference(reference) {
  try {
    if (!reference.cardBrand && !reference.last4 && !reference.cardExpDate) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(reference));
  } catch {
    // Payment-reference persistence is a convenience only; checkout validation still works without it.
  }
}

function updateLegacyCheckoutCopy() {
  const exactTextReplacements = [
    ['Card Fields Secured by VGS', 'No Full Card / CVV Storage'],
    ['Secure Card Vault', 'Protected Reservation'],
  ];

  document.querySelectorAll('.secure-badge, .booking-hero-badge').forEach((node) => {
    const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    for (const [from, to] of exactTextReplacements) {
      if (text.includes(from)) {
        node.textContent = to;
        break;
      }
    }
  });

  document.querySelectorAll('.card-details-box .payment-sub-heading').forEach((node) => {
    if (String(node.textContent || '').includes('Card Details')) node.textContent = 'Card Reference';
  });

  document.querySelectorAll('.card-details-box p').forEach((node) => {
    if (/VGS|vault references|raw values/i.test(String(node.textContent || ''))) {
      node.textContent = 'For safety, only the card brand, last four digits, expiration date, cardholder name, and billing details are saved with this reservation. Full card numbers and security codes are not collected or stored.';
    }
  });

  document.querySelectorAll('.booking-hero-premium__subtitle').forEach((node) => {
    if (/secure, encrypted checkout/i.test(String(node.textContent || ''))) {
      node.textContent = String(node.textContent || '').replace(/secure, encrypted checkout\.?/i, 'a protected reservation submission.');
    }
  });
}

/**
 * Legacy filename retained only so the existing BookingPage import remains stable.
 * This component does not load or call VGS and never collects a full PAN or CVV.
 */
const InternalCardReferenceFields = forwardRef(function InternalCardReferenceFields({ onFocus }, ref) {
  const [cardBrand, setCardBrand] = useState('');
  const [last4, setLast4] = useState('');
  const [expiry, setExpiry] = useState('');
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => {
    if (!cardBrand) return { valid: false, message: 'Please select the card brand.' };
    if (!/^\d{4}$/.test(last4)) return { valid: false, message: 'Please enter exactly the last four digits of the card.' };
    return parseExpiry(expiry);
  }, [cardBrand, last4, expiry]);

  const reference = useMemo(
    () => safeReference(cardBrand, last4, expiry),
    [cardBrand, last4, expiry]
  );

  useEffect(() => {
    persistReference(reference);
  }, [reference]);

  useEffect(() => {
    updateLegacyCheckoutCopy();
    const observer = new MutationObserver(() => updateLegacyCheckoutCopy());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    isReady: () => true,
    isValid: () => validation.valid === true,
    getMaskedMetadata: () => reference,
    getValidationMessage: () => validation.message || '',
    secureBooking: async () => {
      if (!validation.valid) {
        throw new Error(validation.message || 'Please review the payment reference details and try again.');
      }
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* best effort */ }
      return { ...reference, provider: 'INTERNAL_REFERENCE' };
    },
  }), [reference, validation]);

  const markTouched = () => {
    setTouched(true);
    if (typeof onFocus === 'function') onFocus();
  };

  return (
    <div className="internal-card-reference-fields" onFocus={markTouched}>
      <div
        style={{
          marginTop: '0.85rem',
          padding: '0.8rem 0.95rem',
          border: '1px solid #dbe4ee',
          background: '#f8fafc',
          borderRadius: '10px',
          color: '#475569',
          fontSize: '0.84rem',
          lineHeight: 1.5,
        }}
      >
        <i className="fas fa-shield-alt" style={{ marginRight: '0.45rem' }} aria-hidden="true" />
        This reservation stores only a non-sensitive card reference. Do not enter or send a full card number or security code here.
      </div>

      <div className="form-row-three" style={{ marginTop: '0.85rem' }}>
        <div className="booking-form-field">
          <label htmlFor="cardBrand">Card Brand <span style={{ color: '#dc2626' }}>*</span></label>
          <select
            id="cardBrand"
            value={cardBrand}
            onChange={(event) => { setCardBrand(event.target.value); setTouched(true); }}
            onBlur={() => setTouched(true)}
            required
          >
            <option value="">Select brand</option>
            {CARD_BRANDS.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
          </select>
        </div>

        <div className="booking-form-field">
          <label htmlFor="cardLast4">Last 4 Digits <span style={{ color: '#dc2626' }}>*</span></label>
          <input
            id="cardLast4"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="1234"
            value={last4}
            onChange={(event) => {
              setLast4(event.target.value.replace(/\D/g, '').slice(0, 4));
              setTouched(true);
            }}
            onBlur={() => setTouched(true)}
            required
          />
        </div>

        <div className="booking-form-field">
          <label htmlFor="cardExpiry">Expiration Date <span style={{ color: '#dc2626' }}>*</span></label>
          <input
            id="cardExpiry"
            type="month"
            value={expiry}
            onChange={(event) => { setExpiry(event.target.value); setTouched(true); }}
            onBlur={() => setTouched(true)}
            required
          />
        </div>
      </div>

      {touched && !validation.valid && (
        <div
          role="alert"
          style={{
            marginTop: '0.7rem',
            padding: '0.7rem 0.8rem',
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            borderRadius: '8px',
            fontSize: '0.84rem',
          }}
        >
          <i className="fas fa-exclamation-circle" style={{ marginRight: '0.45rem' }} aria-hidden="true" />
          {validation.message}
        </div>
      )}

      {touched && validation.valid && (
        <div
          role="status"
          style={{
            marginTop: '0.7rem',
            padding: '0.7rem 0.8rem',
            border: '1px solid #bbf7d0',
            background: '#f0fdf4',
            color: '#166534',
            borderRadius: '8px',
            fontSize: '0.84rem',
          }}
        >
          <i className="fas fa-check-circle" style={{ marginRight: '0.45rem' }} aria-hidden="true" />
          Payment reference details look valid. You can continue with the reservation.
        </div>
      )}
    </div>
  );
});

export default InternalCardReferenceFields;
