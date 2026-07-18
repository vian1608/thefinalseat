import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { paymentAPI } from '../services/api';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../constants/supportContact';
import './Booking.css';

function Booking() {
  const navigate = useNavigate();
  const [flight, setFlight] = useState(null);
  const [returnFlight, setReturnFlight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMessage, setCouponMessage] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');

  // Primary Contact State
  const [primaryContact, setPrimaryContact] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: 'United States'
  });

  // Billing Address State
  const [billingAddress, setBillingAddress] = useState({
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States'
  });

  // Special Requests State
  const [specialRequests, setSpecialRequests] = useState({
    wheelchair: false,
    mealPreference: 'none',
    notes: ''
  });

  // Passengers List State
  const [passengersList, setPassengersList] = useState([]);

  useEffect(() => {
    // 1. Retrieve Outbound Flight
    const flightData = JSON.parse(sessionStorage.getItem('selectedFlight') || 'null');
    if (!flightData) {
      navigate('/');
      return;
    }
    setFlight(flightData);

    // 2. Retrieve Inbound Flight (if Round Trip)
    const returnFlightData = JSON.parse(sessionStorage.getItem('returnFlight') || 'null');
    setReturnFlight(returnFlightData);

    // 3. Initialize Passenger forms based on home page counts
    const searchParams = JSON.parse(sessionStorage.getItem('searchParams') || '{}');
    const adults = parseInt(searchParams.adults || 1, 10);
    const children = parseInt(searchParams.children || 0, 10);
    const infants = parseInt(searchParams.infants || 0, 10);

    const initialList = [];
    
    // Add Adults
    for (let i = 0; i < adults; i++) {
      initialList.push({
        role: 'adult',
        firstName: '',
        middleName: '',
        lastName: '',
        gender: '',
        dateOfBirth: '',
        nationality: '',
        passportNumber: '',
        passportExpiry: '',
        knownTravelerNumber: '',
        redressNumber: ''
      });
    }
    
    // Add Children
    for (let i = 0; i < children; i++) {
      initialList.push({
        role: 'child',
        firstName: '',
        middleName: '',
        lastName: '',
        gender: '',
        dateOfBirth: '',
        nationality: '',
        passportNumber: '',
        passportExpiry: '',
        knownTravelerNumber: '',
        redressNumber: ''
      });
    }

    // Add Infants
    for (let i = 0; i < infants; i++) {
      initialList.push({
        role: 'infant',
        firstName: '',
        middleName: '',
        lastName: '',
        gender: '',
        dateOfBirth: '',
        nationality: '',
        passportNumber: '',
        passportExpiry: '',
        knownTravelerNumber: '',
        redressNumber: ''
      });
    }

    setPassengersList(initialList);
  }, [navigate]);

  const handlePrimaryContactChange = (field, value) => {
    setPrimaryContact(prev => ({ ...prev, [field]: value }));
  };

  const handleBillingChange = (field, value) => {
    setBillingAddress(prev => ({ ...prev, [field]: value }));
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

  const handleApplyCoupon = () => {
    if (couponCode.trim().toLowerCase() === 'welcome') {
      setCouponApplied(true);
      setAppliedCoupon('WELCOME');
      setCouponMessage('Promo applied successfully! Enjoy 99% off.');
    } else {
      setCouponMessage('Invalid promo code.');
      setCouponApplied(false);
    }
  };

  const calculateTotal = () => {
    const outboundPrice = parseFloat(flight?.price?.total || 0);
    const returnPrice = returnFlight ? parseFloat(returnFlight.price?.total || 0) : 0;
    
    const subtotal = outboundPrice + returnPrice;
    
    // Tax & Fees: 5%
    const tax = subtotal * 0.05;
    let total = subtotal + tax;

    if (couponApplied && appliedCoupon === 'WELCOME') {
      total = total * 0.01; // 99% off
    }

    const originalPriceOut = parseFloat(flight?.price?.originalApiPrice || 0);
    const originalPriceRet = returnFlight ? parseFloat(returnFlight.price?.originalApiPrice || 0) : 0;
    const originalTotal = originalPriceOut + originalPriceRet;

    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      originalPrice: originalTotal.toFixed(2)
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const pricing = calculateTotal();
      
      // Save current fields in sessionStorage to rebuild on success
      sessionStorage.setItem('pendingPassenger', JSON.stringify({
        primaryContact,
        billingAddress,
        specialRequests,
        passengers: passengersList
      }));

      // Call secure Stripe Checkout Session creation API
      const response = await paymentAPI.createStripeSession({
        type: 'booking',
        email: primaryContact.email,
        amount: parseFloat(pricing.total),
        flight: flight,
        returnFlight: returnFlight,
        passenger: {
          firstName: primaryContact.firstName,
          lastName: primaryContact.lastName,
          email: primaryContact.email,
          phone: primaryContact.phone,
          // Legacy keys compat for metadata mapping
          dateOfBirth: passengersList[0]?.dateOfBirth || '',
          gender: passengersList[0]?.gender || '',
          nationality: passengersList[0]?.nationality || '',
          passportNumber: passengersList[0]?.passportNumber || '',
          passportExpiry: passengersList[0]?.passportExpiry || '',
          emergencyName: primaryContact.firstName + ' ' + primaryContact.lastName,
          emergencyPhone: primaryContact.phone,
          emergencyRelationship: 'Primary Contact'
        }
      });

      if (response.success && response.url) {
        window.location.href = response.url;
      } else {
        throw new Error('Stripe redirect URL not returned by server.');
      }
    } catch (err) {
      console.error('Checkout creation error:', err);
      setError(
        err.response?.data?.error || 
        'Unable to process checkout. Please verify passenger details and try again.'
      );
      setLoading(false);
    }
  };

  if (!flight) {
    return (
      <div className="booking-loading-container">
        <i className="fas fa-circle-notch fa-spin"></i>
        <p>Loading flight summaries...</p>
      </div>
    );
  }

  const pricing = calculateTotal();
  const isTrain = flight.isTrain;

  return (
    <div className="booking-page-container">
      <Helmet>
        <title>Flight Checkout & Booking | The Final Seat</title>
      </Helmet>

      <div className="booking-inner-container">
        
        <header className="booking-page-header">
          <h1>Secure Ticket Checkout</h1>
          <p>Provide passenger details and complete your reservation via Stripe PCI-compliant secure gateway.</p>
        </header>

        {error && (
          <div className="booking-error-alert" role="alert">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        <div className="booking-checkout-layout">
          
          {/* Main Booking Form */}
          <div className="booking-main-content">
            <form onSubmit={handleSubmit} className="booking-form-element">
              
              {/* PRIMARY CONTACT SECTION */}
              <section className="booking-form-section">
                <div className="section-title-wrapper">
                  <span className="step-badge">1</span>
                  <h2>Primary Contact</h2>
                </div>

                <div className="booking-form-grid">
                  <label className="booking-form-field">
                    First Name
                    <input 
                      type="text" 
                      value={primaryContact.firstName}
                      onChange={(e) => handlePrimaryContactChange('firstName', e.target.value)}
                      required
                      placeholder="e.g. John"
                    />
                  </label>
                  <label className="booking-form-field">
                    Last Name
                    <input 
                      type="text" 
                      value={primaryContact.lastName}
                      onChange={(e) => handlePrimaryContactChange('lastName', e.target.value)}
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
                      value={primaryContact.email}
                      onChange={(e) => handlePrimaryContactChange('email', e.target.value)}
                      required
                      placeholder="e.g. john.doe@example.com"
                    />
                  </label>
                  <label className="booking-form-field">
                    Phone Number
                    <input 
                      type="tel" 
                      value={primaryContact.phone}
                      onChange={(e) => handlePrimaryContactChange('phone', e.target.value)}
                      required
                      placeholder="e.g. +1 555-019-9234"
                    />
                  </label>
                </div>
              </section>

              {/* DYNAMIC PASSENGER(S) DETAILS SECTION */}
              <section className="booking-form-section">
                <div className="section-title-wrapper">
                  <span className="step-badge">2</span>
                  <h2>Traveler Details</h2>
                </div>

                {passengersList.map((passenger, index) => (
                  <div key={index} className="passenger-entry-block" style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem', backgroundColor: '#f8fafc' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#1e3a5f', fontSize: '1.05rem', textTransform: 'capitalize' }}>
                      Passenger #{index + 1} ({passenger.role})
                    </h3>

                    <div className="booking-form-grid">
                      <label className="booking-form-field">
                        First Name
                        <input 
                          type="text" 
                          value={passenger.firstName}
                          onChange={(e) => handlePassengerChange(index, 'firstName', e.target.value)}
                          required
                          placeholder="First Name (as on ID)"
                        />
                      </label>
                      <label className="booking-form-field">
                        Middle Name (optional)
                        <input 
                          type="text" 
                          value={passenger.middleName}
                          onChange={(e) => handlePassengerChange(index, 'middleName', e.target.value)}
                          placeholder="Middle Name"
                        />
                      </label>
                      <label className="booking-form-field">
                        Last Name
                        <input 
                          type="text" 
                          value={passenger.lastName}
                          onChange={(e) => handlePassengerChange(index, 'lastName', e.target.value)}
                          required
                          placeholder="Last Name (as on ID)"
                        />
                      </label>
                    </div>

                    <div className="booking-form-grid" style={{ marginTop: '0.75rem' }}>
                      <label className="booking-form-field">
                        Gender
                        <select 
                          value={passenger.gender}
                          onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)}
                          required
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label className="booking-form-field">
                        Date of Birth
                        <input 
                          type="date" 
                          value={passenger.dateOfBirth}
                          onChange={(e) => handlePassengerChange(index, 'dateOfBirth', e.target.value)}
                          required
                        />
                      </label>
                      <label className="booking-form-field">
                        Nationality
                        <input 
                          type="text" 
                          value={passenger.nationality}
                          onChange={(e) => handlePassengerChange(index, 'nationality', e.target.value)}
                          required
                          placeholder="e.g. United States"
                        />
                      </label>
                    </div>

                    {!isTrain && (
                      <>
                        <div className="booking-form-grid" style={{ marginTop: '0.75rem' }}>
                          <label className="booking-form-field">
                            Passport Number (optional)
                            <input 
                              type="text" 
                              value={passenger.passportNumber}
                              onChange={(e) => handlePassengerChange(index, 'passportNumber', e.target.value)}
                              placeholder="Passport Number"
                            />
                          </label>
                          <label className="booking-form-field">
                            Passport Expiry (optional)
                            <input 
                              type="date" 
                              value={passenger.passportExpiry}
                              onChange={(e) => handlePassengerChange(index, 'passportExpiry', e.target.value)}
                            />
                          </label>
                        </div>
                        <div className="booking-form-grid" style={{ marginTop: '0.75rem' }}>
                          <label className="booking-form-field">
                            Known Traveler Number (optional)
                            <input 
                              type="text" 
                              value={passenger.knownTravelerNumber}
                              onChange={(e) => handlePassengerChange(index, 'knownTravelerNumber', e.target.value)}
                              placeholder="KTN"
                            />
                          </label>
                          <label className="booking-form-field">
                            Redress Number (optional)
                            <input 
                              type="text" 
                              value={passenger.redressNumber}
                              onChange={(e) => handlePassengerChange(index, 'redressNumber', e.target.value)}
                              placeholder="Redress Number"
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </section>

              {/* BILLING ADDRESS SECTION */}
              <section className="booking-form-section">
                <div className="section-title-wrapper">
                  <span className="step-badge">3</span>
                  <h2>Billing Address</h2>
                </div>

                <div className="booking-form-grid">
                  <label className="booking-form-field" style={{ gridColumn: 'span 2' }}>
                    Street Address
                    <input 
                      type="text" 
                      value={billingAddress.street}
                      onChange={(e) => handleBillingChange('street', e.target.value)}
                      required
                      placeholder="Street and house number"
                    />
                  </label>
                </div>

                <div className="booking-form-grid" style={{ marginTop: '0.75rem' }}>
                  <label className="booking-form-field">
                    City
                    <input 
                      type="text" 
                      value={billingAddress.city}
                      onChange={(e) => handleBillingChange('city', e.target.value)}
                      required
                      placeholder="City"
                    />
                  </label>
                  <label className="booking-form-field">
                    State / Province
                    <input 
                      type="text" 
                      value={billingAddress.state}
                      onChange={(e) => handleBillingChange('state', e.target.value)}
                      required
                      placeholder="State"
                    />
                  </label>
                  <label className="booking-form-field">
                    ZIP / Postal Code
                    <input 
                      type="text" 
                      value={billingAddress.zip}
                      onChange={(e) => handleBillingChange('zip', e.target.value)}
                      required
                      placeholder="ZIP Code"
                    />
                  </label>
                </div>
              </section>

              {/* SPECIAL REQUESTS SECTION */}
              <section className="booking-form-section">
                <div className="section-title-wrapper">
                  <span className="step-badge">4</span>
                  <h2>Special Requests & Notes</h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    id="wheelchair"
                    checked={specialRequests.wheelchair}
                    onChange={(e) => handleSpecialRequestsChange('wheelchair', e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="wheelchair" style={{ fontSize: '0.9rem', color: '#475569', cursor: 'pointer', fontWeight: '600' }}>
                    Request wheelchair assistance at airports
                  </label>
                </div>

                <div className="booking-form-grid">
                  <label className="booking-form-field">
                    Meal Preference
                    <select 
                      value={specialRequests.mealPreference}
                      onChange={(e) => handleSpecialRequestsChange('mealPreference', e.target.value)}
                    >
                      <option value="none">No Preference</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="kosher">Kosher</option>
                      <option value="halal">Halal</option>
                      <option value="gluten-free">Gluten-Free</option>
                    </select>
                  </label>
                </div>

                <div className="booking-form-group">
                  <label htmlFor="special-notes" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.375rem' }}>
                    Additional Requests
                  </label>
                  <textarea 
                    id="special-notes"
                    rows={3}
                    value={specialRequests.notes}
                    onChange={(e) => handleSpecialRequestsChange('notes', e.target.value)}
                    placeholder="Enter any other travel requests or airline loyalty membership numbers."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: '0.95rem' }}
                  />
                </div>
              </section>

              {/* VERIFICATION CHECKBOX */}
              <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <input type="checkbox" id="agree-check" required style={{ marginTop: '0.25rem', width: '16px', height: '16px' }} />
                  <label htmlFor="agree-check" style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.6' }}>
                    I agree to the <Link to="/terms" target="_blank" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Terms of Service</Link>, <Link to="/privacy-policy" target="_blank" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Privacy Policy</Link>, and <Link to="/refund-policy" target="_blank" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Refund Policy</Link>. I verify that the passenger credentials inputted above match the official photo IDs exactly.
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="booking-submit-button"
                style={{ backgroundColor: isTrain ? '#8b1538' : '#1e3a5f', padding: '1.25rem', fontSize: '1.15rem' }}
                disabled={loading}
              >
                {loading ? (
                  <span><i className="fas fa-circle-notch fa-spin"></i> Redirecting to Secure Stripe Checkout...</span>
                ) : (
                  <span>Secure Pay — ${pricing.total} USD</span>
                )}
              </button>

            </form>
          </div>

          {/* SIDEBAR SUMMARY CARD */}
          <aside className="booking-summary-sidebar">
            <div className="summary-sticky-card" style={{ borderTop: isTrain ? '4px solid #8b1538' : '4px solid #1e3a5f' }}>
              <h3>Itinerary Summary</h3>

              {/* OUTBOUND SUMMARY */}
              <div className="itinerary-quick-details" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
                <span className="direction-badge" style={{ backgroundColor: '#1e3a5f', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Outbound</span>
                <div className="summary-airline-row" style={{ marginTop: '0.5rem' }}>
                  <strong>{flight.airline}</strong>
                  <span className="flight-num-badge">{flight.flightNumber}</span>
                </div>
                
                <div className="summary-route-timeline" style={{ margin: '1rem 0' }}>
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
                  <span><i className={`fas ${flight.isTrain ? 'fa-subway' : 'fa-plane'}`}></i> {flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop(s)`}</span>
                </div>
              </div>

              {/* INBOUND SUMMARY (IF ROUND TRIP) */}
              {returnFlight && (
                <div className="itinerary-quick-details" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
                  <span className="direction-badge" style={{ backgroundColor: '#8b1538', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>Return</span>
                  <div className="summary-airline-row" style={{ marginTop: '0.5rem' }}>
                    <strong>{returnFlight.airline}</strong>
                    <span className="flight-num-badge" style={{ backgroundColor: '#8b1538' }}>{returnFlight.flightNumber}</span>
                  </div>
                  
                  <div className="summary-route-timeline" style={{ margin: '1rem 0' }}>
                    <div className="timeline-point">
                      <span className="timeline-time">{returnFlight.departure?.time}</span>
                      <span className="timeline-airport">{returnFlight.departure?.airport}</span>
                      <span className="timeline-date">{returnFlight.departure?.date}</span>
                    </div>
                    <div className="timeline-arrow">
                      <i className="fas fa-long-arrow-alt-down"></i>
                      <span className="timeline-duration">{returnFlight.duration}</span>
                    </div>
                    <div className="timeline-point">
                      <span className="timeline-time">{returnFlight.arrival?.time}</span>
                      <span className="timeline-airport">{returnFlight.arrival?.airport}</span>
                      <span className="timeline-date">{returnFlight.arrival?.date}</span>
                    </div>
                  </div>

                  <div className="summary-flight-meta">
                    <span><i className="fas fa-chair"></i> {returnFlight.class || 'Economy'}</span>
                    <span><i className={`fas ${returnFlight.isTrain ? 'fa-subway' : 'fa-plane'}`}></i> {returnFlight.stops === 0 ? 'Nonstop' : `${returnFlight.stops} stop(s)`}</span>
                  </div>
                </div>
              )}

              {/* Promo code area */}
              <div className="promo-code-box" style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                <span className="filter-group-title" style={{ fontSize: '0.85rem' }}>Promo Code</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input 
                    type="text" 
                    placeholder="Enter Promo Code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    disabled={couponApplied}
                    style={{ flex: 1, height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1', textTransform: 'uppercase' }}
                  />
                  <button 
                    type="button" 
                    onClick={handleApplyCoupon}
                    disabled={couponApplied}
                    style={{ height: '36px', padding: '0 12px', border: 'none', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Apply
                  </button>
                </div>
                {couponMessage && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: couponApplied ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                    {couponMessage}
                  </p>
                )}
              </div>

              {/* Price details */}
              <div className="price-breakdown-section">
                <h4>Pricing Breakdown</h4>
                <div className="price-row">
                  <span>Base Tickets</span>
                  <span>${pricing.subtotal}</span>
                </div>
                <div className="price-row">
                  <span>Taxes & Partner Fees</span>
                  <span>${pricing.tax}</span>
                </div>
                {couponApplied && (
                  <div className="price-row" style={{ color: '#10b981', fontWeight: '700' }}>
                    <span>Promo Applied (WELCOME)</span>
                    <span>-99%</span>
                  </div>
                )}
                <div className="price-row total-row" style={{ borderTop: '2px solid #e2e8f0', paddingTop: '10px', marginTop: '10px' }}>
                  <strong>Total Web Price</strong>
                  <strong style={{ fontSize: '1.3rem', color: '#1e3a5f' }}>${pricing.total} USD</strong>
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
