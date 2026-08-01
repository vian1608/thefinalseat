import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { consultingServices, PAYMENT_DISCLAIMER } from '../../../shared/data/consultingServices';
import { paymentAPI } from '../../../shared/api/api';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../../../shared/constants/supportContact';
import './ConsultingPaymentPage.css';

const detectCardBrand = (number = '') => {
  const clean = number.replace(/\D/g, '');
  if (/^4/.test(clean)) return { brand: 'visa', name: 'Visa', icon: 'fa-cc-visa', color: '#1a1f71' };
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[0-1]|2720)/.test(clean)) return { brand: 'mastercard', name: 'Mastercard', icon: 'fa-cc-mastercard', color: '#eb001b' };
  if (/^3[47]/.test(clean)) return { brand: 'amex', name: 'American Express', icon: 'fa-cc-amex', color: '#006fcf' };
  if (/^(6011|65|64[4-9]|622)/.test(clean)) return { brand: 'discover', name: 'Discover', icon: 'fa-cc-discover', color: '#f9a01b' };
  return { brand: 'generic', name: 'Credit Card', icon: 'fa-credit-card', color: '#475569' };
};

const initialBilling = {
  fullName: '',
  email: '',
  phone: '',
  cardNumber: '',
  expDate: '',
  cch: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  country: 'United States',
  agreeTerms: false,
};

