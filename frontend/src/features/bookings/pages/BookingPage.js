import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { bookingAPI } from '../../../shared/api/api';

import AccordionSection from '../../../shared/components/AccordionSection';
import ItineraryCard from '../components/ItineraryCard';
import DateOfBirthPicker from '../../../shared/components/DateOfBirthPicker';
import TravelDatePicker from '../../flights/components/TravelDatePicker';
import InternationalPhoneInput from '../../../shared/components/InternationalPhoneInput';
import CountrySelect from '../../../shared/components/CountrySelect';
import EmailInput from '../../../shared/components/EmailInput';

import './BookingPage.css';

const detectCardBrand = (number = '') => {
  const clean = number.replace(/\D/g, '');
  if (/^4/.test(clean)) return { brand: 'visa', name: 'Visa', icon: 'fa-cc-visa', color: '#1a1f71' };
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[0-1]|2720)/.test(clean)) return { brand: 'mastercard', name: 'Mastercard', icon: 'fa-cc-mastercard', color: '#eb001b' };
  if (/^3[47]/.test(clean)) return { brand: 'amex', name: 'American Express', icon: 'fa-cc-amex', color: '#006fcf' };
  if (/^(6011|65|64[4-9]|622)/.test(clean)) return { brand: 'discover', name: 'Discover', icon: 'fa-cc-discover', color: '#f9a01b' };
  return { brand: 'generic', name: 'Credit Card', icon: 'fa-credit-card', color: '#475569' };
};

const formatCardNumber = (val = '') => {
  const clean = val.replace(/\D/g, '').slice(0, 16);
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
};

const formatExpDate = (val = '') => {
  const clean = val.replace(/\D/g, '').slice(0, 4);
  if (clean.length >= 3) {
    return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  }
  return clean;
};

const formatCch = (val = '') => {
  return val.replace(/\D/g, '').slice(0, 4);
};

