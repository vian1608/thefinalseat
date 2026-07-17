import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { paymentAPI } from '../services/api';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../constants/supportContact';
import './Booking.css';

function Booking() {
  const navigate = useNavigate();
  const [flight, setFlight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    nationality: '',
    passportNumber: '',
    passportExpiry: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    agreeTerms: false,
  });

  useEffect(() => {
    const flightData = JSON.parse(sessionStorage.getItem('selectedFlight') || 'null');
    if (!flightData) {
      navigate('/');
      return;
    }
    setFlight(flightData);
  }, [navigate]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateTotal = () => {
    const basePrice = parseFloat(flight?.price?.total || 0);
    const taxes = basePrice * 0.15; // 15% taxes
    const serviceFee = 25.00; // Standard processing fee
    return {
      subtotal: basePrice.toFixed(2),
      taxes: taxes.toFixed(2),
      serviceFee: serviceFee.toFixed(2),
      total: (basePrice + taxes + serviceFee).toFixed(2)
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.agreeTerms) {
      setError('You must agree to the Terms of Service, Privacy Policy, and Refund Policy to proceed.');
      return;
    }

    setLoading(true);
    setError('');

    // Save current details in sessionStorage so they can be restored/queried on the success page
    sessionStorage.setItem('pendingPassenger', JSON.stringify(formData));

    try {
      const pricing = calculateTotal();
      
      const response = await paymentAPI.createStripeSession({
        type: 'booking',
        email: formData.email,
        amount: parseFloat(pricing.total),
        flight: flight,
        passenger: formData,
      });

      if (response.success && response.url) {
        // Redirect to secure Stripe Checkout page
        window.location.href = response.url;
      } else {
        throw new Error('No checkout URL received from server');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(
        err.response?.data?.error || 
        'Unable to initiate secure checkout. Please try again or call support.'
      );
      setLoading(false);
    }
  };

  if (!flight) {
    return (
      <div className="booking-loading-container">
        <i className="fas fa-spinner fa-spin"></i>
        <p>Loading itinerary details...</p>
      </div>
    );
  }

  const pricing = calculateTotal();

  return (
    <div className="booking-page-container">
      <Helmet>
        <title>Secure Booking Checkout | The Final Seat</title>
        <meta name="description" content="Complete your flight booking securely. Enter passenger info and complete secure payment processing." />
      </Helmet>

      <div className="booking-inner-container">
        <header className="booking-page-header">
          <h1>Secure Booking Checkout</h1>
          <p>Provide passenger details and complete your reservation via secure payment gateway.</p>
        </header>

        {error && (
          <div className="booking-error-alert" role="alert">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        <div className="booking-checkout-layout">
          {/* Main Checkout Form */}
          <div className="booking-main-content">
            <form onSubmit={handleSubmit} className="booking-form-element">
              
              {/* Passenger Info */}
              <section className="booking-form-section">
                <div className="section-title-wrapper">
                  <span className="step-badge">1</span>
                  <h2>Passenger Information</h2>
                </div>
                
                <div className="booking-form-grid">
                  <label className="booking-form-field">
                    First Name (as on passport)
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      required
                      placeholder="e.g. John"
                    />
                  </label>
                  <label className="booking-form-field">
                    Last Name (as on passport)
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      required
                      placeholder="e.g. Doe"
                    />
                  </label>
                </div>

                <div className="booking-form-grid">
                  <label className="booking-form-field">
                    Email Address
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                      placeholder="e.g. john.doe@example.com"
                    />
                  </label>
                  <label className="booking-form-field">
                    Phone Number
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      required
                      placeholder="e.g. +1 (555) 000-0000"
                    />
                  </label>
                </div>

                <div className="booking-form-grid">
                  <label className="booking-form-field">
                    Date of Birth
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      required
                    />
                  </label>
                  <label className="booking-form-field">
                    Gender
                    <select
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </div>

                <div className="booking-form-grid">
                  <label className="booking-form-field">
                    Nationality
                    <input
                      type="text"
                      value={formData.nationality}
                      onChange={(e) => handleInputChange('nationality', e.target.value)}
                      required
                      placeholder="e.g. United States"
                    />
                  </label>
                  <label className="booking-form-field">
                    Passport Number
                    <input
                      type="text"
                      value={formData.passportNumber}
                      onChange={(e) => handleInputChange('passportNumber', e.target.value)}
                      required
                      placeholder="Passport Number"
                    />
                  </label>
                </div>

                <div className="booking-form-grid">
                  <label className="booking-form-field">
                    Passport Expiry Date
                    <input
                      type="date"
                      value={formData.passportExpiry}
                      onChange={(e) => handleInputChange('passportExpiry', e.target.value)}
                      required
                    />
                  </label>
                </div>
              </section>

              {/* Emergency Contact */}
              <section className="booking-form-section">
                <div className="section-title-wrapper">
                  <span className="step-badge">2</span>
                  <h2>Emergency Contact</h2>
                </div>

                <div className="booking-form-grid">
                  <label className="booking-form-field">
                    Contact Full Name
                    <input
                      type="text"
                      value={formData.emergencyName}
                      onChange={(e) => handleInputChange('emergencyName', e.target.value)}
                      required
                      placeholder="Contact Name"
                    />
                  </label>
                  <label className="booking-form-field">
                    Contact Phone Number
                    <input
                      type="tel"
                      value={formData.emergencyPhone}
                      onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                      required
                      placeholder="Contact Phone"
                    />
                  </label>
                </div>

                <div className="booking-form-grid">
                  <label className="booking-form-field">
                    Relationship to Passenger
                    <input
                      type="text"
                      value={formData.emergencyRelationship}
                      onChange={(e) => handleInputChange('emergencyRelationship', e.target.value)}
                      required
                      placeholder="e.g. Spouse, Parent, Friend"
                    />
                  </label>
                </div>
              </section>

              {/* Secure Payment Agreement */}
              <section className="booking-form-section">
                <div className="section-title-wrapper">
                  <span className="step-badge">3</span>
                  <h2>Secure Payment Gateway</h2>
                </div>

                <div className="payment-gateway-info-box">
                  <div className="secure-badge-row">
                    <span className="stripe-secure-text">
                      <i className="fas fa-lock"></i> SSL Secured checkout
                    </span>
                    <div className="card-brand-icons">
                      <i className="fab fa-cc-visa" title="Visa"></i>
                      <i className="fab fa-cc-mastercard" title="Mastercard"></i>
                      <i className="fab fa-cc-amex" title="American Express"></i>
                      <i className="fab fa-cc-discover" title="Discover"></i>
                    </div>
                  </div>
                  <p className="payment-redirect-notice">
                    You will be redirected to <strong>Stripe Checkout</strong> to enter your card details securely. 
                    The Final Seat LLC is a PCI-DSS compliant advisor and does not store your card details on our servers.
                  </p>
                </div>

                {/* SMS Consent (Opt-in) compliance */}
                <div className="sms-compliance-block">
                  <div className="checkbox-wrapper">
                    <input 
                      type="checkbox" 
                      id="bookingSmsOptIn" 
                      name="bookingSmsOptIn" 
                      required 
                    />
                    <label htmlFor="bookingSmsOptIn" className="checkbox-label">
                      By checking this box and submitting this request, I provide my express written consent to receive automated updates, travel quotes, and booking notifications via SMS from The Final Seat LLC at the number provided. Consent is not a condition of purchase. Message and data rates may apply. Text STOP to cancel.
                    </label>
                  </div>
                </div>

                {/* Terms Agreement Checkbox */}
                <div className="terms-checkbox-block">
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      id="agreeTerms"
                      checked={formData.agreeTerms}
                      onChange={(e) => handleInputChange('agreeTerms', e.target.checked)}
                      required
                    />
                    <label htmlFor="agreeTerms" className="checkbox-label">
                      I agree to the{' '}
                      <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms & Conditions</Link>,{' '}
                      <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>, and{' '}
                      <Link to="/refund-policy" target="_blank" rel="noopener noreferrer">Refund Policy</Link>. 
                      I verify that the passenger information provided above matches my passport exactly.
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="booking-submit-button"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Redirecting to Stripe Secure Checkout...
                    </>
                  ) : (
                    `Proceed to Payment — $${pricing.total}`
                  )}
                </button>
              </section>

            </form>
          </div>

          {/* Side Summary Card */}
          <aside className="booking-summary-sidebar">
            <div className="summary-sticky-card">
              <h3>Flight Summary</h3>
              
              <div className="itinerary-quick-details">
                <div className="summary-airline-row">
                  <strong>{flight.airline}</strong>
                  <span className="flight-num-badge">{flight.flightNumber}</span>
                </div>
                
                <div className="summary-route-timeline">
                  <div className="timeline-point">
                    <span className="timeline-time">{flight.departure?.time}</span>
                    <span className="timeline-airport">{flight.departure?.airport}</span>
                    <span className="timeline-date">{flight.departure?.date}</span>
                  </div>
                  
                  <div className="timeline-arrow">
                    <i className="fas fa-long-arrow-alt-down"></i>
                    <span className="timeline-duration">{flight.duration}</span>
                  </div>

                  <div className="timeline-point">
                    <span className="timeline-time">{flight.arrival?.time}</span>
                    <span className="timeline-airport">{flight.arrival?.airport}</span>
                    <span className="timeline-date">{flight.arrival?.date}</span>
                  </div>
                </div>

                <div className="summary-flight-meta">
                  <span><i className="fas fa-chair"></i> {flight.class || 'Economy'}</span>
                  <span><i className="fas fa-plane"></i> {flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop(s)`}</span>
                </div>
              </div>

              <div className="price-breakdown-section">
                <h4>Price Details</h4>
                <div className="price-row">
                  <span>Base Ticket Fare</span>
                  <span>${pricing.subtotal}</span>
                </div>
                <div className="price-row">
                  <span>Taxes & Carrier Fees (15%)</span>
                  <span>${pricing.taxes}</span>
                </div>
                <div className="price-row">
                  <span>Advisory & Processing Fee</span>
                  <span>${pricing.serviceFee}</span>
                </div>
                
                <div className="price-total-row">
                  <span>Total Amount Due</span>
                  <strong>${pricing.total} USD</strong>
                </div>
              </div>

              <div className="summary-help-block">
                <p>Need help with your booking?</p>
                <a href={SUPPORT_PHONE_HREF} className="summary-phone-link">
                  <i className="fas fa-phone-alt"></i> {SUPPORT_PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </aside>
        </div>

        <div className="booking-footer-business">
          <p>
            <strong>The Final Seat LLC</strong> · 5830 E 2nd St, Ste 7000, Casper, WY 82609 ·{' '}
            {SUPPORT_PHONE_DISPLAY} · support@thefinalseat.com
          </p>
        </div>
      </div>
    </div>
  );
}

export default Booking;
