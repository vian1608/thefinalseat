import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { WhopCheckoutEmbed } from '@whop/checkout/react';
import { paymentAPI, bookingAPI, whopAPI } from '../../../shared/api/api';

import AccordionSection from '../../../shared/components/AccordionSection';
import ItineraryCard from '../components/ItineraryCard';
import DateOfBirthPicker from '../../../shared/components/DateOfBirthPicker';
import TravelDatePicker from '../../flights/components/TravelDatePicker';
import InternationalPhoneInput from '../../../shared/components/InternationalPhoneInput';
import CountrySelect from '../../../shared/components/CountrySelect';
import EmailInput from '../../../shared/components/EmailInput';

import './BookingPage.css';

const paypalClientId = (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID)) ||
  (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_PAYPAL_CLIENT_ID) ||
  'test';

function Booking() {
  const navigate = useNavigate();
  const [flight, setFlight] = useState(null);
  const [returnFlight, setReturnFlight] = useState(null);
  const [error, setError] = useState('');

  // Payment Method: 'card' (Whop embedded checkout) or 'paypal'
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paypalError, setPaypalError] = useState('');
  const [payPalProcessing, setPayPalProcessing] = useState(false);

  // Whop embedded checkout state
  const [whopCheckoutConfig, setWhopCheckoutConfig] = useState(null);
  const [whopLoading, setWhopLoading] = useState(false);
  const [whopError, setWhopError] = useState('');

  const pendingBookingId = useRef(null);
  const pendingBookingCode = useRef(null);

  // Unique session key for abandoned booking tracking
  const abandonedSessionKey = useRef(
    sessionStorage.getItem('abandonedSessionKey') ||
    `ab_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  );
  useEffect(() => {
    sessionStorage.setItem('abandonedSessionKey', abandonedSessionKey.current);
  }, []);

  // Accordion state
  const [openSections, setOpenSections] = useState({ travellers: true, contact: false, requests: false, payment: false });
  const [showSummaryMobile, setShowSummaryMobile] = useState(false);

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Calculate total pricing based on 10% discount pricing helper
  const calculateTotal = () => {
    const isMock = !!flight?.isMock || !!returnFlight?.isMock;
    const passCount = Math.max(1, passengersList.length || 1);

    const outFinal = parseFloat(flight?.price?.finalPrice || flight?.price?.total || 0);
    const outOriginal = parseFloat(flight?.price?.originalApiPrice || outFinal);
    const outDiscount = isMock ? 0 : parseFloat(flight?.price?.discountAmount || (outOriginal - outFinal));

    const retFinal = returnFlight ? parseFloat(returnFlight?.price?.finalPrice || returnFlight?.price?.total || 0) : 0;
    const retOriginal = returnFlight ? parseFloat(returnFlight?.price?.originalApiPrice || retFinal) : 0;
    const retDiscount = (returnFlight && !isMock) ? parseFloat(returnFlight?.price?.discountAmount || (retOriginal - retFinal)) : 0;

    const perPassOriginal = outOriginal + retOriginal;
    const perPassDiscount = outDiscount + retDiscount;
    const perPassFinal = outFinal + retFinal;

    const supplierPrice = (perPassOriginal * passCount).toFixed(2);
    const discountAmount = (perPassDiscount * passCount).toFixed(2);
    const total = (perPassFinal * passCount).toFixed(2);

    return {
      supplierPrice,
      discountAmount,
      discountPercent: isMock ? 0 : 10,
      total,
      subtotal: total,
      tax: '0.00',
      originalPrice: supplierPrice,
      isMock
    };
  };

  const [primaryContact, setPrimaryContact] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const [contactSameAsTraveller, setContactSameAsTraveller] = useState(false);

  const [specialRequests, setSpecialRequests] = useState({
    wheelchair: false,
    mealPreference: 'none',
    seatingPreference: 'none',
    notes: '',
  });

  const [passengersList, setPassengersList] = useState([]);

  useEffect(() => {
    const flightData = JSON.parse(sessionStorage.getItem('selectedFlight') || 'null');
    if (!flightData) { navigate('/'); return; }
    setFlight(flightData);

    const returnFlightData = JSON.parse(sessionStorage.getItem('returnFlight') || 'null');
    setReturnFlight(returnFlightData);

    const searchParams = JSON.parse(sessionStorage.getItem('searchParams') || '{}');
    const adults = parseInt(searchParams.adults || 1, 10);
    const children = parseInt(searchParams.children || 0, 10);
    const infants = parseInt(searchParams.infants || 0, 10);

    const initialList = [];
    for (let i = 0; i < adults; i++) {
      initialList.push(createPassenger('adult'));
    }
    for (let i = 0; i < children; i++) {
      initialList.push(createPassenger('child'));
    }
    for (let i = 0; i < infants; i++) {
      initialList.push(createPassenger('infant'));
    }
    setPassengersList(initialList);

    // Save abandoned booking snapshot to Supabase
    bookingAPI.saveAbandoned({
      sessionKey: abandonedSessionKey.current,
      selectedFlight: flightData,
      returnFlight: returnFlightData,
      travellerInfo: null,
      contactInfo: null,
      currentStep: 'travellers',
    }).catch(() => {/* non-blocking */});
  }, [navigate]);

  function createPassenger(role) {
    return {
      role,
      title: '',
      firstName: '',
      middleName: '',
      lastName: '',
      gender: '',
      dateOfBirth: '',
      nationality: 'United States',
      passportNumber: '',
      passportExpiry: '',
      knownTravelerNumber: '',
      redressNumber: '',
    };
  }

  useEffect(() => {
    if (contactSameAsTraveller && passengersList.length > 0) {
      const t1 = passengersList[0];
      setPrimaryContact(prev => ({
        ...prev,
        firstName: t1.firstName,
        lastName: t1.lastName,
      }));
    }
  }, [contactSameAsTraveller, passengersList]);

  const handlePrimaryContactChange = (field, value) => {
    setPrimaryContact(prev => ({ ...prev, [field]: value }));
  };

  const handleSpecialRequestsChange = (field, value) => {
    setSpecialRequests(prev => ({ ...prev, [field]: value }));
  };

  const handlePassengerChange = (index, field, value) => {
    setPassengersList(prev => {
      const newList = [...prev];
      newList[index] = { ...newList[index], [field]: value };
      return newList;
    });
  };

  const validateForm = () => {
    if (!primaryContact.firstName || !primaryContact.lastName || !primaryContact.email || !primaryContact.phone) {
      setError('Please fill in all primary contact details (First Name, Last Name, Email, Phone).');
      setOpenSections({ travellers: false, contact: true, requests: false, payment: false });
      return false;
    }

    for (let i = 0; i < passengersList.length; i++) {
      const p = passengersList[i];
      if (!p.firstName || !p.lastName || !p.gender || !p.dateOfBirth) {
        setError(`Please complete all required fields for Traveler #${i + 1} (First Name, Last Name, Gender, DOB).`);
        setOpenSections({ travellers: true, contact: false, requests: false, payment: false });
        return false;
      }
    }
    return true;
  };

  const createPendingBookingRecord = async () => {
    if (pendingBookingId.current) {
      return { id: pendingBookingId.current, code: pendingBookingCode.current };
    }

    const pricing = calculateTotal();
    const customerName = `${primaryContact.firstName} ${primaryContact.lastName}`;
    const flightObj = {
      ...flight,
      returnFlight: returnFlight,
      specialRequests: specialRequests
    };

    const bookingPayload = {
      customerName,
      email: primaryContact.email,
      phone: primaryContact.phone,
      passengers: passengersList,
      flight: flightObj,
      returnFlight: returnFlight,
      originalApiPrice: pricing.supplierPrice,
      supplier_price: pricing.supplierPrice,
      discount_percent: pricing.discountPercent,
      discount_amount: pricing.discountAmount,
      customer_price: pricing.total,
      displayedWebsitePrice: pricing.total,
      paymentStatus: 'pending',
      payment_provider: 'whop',
      currency: 'USD',
      status: 'PENDING',
      isMock: pricing.isMock
    };

    const res = await bookingAPI.create(bookingPayload);
    if (res && res.success) {
      const bId = res.data.id;
      const bCode = res.data.confirmation_code || res.data.confirmationCode;
      pendingBookingId.current = bId;
      pendingBookingCode.current = bCode;
      return { id: bId, code: bCode };
    } else {
      throw new Error('Unable to register pending booking in backend.');
    }
  };

  const handleInitWhopCheckout = async () => {
    setWhopError('');
    setError('');

    if (!validateForm()) return;

    setWhopLoading(true);
    try {
      // 1. Create or reuse pending booking in Supabase
      const pending = await createPendingBookingRecord();

      // 2. Request backend Whop checkout configuration using ONLY bookingId
      const res = await whopAPI.createCheckout(pending.id);

      if (res && res.success && res.sessionId) {
        setWhopCheckoutConfig(res);
      } else {
        throw new Error(res.error?.message || 'Failed to initialize Whop checkout configuration');
      }
    } catch (err) {
      console.error('Whop checkout initialization error:', err);
      setWhopError(
        err.response?.data?.error?.message || err.message ||
        'Unable to initialize Whop card checkout. Please verify traveler information.'
      );
    } finally {
      setWhopLoading(false);
    }
  };

  const handlePayPalCreateOrder = async () => {
    setPayPalProcessing(true);
    setPaypalError('');
    setError('');

    try {
      if (!validateForm()) {
        setPayPalProcessing(false);
        throw new Error('Please fill in all required traveler and contact details before checkout.');
      }

      const pending = await createPendingBookingRecord();
      const res = await paymentAPI.createPayPalOrder(pending.id);

      if (res && res.success && res.orderId) {
        return res.orderId;
      } else {
        throw new Error(res.error?.message || 'Failed to create PayPal order');
      }
    } catch (err) {
      console.error('PayPal Order creation failed:', err);
      setPaypalError(err.message || 'Unable to connect to PayPal. Please try again.');
      setPayPalProcessing(false);
      throw err;
    }
  };

  const handlePayPalApprove = async (data) => {
    setPayPalProcessing(true);
    setPaypalError('');
    try {
      const bId = pendingBookingId.current;
      const bCode = pendingBookingCode.current;

      const res = await paymentAPI.capturePayPalOrder(bId, data.orderID);

      if (res && res.success) {
        bookingAPI.deleteAbandoned(abandonedSessionKey.current).catch(() => {});
        sessionStorage.removeItem('abandonedSessionKey');

        navigate(`/confirmation/success?session_id=${data.orderID}&type=booking&booking_id=${bId}&code=${bCode}`);
      } else {
        throw new Error(res.error?.message || 'PayPal payment capture failed.');
      }
    } catch (err) {
      console.error('PayPal Capture failed:', err);
      setPaypalError(err.message || 'Payment capture failed. Please contact support.');
    } finally {
      setPayPalProcessing(false);
    }
  };

  const handlePayPalCancel = () => {
    setPayPalProcessing(false);
    setPaypalError('PayPal payment was cancelled. You can try again or select credit card.');
  };

  const handlePayPalError = (err) => {
    setPayPalProcessing(false);
    console.error('PayPal button error:', err);
    setPaypalError('A PayPal checkout error occurred. Please verify details or try card payment.');
  };

  if (!flight) {
    return (
      <div className="booking-page-loading">
        <i className="fas fa-circle-notch fa-spin"></i>
        <p>Loading itinerary details...</p>
      </div>
    );
  }

  const pricing = calculateTotal();
  const isTrain = !!flight.isTrain;

  return (
    <div className="booking-page">
      <Helmet>
        <title>Flight Booking & Passenger Details | The Final Seat</title>
      </Helmet>

      <div className="booking-hero-strip">
        <div className="container">
          <div className="hero-strip-content">
            <h2>Complete Your Reservation</h2>
            <p>Enter traveler information to secure your 10% discounted airfare with Instant Electronic Ticketing.</p>
          </div>
        </div>
      </div>

      <div className="container booking-main-container">
        <div className="booking-layout">
          <div className="booking-form-area">

            {error && (
              <div className="booking-global-error" role="alert">
                <i className="fas fa-exclamation-circle"></i>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={(e) => e.preventDefault()}>

              {/* SECTION 1: TRAVELLER DETAILS */}
              <AccordionSection
                title={`1. Traveler Details (${passengersList.length} Passenger${passengersList.length > 1 ? 's' : ''})`}
                isOpen={openSections.travellers}
                onToggle={() => toggleSection('travellers')}
                icon="fas fa-users"
                badgeText="Step 1"
              >
                {passengersList.map((passenger, idx) => (
                  <div key={idx} className="passenger-card-block">
                    <h4 className="passenger-card-title">
                      <i className="fas fa-user"></i> Passenger #{idx + 1} ({passenger.role.toUpperCase()})
                    </h4>

                    <div className="booking-form-grid booking-form-grid--3col">
                      <label className="booking-form-field">
                        Title *
                        <select
                          value={passenger.title}
                          onChange={(e) => handlePassengerChange(idx, 'title', e.target.value)}
                          required
                        >
                          <option value="">Select</option>
                          <option value="Mr">Mr.</option>
                          <option value="Mrs">Mrs.</option>
                          <option value="Ms">Ms.</option>
                          <option value="Dr">Dr.</option>
                        </select>
                      </label>

                      <label className="booking-form-field">
                        First Name *
                        <input
                          type="text"
                          value={passenger.firstName}
                          onChange={(e) => handlePassengerChange(idx, 'firstName', e.target.value)}
                          required
                          placeholder="First Name (as on Passport/ID)"
                        />
                      </label>

                      <label className="booking-form-field">
                        Middle Name
                        <input
                          type="text"
                          value={passenger.middleName}
                          onChange={(e) => handlePassengerChange(idx, 'middleName', e.target.value)}
                          placeholder="Middle Name (optional)"
                        />
                      </label>
                    </div>

                    <div className="booking-form-grid booking-form-grid--3col" style={{ marginTop: '0.85rem' }}>
                      <label className="booking-form-field">
                        Last Name *
                        <input
                          type="text"
                          value={passenger.lastName}
                          onChange={(e) => handlePassengerChange(idx, 'lastName', e.target.value)}
                          required
                          placeholder="Last Name (as on Passport/ID)"
                        />
                      </label>

                      <label className="booking-form-field">
                        Gender *
                        <select
                          value={passenger.gender}
                          onChange={(e) => handlePassengerChange(idx, 'gender', e.target.value)}
                          required
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </label>

                      <div className="booking-form-field">
                        <label>Date of Birth *</label>
                        <DateOfBirthPicker
                          id={`dob-pass-${idx}`}
                          value={passenger.dateOfBirth}
                          onChange={(val) => handlePassengerChange(idx, 'dateOfBirth', val)}
                          required
                        />
                      </div>
                    </div>

                    <div className="booking-form-grid booking-form-grid--3col" style={{ marginTop: '0.85rem' }}>
                      <div className="booking-form-field">
                        <label>Nationality</label>
                        <CountrySelect
                          id={`nat-pass-${idx}`}
                          value={passenger.nationality}
                          onChange={(val) => handlePassengerChange(idx, 'nationality', val)}
                        />
                      </div>

                      <label className="booking-form-field">
                        Passport Number
                        <input
                          type="text"
                          value={passenger.passportNumber}
                          onChange={(e) => handlePassengerChange(idx, 'passportNumber', e.target.value.toUpperCase())}
                          placeholder="Passport Number (if intl)"
                        />
                      </label>

                      <div className="booking-form-field">
                        <label>Passport Expiry</label>
                        <TravelDatePicker
                          id={`passport-exp-${idx}`}
                          value={passenger.passportExpiry}
                          onChange={(val) => handlePassengerChange(idx, 'passportExpiry', val)}
                          placeholder="YYYY-MM-DD"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </AccordionSection>

              {/* SECTION 2: PRIMARY CONTACT INFO */}
              <AccordionSection
                title="2. Primary Contact Details"
                isOpen={openSections.contact}
                onToggle={() => toggleSection('contact')}
                icon="fas fa-envelope"
                badgeText="Step 2"
              >
                <div className="contact-checkbox-row">
                  <input
                    type="checkbox"
                    id="contactSame"
                    checked={contactSameAsTraveller}
                    onChange={(e) => setContactSameAsTraveller(e.target.checked)}
                  />
                  <label htmlFor="contactSame">Primary contact is Passenger #1</label>
                </div>

                <div className="booking-form-grid">
                  <label className="booking-form-field">
                    Contact First Name *
                    <input
                      type="text"
                      value={primaryContact.firstName}
                      onChange={(e) => handlePrimaryContactChange('firstName', e.target.value)}
                      required
                      placeholder="First Name"
                    />
                  </label>

                  <label className="booking-form-field">
                    Contact Last Name *
                    <input
                      type="text"
                      value={primaryContact.lastName}
                      onChange={(e) => handlePrimaryContactChange('lastName', e.target.value)}
                      required
                      placeholder="Last Name"
                    />
                  </label>
                </div>

                <div className="booking-form-grid" style={{ marginTop: '0.85rem' }}>
                  <div className="booking-form-field">
                    <label>Email Address (For E-Ticket) *</label>
                    <EmailInput
                      id="contact-email"
                      value={primaryContact.email}
                      onChange={(val) => handlePrimaryContactChange('email', val)}
                      required
                    />
                  </div>

                  <div className="booking-form-field">
                    <label>Phone Number (For Flight SMS Updates) *</label>
                    <InternationalPhoneInput
                      id="contact-phone"
                      value={primaryContact.phone}
                      onChange={(val) => handlePrimaryContactChange('phone', val)}
                      required
                    />
                  </div>
                </div>
              </AccordionSection>

              {/* SECTION 3: SPECIAL REQUESTS */}
              <AccordionSection
                title="3. Special Requests & Preferences"
                isOpen={openSections.requests}
                onToggle={() => toggleSection('requests')}
                icon="fas fa-concierge-bell"
                badgeText="Optional"
              >
                <div className="booking-form-grid booking-form-grid--3col">
                  <label className="booking-form-field">
                    Meal Preference
                    <select
                      value={specialRequests.mealPreference}
                      onChange={(e) => handleSpecialRequestsChange('mealPreference', e.target.value)}
                    >
                      <option value="none">Standard Airline Meal</option>
                      <option value="vegetarian">Vegetarian / Vegan</option>
                      <option value="kosher">Kosher</option>
                      <option value="halal">Halal</option>
                      <option value="child">Child Meal</option>
                    </select>
                  </label>

                  <label className="booking-form-field">
                    Seat Preference
                    <select
                      value={specialRequests.seatingPreference}
                      onChange={(e) => handleSpecialRequestsChange('seatingPreference', e.target.value)}
                    >
                      <option value="none">No Preference</option>
                      <option value="aisle">Aisle Seat</option>
                      <option value="window">Window Seat</option>
                      <option value="extra_legroom">Extra Legroom (if available)</option>
                    </select>
                  </label>

                  <div className="checkbox-field-wrapper" style={{ marginTop: '1.75rem' }}>
                    <input
                      type="checkbox"
                      id="wheelchair-check"
                      checked={specialRequests.wheelchair}
                      onChange={(e) => handleSpecialRequestsChange('wheelchair', e.target.checked)}
                    />
                    <label htmlFor="wheelchair-check">Request Wheelchair Assistance</label>
                  </div>
                </div>

                <div className="booking-form-field" style={{ marginTop: '0.85rem' }}>
                  <label>Additional Advisory Notes</label>
                  <textarea
                    rows={3}
                    value={specialRequests.notes}
                    onChange={(e) => handleSpecialRequestsChange('notes', e.target.value)}
                    placeholder="Enter special assistance requests, frequent flyer numbers, etc."
                  />
                </div>
              </AccordionSection>

              {/* SECTION 4: SECURE PAYMENT METHOD */}
              <AccordionSection
                title="4. Secure Payment Method"
                isOpen={openSections.payment}
                onToggle={() => toggleSection('payment')}
                icon="fas fa-lock"
                badgeText="Final Step"
              >
                <div className="payment-method-selector">
                  <button
                    type="button"
                    className={`payment-method-tab ${paymentMethod === 'card' ? 'active' : ''}`}
                    onClick={() => { setPaymentMethod('card'); setError(''); setWhopError(''); }}
                  >
                    <i className="fas fa-credit-card" style={{ color: '#1e3a5f' }}></i> Credit / Debit Card (Whop)
                  </button>
                  <button
                    type="button"
                    className={`payment-method-tab ${paymentMethod === 'paypal' ? 'active' : ''}`}
                    onClick={() => { setPaymentMethod('paypal'); setError(''); }}
                  >
                    <i className="fab fa-paypal" style={{ color: '#003087' }}></i> PayPal / Pay Later
                  </button>
                </div>

                {paymentMethod === 'card' ? (
                  <div className="whop-checkout-box">
                    <div className="payment-security-notice">
                      <i className="fas fa-shield-alt"></i>
                      <span>Your payment is processed securely via Whop 256-Bit Encrypted Embedded Checkout. We never store or access your card information.</span>
                    </div>

                    {whopError && (
                      <div className="whop-error-notice" role="alert" style={{ margin: '1rem 0', padding: '0.85rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
                        <i className="fas fa-exclamation-circle" style={{ marginRight: '0.5rem' }}></i>
                        <span>{whopError}</span>
                      </div>
                    )}

                    {!whopCheckoutConfig ? (
                      <div className="whop-init-container" style={{ margin: '1.25rem 0' }}>
                        <button
                          type="button"
                          onClick={handleInitWhopCheckout}
                          className="amtrak-btn amtrak-btn--cta amtrak-btn--full"
                          disabled={whopLoading}
                        >
                          {whopLoading ? (
                            <span><i className="fas fa-circle-notch fa-spin"></i> Initializing Secure Whop Checkout...</span>
                          ) : (
                            <span><i className="fas fa-lock"></i> Proceed to Card Payment — ${pricing.total} USD</span>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="whop-embed-wrapper" style={{ marginTop: '1.25rem' }}>
                        {/* Price breakdown display immediately above embed */}
                        <div className="whop-price-breakdown-card" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                          <h4 style={{ margin: '0 0 0.75rem', color: '#1e3a5f', fontSize: '1rem', fontWeight: '700' }}>
                            <i className="fas fa-receipt" style={{ marginRight: '0.4rem' }}></i> Final Seat Fare Breakdown
                          </h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.92rem', color: '#475569' }}>
                            <span>Supplier Airfare Total</span>
                            <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>
                              ${whopCheckoutConfig.price?.supplierPrice || pricing.supplierPrice} USD
                            </span>
                          </div>
                          {!pricing.isMock && parseFloat(whopCheckoutConfig.price?.discountAmount || pricing.discountAmount) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.92rem', color: '#047857', fontWeight: '600' }}>
                              <span>Final Seat Subsidy (10% OFF)</span>
                              <span>-${whopCheckoutConfig.price?.discountAmount || pricing.discountAmount} USD</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #cbd5e1', fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
                            <span>Total Whop Charge</span>
                            <span style={{ color: '#0f2744' }}>${whopCheckoutConfig.price?.customerPrice || pricing.total} USD</span>
                          </div>
                        </div>

                        {/* Whop React Embed Component */}
                        <div className="whop-embed-frame-container">
                          <WhopCheckoutEmbed
                            planId={whopCheckoutConfig.planId}
                            sessionId={whopCheckoutConfig.sessionId}
                            prefill={{ email: primaryContact.email }}
                            returnUrl={`${window.location.origin}/confirmation/success?type=booking&booking_id=${pendingBookingId.current}&code=${pendingBookingCode.current}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="paypal-container">
                    <div className="paypal-notice">
                      <i className="fab fa-paypal" style={{ fontSize: '1.25rem' }}></i>
                      <span>Pay securely with PayPal, Pay in 4, or Credit. You will review your booking before final capture.</span>
                    </div>

                    {paypalError && (
                      <div className="paypal-error-notice" role="alert">
                        <i className="fas fa-exclamation-circle"></i>
                        <span>{paypalError}</span>
                      </div>
                    )}

                    {payPalProcessing && (
                      <div className="paypal-processing-overlay">
                        <i className="fas fa-circle-notch fa-spin fa-2x"></i>
                        <span>Processing secure PayPal checkout...</span>
                      </div>
                    )}

                    <PayPalScriptProvider options={{ "client-id": paypalClientId, currency: "USD", intent: "capture" }}>
                      <PayPalButtons
                        style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal" }}
                        disabled={payPalProcessing}
                        createOrder={handlePayPalCreateOrder}
                        onApprove={handlePayPalApprove}
                        onCancel={handlePayPalCancel}
                        onError={handlePayPalError}
                      />
                    </PayPalScriptProvider>
                  </div>
                )}
              </AccordionSection>

              <div className="verification-block">
                <div className="verification-inner">
                  <input type="checkbox" id="agree-check" required />
                  <label htmlFor="agree-check" className="verification-label">
                    I agree to the <Link to="/terms" target="_blank">Terms of Service</Link>, <Link to="/privacy-policy" target="_blank">Privacy Policy</Link>, and <Link to="/refund-policy" target="_blank">Refund Policy</Link>. I verify that the passenger credentials entered above match official photo IDs exactly.
                  </label>
                </div>
              </div>

            </form>
          </div>

          <aside className="booking-summary-sidebar">
            <button 
              type="button" 
              className="mobile-summary-toggle-bar"
              onClick={() => setShowSummaryMobile(!showSummaryMobile)}
            >
              <span><i className="fas fa-receipt"></i> {showSummaryMobile ? 'Hide Trip Summary' : 'Show Trip Summary'}</span>
              <strong>${pricing.total} USD <i className={`fas fa-chevron-${showSummaryMobile ? 'up' : 'down'}`}></i></strong>
            </button>
            <div className={`summary-sticky-card ${showSummaryMobile ? 'mobile-expanded' : 'mobile-collapsed'}`}>
              <h3 className="summary-card-title">Itinerary Summary</h3>

              <ItineraryCard
                flight={flight}
                label="Outbound"
                labelColor="#1e3a5f"
                isTrain={isTrain}
              />

              {returnFlight && (
                <ItineraryCard
                  flight={returnFlight}
                  label="Return"
                  labelColor="#8b1538"
                  isTrain={returnFlight.isTrain}
                />
              )}

              <div className="price-breakdown-section">
                <h4>Pricing Breakdown</h4>
                <div className="price-row">
                  <span>Supplier Airfare ({passengersList.length || 1} traveler{passengersList.length > 1 ? 's' : ''})</span>
                  <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>${pricing.supplierPrice}</span>
                </div>
                {!pricing.isMock && parseFloat(pricing.discountAmount) > 0 && (
                  <div className="price-row price-row--discount" style={{ color: '#047857', fontWeight: 600 }}>
                    <span>Final Seat Subsidy (10% OFF)</span>
                    <span>-${pricing.discountAmount}</span>
                  </div>
                )}
                <div className="price-row price-row--total">
                  <strong>Total Customer Price</strong>
                  <strong className="price-total-amount">${pricing.total} USD</strong>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default Booking;