function Booking() {
  const navigate = useNavigate();
  const [flight, setFlight] = useState(null);
  const [returnFlight, setReturnFlight] = useState(null);
  const [error, setError] = useState('');

  // Single unified Credit / Debit Card & Billing state
  const [cardForm, setCardForm] = useState({
    cardholderName: '',
    cardNumber: '',
    expDate: '',
    cch: '', // CCH / CVV / CVC
    billingPhone: '',
    billingAddress: '',
    billingAddress2: '',
    billingCity: '',
    billingState: '',
    billingZip: '',
    billingCountry: 'United States'
  });
  const [cardError, setCardError] = useState('');
  const [cardProcessing, setCardProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

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
  const [termsAccepted, setTermsAccepted] = useState(false);

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

  // Dynamic step completion flags (Turn green checkmark when valid, revert to red when invalid)
  const isStep1Complete = passengersList.length > 0 && passengersList.every(p => 
    !!(p.firstName && p.firstName.trim() && p.lastName && p.lastName.trim() && p.gender && p.dateOfBirth)
  );

  const isStep2Complete = !!(
    primaryContact.firstName && primaryContact.firstName.trim() && 
    primaryContact.lastName && primaryContact.lastName.trim() && 
    primaryContact.email && primaryContact.email.trim() && 
    primaryContact.phone && primaryContact.phone.trim()
  );

  const isStep3Complete = true; // Special requests section is optional
  const isStep4Complete = paymentComplete && termsAccepted;

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
    if (!isStep2Complete) {
      setError('Please fill in all primary contact details (First Name, Last Name, Email, Phone).');
      setOpenSections({ travellers: false, contact: true, requests: false, payment: false });
      return false;
    }

    if (!isStep1Complete) {
      setError('Please complete all required fields for all travelers (First Name, Last Name, Gender, DOB).');
      setOpenSections({ travellers: true, contact: false, requests: false, payment: false });
      return false;
    }
    return true;
  };

  const [samePhone, setSamePhone] = useState(false);
  const idempotencyKeyRef = useRef(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

  const handleSamePhoneChange = (e) => {
    const checked = e.target.checked;
    setSamePhone(checked);
    if (checked && primaryContact.phone) {
      setCardForm(prev => ({ ...prev, billingPhone: primaryContact.phone }));
    }
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

    const cleanCardNum = cardForm.cardNumber.replace(/\D/g, '');
    const cardLast4 = cleanCardNum.slice(-4) || '4242';
    const cardBrand = detectCardBrand(cardForm.cardNumber).name;

    const bookingPayload = {
      idempotency_key: idempotencyKeyRef.current,
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
      payment_provider: 'card',
      cardholderName: cardForm.cardholderName,
      cardLast4,
      cardBrand,
      cardExpDate: cardForm.expDate,
      card_exp_date: cardForm.expDate,
      billingPhone: cardForm.billingPhone,
      billingAddress: `${cardForm.billingAddress}${cardForm.billingAddress2 ? `, ${cardForm.billingAddress2}` : ''}`,
      billingCity: cardForm.billingCity,
      billingState: cardForm.billingState,
      billingZip: cardForm.billingZip,
      billingCountry: cardForm.billingCountry,
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
      throw new Error(res?.error?.message || 'Unable to register reservation in database. Please check details and try again.');
    }
  };

  const handleDirectCardPayment = async () => {
    setCardError('');
    setError('');

    if (!validateForm()) {
      setCardError('Please fill in all required traveler and contact details above.');
      return;
    }

    if (!termsAccepted) {
      setCardError('Please read and accept the Terms of Service, Privacy Policy, and Refund Policy before proceeding.');
      return;
    }

    if (!cardForm.cardholderName.trim()) {
      setCardError('Please enter the cardholder full name as printed on the card.');
      return;
    }

    const cleanNum = cardForm.cardNumber.replace(/\D/g, '');
    if (cleanNum.length < 15 || cleanNum.length > 16) {
      setCardError('Please enter a valid 15 or 16-digit credit/debit card number.');
      return;
    }

    if (!cardForm.expDate || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardForm.expDate)) {
      setCardError('Please enter a valid expiration date in MM/YY format (e.g. 12/28).');
      return;
    }

    if (!cardForm.cch || cardForm.cch.length < 3) {
      setCardError('Please enter a valid 3 or 4-digit CCH / Security Code (CVV).');
      return;
    }

    if (!cardForm.billingAddress.trim()) {
      setCardError('Please enter the billing street address.');
      return;
    }

    if (!cardForm.billingCity.trim() || !cardForm.billingState.trim() || !cardForm.billingZip.trim()) {
      setCardError('Please complete the billing city, state, and ZIP / postal code.');
      return;
    }

    if (!cardForm.billingPhone.trim()) {
      setCardError('Please enter a billing phone number.');
      return;
    }

    setCardProcessing(true);

    try {
      // 1. Create atomic reservation record in Supabase
      const pending = await createPendingBookingRecord();
      const bCode = pending.code;

      // 2. Remove abandoned session tracking
      bookingAPI.deleteAbandoned(abandonedSessionKey.current).catch(() => {});
      sessionStorage.removeItem('abandonedSessionKey');

      setPaymentComplete(true);

      // 3. Navigate to dedicated reservation confirmation page
      navigate(`/booking-confirmed/${encodeURIComponent(bCode)}?email=${encodeURIComponent(primaryContact.email)}`);
    } catch (err) {
      console.error('Card payment processing error:', err);
      setCardError(err.response?.data?.error?.message || err.message || 'We could not securely process your reservation. Please review details and try again.');
    } finally {
      setCardProcessing(false);
    }
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

      {/* ── Premium Booking Hero ──────────────────────────────────── */}
      <section className="booking-hero-premium">
        <div className="booking-hero-premium__inner">
          <p className="booking-hero-premium__eyebrow">
            <i className="fas fa-star"></i>
            Exclusive Member Fare · 10% Discount Applied
          </p>
          <h1>
            Secure Your <span className="highlight-gold">Discounted</span> Flight Reservation
          </h1>
          <p className="booking-hero-premium__subtitle">
            Review your itinerary below and enter traveler details to lock in your{' '}
            <strong style={{ color: '#f59e0b' }}>10% discounted airfare</strong> with fast
            electronic ticketing and secure, encrypted checkout.
          </p>
          <div className="booking-hero-premium__badges">
            <span className="booking-hero-badge booking-hero-badge--discount">
              <i className="fas fa-tag"></i>
              10% Final Seat Discount
            </span>
            <span className="booking-hero-badge">
              <i className="fas fa-shield-alt"></i>
              256-Bit Encrypted Checkout
            </span>
            <span className="booking-hero-badge">
              <i className="fas fa-bolt"></i>
              Instant E-Ticket Delivery
            </span>
            <span className="booking-hero-badge">
              <i className="fas fa-headset"></i>
              24/7 Booking Support
            </span>
          </div>
        </div>
      </section>

      {/* ── Itinerary Top Panel ───────────────────────────────────── */}
      <div className="booking-itinerary-top-panel">
        <div className="booking-itinerary-top-panel__inner">
          <p className="booking-itinerary-top-panel__title">
            <i className="fas fa-map-marked-alt"></i>
            Your Selected Itinerary
          </p>
          <div className={`booking-itinerary-top-grid${returnFlight ? '' : '--single'}`}
               style={{ display: 'grid', gridTemplateColumns: returnFlight ? '1fr 1fr auto' : '1fr auto', gap: '1.25rem', alignItems: 'start' }}>
            <ItineraryCard
              flight={flight}
              label="Outbound Flight"
              labelColor="#1e3a5f"
              isTrain={isTrain}
            />
            {returnFlight && (
              <ItineraryCard
                flight={returnFlight}
                label="Return Flight"
                labelColor="#8b1538"
                isTrain={returnFlight.isTrain}
              />
            )}
            {/* Pricing summary chip */}
            <div className="booking-itinerary-pricing-summary">
              {!pricing.isMock && parseFloat(pricing.discountAmount) > 0 && (
                <p className="booking-itinerary-pricing-summary__original">
                  ${pricing.supplierPrice} USD
                </p>
              )}
              <p className="booking-itinerary-pricing-summary__discounted">
                ${pricing.total} <small style={{ fontSize: '0.7em', fontWeight: 600, color: '#64748b' }}>USD</small>
              </p>
              {!pricing.isMock && parseFloat(pricing.discountAmount) > 0 && (
                <>
                  <span className="booking-itinerary-pricing-summary__chip">
                    <i className="fas fa-tag" style={{ fontSize: '0.55rem' }}></i>
                    10% OFF
                  </span>
                  <p className="booking-itinerary-pricing-summary__saving">
                    You save ${pricing.discountAmount}
                  </p>
                </>
              )}
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.5rem', marginBottom: 0 }}>
                {passengersList.length || 1} traveler{(passengersList.length > 1) ? 's' : ''} · All taxes included
              </p>
            </div>
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
                id="travellers"
                stepNumber="1"
                title={`1. Traveler Details (${passengersList.length} Passenger${passengersList.length > 1 ? 's' : ''})`}
                isOpen={openSections.travellers}
                onToggle={() => toggleSection('travellers')}
                isComplete={isStep1Complete}
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
                id="contact"
                stepNumber="2"
                title="2. Primary Contact Details"
                isOpen={openSections.contact}
                onToggle={() => toggleSection('contact')}
                isComplete={isStep2Complete}
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
                id="requests"
                stepNumber="3"
                title="3. Special Requests & Preferences"
                isOpen={openSections.requests}
                onToggle={() => toggleSection('requests')}
                isComplete={isStep3Complete}
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

              {/* SECTION 4: SECURE CREDIT / DEBIT CARD PAYMENT */}
              <AccordionSection
                id="payment"
                stepNumber="4"
                title="4. Secure Credit / Debit Card Payment"
                isOpen={openSections.payment}
                onToggle={() => toggleSection('payment')}
                isComplete={isStep4Complete}
              >
                <div className="card-payment-container">
                  {/* Security Notice Header */}
                  <div className="card-payment-header">
                    <div className="security-badge-group">
                      <span className="secure-badge"><i className="fas fa-lock"></i> 256-Bit SSL Encrypted</span>
                      <span className="secure-badge"><i className="fas fa-shield-alt"></i> PCI-DSS Compliant</span>
                    </div>
                    <div className="card-brand-logos">
                      <i className="fab fa-cc-visa" title="Visa"></i>
                      <i className="fab fa-cc-mastercard" title="Mastercard"></i>
                      <i className="fab fa-cc-amex" title="American Express"></i>
                      <i className="fab fa-cc-discover" title="Discover"></i>
                    </div>
                  </div>

                  {/* Card Details Box */}
                  <div className="card-details-box">
                    <h4 className="payment-sub-heading">
                      <i className="fas fa-credit-card"></i> Card Details
                    </h4>

                    <div className="booking-form-field">
                      <label htmlFor="cardholderName">Cardholder Full Name <span style={{ color: '#dc2626' }}>*</span></label>
                      <input
                        type="text"
                        id="cardholderName"
                        placeholder="e.g. Johnathan Doe"
                        value={cardForm.cardholderName}
                        onChange={(e) => setCardForm({ ...cardForm, cardholderName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="booking-form-field" style={{ marginTop: '0.85rem' }}>
                      <label htmlFor="cardNumber">Card Number <span style={{ color: '#dc2626' }}>*</span></label>
                      <div className="card-input-wrapper">
                        <input
                          type="text"
                          id="cardNumber"
                          placeholder="0000 0000 0000 0000"
                          value={cardForm.cardNumber}
                          onChange={(e) => setCardForm({ ...cardForm, cardNumber: formatCardNumber(e.target.value) })}
                          maxLength={19}
                          required
                        />
                        <span className="card-brand-icon">
                          <i className={`fab ${detectCardBrand(cardForm.cardNumber).icon}`} style={{ color: detectCardBrand(cardForm.cardNumber).color }}></i>
                        </span>
                      </div>
                    </div>

                    <div className="form-row-two">
                      <div className="booking-form-field">
                        <label htmlFor="expDate">Expiration Date (MM/YY) <span style={{ color: '#dc2626' }}>*</span></label>
                        <input
                          type="text"
                          id="expDate"
                          placeholder="MM/YY"
                          value={cardForm.expDate}
                          onChange={(e) => setCardForm({ ...cardForm, expDate: formatExpDate(e.target.value) })}
                          maxLength={5}
                          required
                        />
                      </div>

                      <div className="booking-form-field">
                        <label htmlFor="cch">
                          Security Code (CVV / CCH) <span style={{ color: '#dc2626' }}>*</span>
                          <span className="cch-tooltip" title="3-digit CCH code on the back of Visa/Mastercard, or 4 digits on the front of AMEX">
                            <i className="fas fa-question-circle"></i>
                          </span>
                        </label>
                        <input
                          type="password"
                          id="cch"
                          placeholder="123"
                          value={cardForm.cch}
                          onChange={(e) => setCardForm({ ...cardForm, cch: formatCch(e.target.value) })}
                          maxLength={4}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Billing Address & Phone Box */}
                  <div className="billing-address-box">
                    <h4 className="payment-sub-heading">
                      <i className="fas fa-map-marker-alt"></i> Billing Address & Phone Number
                    </h4>

                    <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="samePhone"
                        checked={samePhone}
                        onChange={handleSamePhoneChange}
                      />
                      <label htmlFor="samePhone" style={{ fontSize: '0.88rem', color: '#475569', cursor: 'pointer' }}>
                        Billing phone is the same as passenger phone
                      </label>
                    </div>

                    <div className="booking-form-field">
                      <label htmlFor="billingPhone">Billing Phone Number <span style={{ color: '#dc2626' }}>*</span></label>
                      <input
                        type="tel"
                        id="billingPhone"
                        placeholder="e.g. +1 (555) 000-0000"
                        value={cardForm.billingPhone}
                        onChange={(e) => setCardForm({ ...cardForm, billingPhone: e.target.value })}
                        required
                      />
                    </div>

                    <div className="booking-form-field" style={{ marginTop: '0.85rem' }}>
                      <label htmlFor="billingAddress">Street Address <span style={{ color: '#dc2626' }}>*</span></label>
                      <input
                        type="text"
                        id="billingAddress"
                        placeholder="e.g. 123 Main Street"
                        value={cardForm.billingAddress}
                        onChange={(e) => setCardForm({ ...cardForm, billingAddress: e.target.value })}
                        required
                      />
                    </div>

                    <div className="booking-form-field" style={{ marginTop: '0.85rem' }}>
                      <label htmlFor="billingAddress2">Apartment, Suite, Unit (Optional)</label>
                      <input
                        type="text"
                        id="billingAddress2"
                        placeholder="e.g. Apt 4B"
                        value={cardForm.billingAddress2}
                        onChange={(e) => setCardForm({ ...cardForm, billingAddress2: e.target.value })}
                      />
                    </div>

                    <div className="form-row-three">
                      <div className="booking-form-field">
                        <label htmlFor="billingCity">City <span style={{ color: '#dc2626' }}>*</span></label>
                        <input
                          type="text"
                          id="billingCity"
                          placeholder="City"
                          value={cardForm.billingCity}
                          onChange={(e) => setCardForm({ ...cardForm, billingCity: e.target.value })}
                          required
                        />
                      </div>

                      <div className="booking-form-field">
                        <label htmlFor="billingState">State / Province <span style={{ color: '#dc2626' }}>*</span></label>
                        <input
                          type="text"
                          id="billingState"
                          placeholder="State"
                          value={cardForm.billingState}
                          onChange={(e) => setCardForm({ ...cardForm, billingState: e.target.value })}
                          required
                        />
                      </div>

                      <div className="booking-form-field">
                        <label htmlFor="billingZip">ZIP / Postal Code <span style={{ color: '#dc2626' }}>*</span></label>
                        <input
                          type="text"
                          id="billingZip"
                          placeholder="ZIP"
                          value={cardForm.billingZip}
                          onChange={(e) => setCardForm({ ...cardForm, billingZip: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="booking-form-field" style={{ marginTop: '0.85rem' }}>
                      <label htmlFor="billingCountry">Country <span style={{ color: '#dc2626' }}>*</span></label>
                      <select
                        id="billingCountry"
                        value={cardForm.billingCountry}
                        onChange={(e) => setCardForm({ ...cardForm, billingCountry: e.target.value })}
                        required
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      >
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Australia">Australia</option>
                        <option value="Germany">Germany</option>
                        <option value="France">France</option>
                        <option value="India">India</option>
                        <option value="Other">Other International</option>
                      </select>
                    </div>
                  </div>

                  {/* Terms & Conditions Agreement */}
                  <div className="verification-block" style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
                    <div className="verification-inner">
                      <input
                        type="checkbox"
                        id="agree-check"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                      />
                      <label htmlFor="agree-check" className="verification-label">
                        I agree to the <Link to="/terms" target="_blank">Terms of Service</Link>, <Link to="/privacy-policy" target="_blank">Privacy Policy</Link>, and <Link to="/refund-policy" target="_blank">Refund Policy</Link>. I verify that the passenger credentials entered above match official photo IDs exactly.
                      </label>
                    </div>
                  </div>

                  {/* Error Notice */}
                  {cardError && (
                    <div className="payment-error-banner" role="alert" style={{ margin: '1rem 0', padding: '0.85rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '0.5rem' }}></i>
                      <span>{cardError}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handleDirectCardPayment}
                    className="amtrak-btn amtrak-btn--cta amtrak-btn--full"
                    disabled={cardProcessing || !termsAccepted}
                  >
                    {cardProcessing ? (
                      <span><i className="fas fa-circle-notch fa-spin"></i> Processing 256-Bit Encrypted Card Payment...</span>
                    ) : (
                      <span><i className="fas fa-lock"></i> Complete Secure Booking — ${pricing.total} USD</span>
                    )}
                  </button>
                </div>
              </AccordionSection>

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