function ConsultingPayment() {
  const [selectedId, setSelectedId] = useState('urgent');
  const [billing, setBilling] = useState(initialBilling);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const selected = consultingServices.find((s) => s.id === selectedId) || consultingServices[1];

  const getPlanPrice = () => {
    const originalPrice = selected.price;
    return {
      original: originalPrice.toFixed(2),
      discount: '0.00',
      final: originalPrice.toFixed(2),
    };
  };

  const planPrice = getPlanPrice();

  const handleChange = (field, value) => {
    setBilling((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!billing.agreeTerms) {
      setMessage('You must agree to the terms and policies to proceed.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setMessage('');

    // Save pending billing in sessionStorage to restore details if needed
    sessionStorage.setItem('pendingBilling', JSON.stringify(billing));

    try {
      const response = await paymentAPI.createStripeSession({
        type: 'consulting',
        email: billing.email,
        amount: parseFloat(planPrice.final),
        name: billing.fullName,
        phone: billing.phone,
        origin: billing.city,
        destination: billing.state,
        notes: [
          `Consulting plan: ${selected.name} ($${selected.price})`,
          `Billing address: ${billing.address}, ${billing.city}, ${billing.state} ${billing.zip}, ${billing.country}`
        ].join(' | '),
        planName: selected.name,
        planDescription: selected.description,
      });

      if (response.success && response.url) {
        // Redirect to secure Stripe hosted checkout
        window.location.href = response.url;
      } else {
        throw new Error('Did not receive secure checkout URL from the server');
      }
    } catch (error) {
      console.error('Stripe session creation failed:', error);
      setStatus('error');
      setMessage(
        error.response?.data?.error ||
          `Unable to initiate checkout right now. Call ${SUPPORT_PHONE_DISPLAY} or email support@thefinalseat.com.`
      );
    }
  };

  return (
    <div className="consulting-payment-page">
      <Helmet>
        <title>Secure Payment | Travel Assistance | The Final Seat</title>
        <meta
          name="description"
          content="Pay flight reservation assistance and travel support fees securely with The Final Seat."
        />
        <link rel="canonical" href="https://www.thefinalseat.com/payment" />
      </Helmet>

      <div className="consulting-payment-container">
        <header className="consulting-payment-header">
          <h1>Secure Payment</h1>
          <p>
            Pay for flight reservation assistance, itinerary coordination, and urgent travel support. All
            transactions are encrypted and processed securely.
          </p>
        </header>

        <div className="consulting-payment-layout">
          <section className="consulting-payment-services" aria-labelledby="service-plans-heading">
            <h2 id="service-plans-heading">Service Plans</h2>
            <p className="consulting-payment-services__intro">
              Select the service tier that matches your travel needs. Prices are in USD and cover
              assistance services.
            </p>
            <div className="consulting-payment-plans">
              {consultingServices.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={`consulting-payment-plan ${selectedId === plan.id ? 'consulting-payment-plan--active' : ''}`}
                  onClick={() => setSelectedId(plan.id)}
                  aria-pressed={selectedId === plan.id}
                >
                  {plan.recommended && <span className="consulting-payment-plan__badge">Popular</span>}
                  <h3>{plan.name}</h3>
                  <p className="consulting-payment-plan__price">
                    <span>${plan.price}</span>
                    <small>USD · one-time fee</small>
                  </p>
                  <p className="consulting-payment-plan__desc">{plan.description}</p>
                  <ul>
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </section>

          <section className="consulting-payment-checkout" aria-labelledby="checkout-heading">
            <h2 id="checkout-heading">Checkout & Billing</h2>
            <form className="consulting-payment-form" onSubmit={handleSubmit}>
              <fieldset className="consulting-payment-fieldset">
                <legend>Billing Contact</legend>
                <div className="consulting-payment-row">
                  <label>
                    Full name
                    <input
                      type="text"
                      value={billing.fullName}
                      onChange={(e) => handleChange('fullName', e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="e.g. Jane Doe"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={billing.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="e.g. jane@example.com"
                    />
                  </label>
                </div>
                <label>
                  Phone
                  <input
                    type="tel"
                    value={billing.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    required
                    autoComplete="tel"
                    placeholder="e.g. +1 (555) 000-0000"
                  />
                </label>
                <label>
                  Street address
                  <input
                    type="text"
                    value={billing.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    required
                    autoComplete="street-address"
                    placeholder="e.g. 123 Main St"
                  />
                </label>
                <div className="consulting-payment-row consulting-payment-row--3">
                  <label>
                    City
                    <input
                      type="text"
                      value={billing.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      required
                      autoComplete="address-level2"
                      placeholder="City"
                    />
                  </label>
                  <label>
                    State
                    <input
                      type="text"
                      value={billing.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      required
                      autoComplete="address-level1"
                      placeholder="State"
                    />
                  </label>
                  <label>
                    ZIP
                    <input
                      type="text"
                      value={billing.zip}
                      onChange={(e) => handleChange('zip', e.target.value)}
                      required
                      autoComplete="postal-code"
                      placeholder="ZIP"
                    />
                  </label>
                </div>
                <label>
                  Country
                  <input
                    type="text"
                    value={billing.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    required
                    autoComplete="country-name"
                  />
                </label>
              </fieldset>

              <fieldset className="consulting-payment-fieldset">
                <legend>
                  Secure Credit / Debit Card Details
                </legend>
                <div className="stripe-secure-payment-notice" style={{ marginBottom: '1.25rem' }}>
                  <div className="stripe-notice-header">
                    <span className="secure-badge">
                      <i className="fas fa-lock" aria-hidden="true" /> 256-Bit SSL Encrypted
                    </span>
                    <div className="card-brand-logos">
                      <i className="fab fa-cc-visa" title="Visa" />
                      <i className="fab fa-cc-mastercard" title="Mastercard" />
                      <i className="fab fa-cc-amex" title="American Express" />
                      <i className="fab fa-cc-discover" title="Discover" />
                    </div>
                  </div>
                </div>

                <label>
                  Card Number
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={billing.cardNumber}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '').slice(0, 16);
                        const formatted = clean.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
                        handleChange('cardNumber', formatted);
                      }}
                      required
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                    />
                    <span style={{ position: 'absolute', right: '0.85rem', fontSize: '1.5rem', pointerEvents: 'none' }}>
                      <i className={`fab ${detectCardBrand(billing.cardNumber).icon}`} style={{ color: detectCardBrand(billing.cardNumber).color }} />
                    </span>
                  </div>
                </label>

                <div className="consulting-payment-row">
                  <label>
                    Expiration Date (MM/YY)
                    <input
                      type="text"
                      value={billing.expDate}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '').slice(0, 4);
                        const formatted = clean.length >= 3 ? `${clean.slice(0, 2)}/${clean.slice(2)}` : clean;
                        handleChange('expDate', formatted);
                      }}
                      required
                      placeholder="MM/YY"
                      maxLength={5}
                    />
                  </label>
                  <label>
                    Security Code (CCH / CVV)
                    <input
                      type="password"
                      value={billing.cch}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '').slice(0, 4);
                        handleChange('cch', clean);
                      }}
                      required
                      placeholder="123"
                      maxLength={4}
                    />
                  </label>
                </div>
              </fieldset>

              <div className="consulting-payment-order-summary">
                <div className="consulting-payment-order-summary__total">
                  <span>Total due today</span>
                  <strong>${planPrice.final} USD</strong>
                </div>
              </div>

              <label className="consulting-payment-terms">
                <input
                  type="checkbox"
                  checked={billing.agreeTerms}
                  onChange={(e) => handleChange('agreeTerms', e.target.checked)}
                  required
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer">
                    Terms & Conditions
                  </Link>
                  ,{' '}
                  <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </Link>
                  , and{' '}
                  <Link to="/refund-policy" target="_blank" rel="noopener noreferrer">
                    Refund Policy
                  </Link>
                  . I understand this fee is for consulting services only.
                </span>
              </label>

              {message && (
                <p
                  className={`consulting-payment-message consulting-payment-message--${status}`}
                  role="alert"
                >
                  {message}
                </p>
              )}

              <button
                type="submit"
                className="consulting-payment-submit"
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? (
                  <>
                    <i className="fas fa-spinner fa-spin" /> Redirecting to Stripe…
                  </>
                ) : (
                  `Pay $${selected.price.toFixed(2)} — Proceed to Secure Stripe Checkout`
                )}
              </button>

              <p className="consulting-payment-help">
                Questions before paying?{' '}
                <a href={SUPPORT_PHONE_HREF}>Call {SUPPORT_PHONE_DISPLAY}</a> or{' '}
                <a href="mailto:support@thefinalseat.com">support@thefinalseat.com</a>
              </p>
            </form>
          </section>
        </div>

        <aside className="consulting-payment-disclaimer" data-nosnippet="true">
          <small>{PAYMENT_DISCLAIMER}</small>
        </aside>

        <div className="consulting-payment-business">
          <p>
            <strong>The Final Seat LLC</strong> · 5830 E 2nd St, Ste 7000, Casper, WY 82609 ·{' '}
            {SUPPORT_PHONE_DISPLAY} · support@thefinalseat.com
          </p>
        </div>
      </div>
    </div>
  );
}

export default ConsultingPayment;
