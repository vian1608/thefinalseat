import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import HeroSlider from '../components/HeroSlider';
import AirportAutocomplete from '../components/AirportAutocomplete';
import InquiryLocationSelect from '../components/InquiryLocationSelect';
import { flightAirportSelectGroups } from '../data/flightAirports';
import CustomerReviews from '../components/CustomerReviews';
import { inquiryAPI } from '../services/api';
import { flightReviews } from '../data/customerReviews';
import { flightHeroSlides, heroOfferTag } from '../data/heroSlides';
import RouteSlider from '../components/RouteSlider';
import SeamlessAdvisorySection from '../components/SeamlessAdvisorySection';
import { flightFamousRoutes } from '../data/famousRoutes';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../constants/supportContact';
import './Home.css';

const initialFormData = {
  name: '',
  email: '',
  phone: '',
  origin: '',
  destination: '',
  tripType: 'roundtrip',
  travelDate: '',
  returnDate: '',
  passengers: '1',
  cabinClass: 'economy',
  notes: '',
};

const initialSearchData = {
  from: '',
  to: '',
  departure: '',
  returnDate: '',
  adults: 1,
  children: 0,
  infants: 0,
  travelClass: 'economy',
  currency: 'USD',
  tripType: 'roundtrip'
};

function Home() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormData);
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const [activeTab, setActiveTab] = useState('search'); // 'search' (interactive) or 'inquiry' (original)
  const [searchData, setSearchData] = useState(initialSearchData);
  const [showPassengerPopup, setShowPassengerPopup] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearchChange = (field, value) => {
    setSearchData((prev) => ({ ...prev, [field]: value }));
  };

  const incrementPassenger = (type) => {
    setSearchData((prev) => {
      const val = prev[type] || 0;
      if (val >= 9) return prev;
      return { ...prev, [type]: val + 1 };
    });
  };

  const decrementPassenger = (type) => {
    setSearchData((prev) => {
      const val = prev[type] || 0;
      const min = type === 'adults' ? 1 : 0;
      if (val <= min) return prev;
      return { ...prev, [type]: val - 1 };
    });
  };

  const handleSearchFlights = (e) => {
    e.preventDefault();
    if (!searchData.from || !searchData.to || !searchData.departure) {
      setSubmitStatus('error');
      setSubmitMessage('Please specify Departure, Arrival, and Date fields.');
      return;
    }

    if (searchData.tripType === 'roundtrip' && !searchData.returnDate) {
      setSubmitStatus('error');
      setSubmitMessage('Please specify a Return Date for round-trip flights.');
      return;
    }

    if (searchData.tripType === 'roundtrip' && new Date(searchData.returnDate) < new Date(searchData.departure)) {
      setSubmitStatus('error');
      setSubmitMessage('Return date must be on or after the departure date.');
      return;
    }

    setSubmitStatus('idle');
    setSubmitMessage('');

    // Save criteria in sessionStorage
    sessionStorage.setItem('searchParams', JSON.stringify(searchData));
    sessionStorage.setItem('searchType', searchData.tripType);
    
    // Clear any previous select values
    sessionStorage.removeItem('selectedFlight');
    sessionStorage.removeItem('returnFlight');

    navigate('/search');
  };

  const handleSearchSchedules = (e) => {
    e.preventDefault();
    if (!formData.origin || !formData.destination || !formData.travelDate) {
      setSubmitStatus('error');
      setSubmitMessage('Please fill in Origin, Destination, and Departure Date to search flight schedules.');
      return;
    }

    const searchParams = {
      from: formData.origin,
      to: formData.destination,
      departure: formData.travelDate,
      returnDate: formData.tripType === 'roundtrip' ? formData.returnDate : undefined,
      passengers: formData.passengers || '1',
      travelClass: formData.cabinClass?.toUpperCase() || 'ECONOMY',
    };

    sessionStorage.setItem('searchParams', JSON.stringify(searchParams));
    sessionStorage.setItem('searchType', formData.tripType);
    
    navigate('/search', { state: { searchParams, searchType: formData.tripType } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus('submitting');
    setSubmitMessage('');

    try {
      const result = await inquiryAPI.submitConsulting({
        serviceType: 'flights',
        ...formData,
      });
      setSubmitStatus('success');
      setSubmitMessage(
        result.message ||
          'Thank you. Your inquiry was submitted and our team will contact you shortly.'
      );
      setFormData(initialFormData);

      // Fire Google Ads conversion event
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'conversion', {
            'send_to': 'AW-18166581434/W9aXCMPzpq8cELqRwNZD',
            'transaction_id': ''
        });
      }
    } catch (error) {
      setSubmitStatus('error');
      if (error.response?.data?.error) {
        setSubmitMessage(error.response.data.error);
      } else if (error.code === 'ERR_NETWORK' || !error.response) {
        const isLocal =
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        setSubmitMessage(
          isLocal
            ? 'Unable to reach the server. Start the backend on port 5001 (cd backend && npm run dev), restart the frontend, then try again.'
            : 'Unable to reach our servers. Hard-refresh the page (Cmd+Shift+R) and try again, or email support@thefinalseat.com.'
        );
      } else {
        setSubmitMessage(
          'Unable to submit right now. Please call us or email support@thefinalseat.com.'
        );
      }
    }
  };

  return (
    <div className="flights-page">
      <Helmet>
      </Helmet>
      <HeroSlider
        slides={flightHeroSlides}
        variant="flights"
        serviceNavActive="flights"
        inquiryHref="#inquiry"
        offerTag={heroOfferTag}
      />

<section id="inquiry" className="flights-section">
        <div className="container">
          <div className="inquiry-split-layout">
            <div className="inquiry-left-panel">
              <h2 style={{ fontSize: '1.8rem', color: '#1e293b', marginBottom: '1rem' }}>Need Immediate Support?</h2>
              <p>Skip the form and call us directly to secure your air logistics immediately.</p>
              
              <a href={SUPPORT_PHONE_HREF} className="call-btn flights-btn flights-btn--cta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', padding: '1.25rem', fontSize: '1.2rem', backgroundColor: '#8b1538', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                <i className="fas fa-phone"></i> Call {SUPPORT_PHONE_DISPLAY}
              </a>
              
              <div className="benefits-list">
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#1e293b' }}>Benefits for booking with us:</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'start' }}>
                    <i className="fas fa-check-circle" style={{ color: '#8b1538', marginTop: '0.25rem' }}></i>
                    <span>Includes free 24/7 support till date of travel.</span>
                  </li>
                  <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                    <i className="fas fa-check-circle" style={{ color: '#8b1538', marginTop: '0.25rem' }}></i>
                    <span>No need to wait on long holds like with the airline.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="inquiry-right-panel">
              <div className="flights-inquiry-card" style={{ margin: 0 }}>
                
                {/* Search tabs header */}
                <div className="search-tabs-header">
                  <button 
                    type="button" 
                    className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
                    onClick={() => setActiveTab('search')}
                  >
                    <i className="fas fa-search"></i> Book Flights
                  </button>
                  <button 
                    type="button" 
                    className={`tab-btn ${activeTab === 'inquiry' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inquiry')}
                  >
                    <i className="fas fa-paper-plane"></i> Custom Inquiry
                  </button>
                </div>

                {activeTab === 'search' ? (
                  <>
                    <h2 style={{ marginBottom: '0.5rem', color: '#1e293b', fontSize: '1.75rem' }}>Search Flights</h2>
                    <p className="flights-inquiry__intro">
                      Discover flight deals with SerpAPI real-time Google Flights search engine.
                    </p>
                    
                    <form className="flights-form" onSubmit={handleSearchFlights}>
                      
                      {/* Meta selections row (Trip type, Cabin class, Passenger popup, Currency) */}
                      <div className="search-meta-row">
                        <div className="search-meta-group">
                          <i className="fas fa-route" style={{ color: '#64748b' }}></i>
                          <select 
                            value={searchData.tripType} 
                            onChange={(e) => handleSearchChange('tripType', e.target.value)}
                            className="search-meta-select"
                          >
                            <option value="roundtrip">Round Trip</option>
                            <option value="oneway">One Way</option>
                          </select>
                        </div>
                        
                        <div className="search-meta-group">
                          <i className="fas fa-chair" style={{ color: '#64748b' }}></i>
                          <select 
                            value={searchData.travelClass} 
                            onChange={(e) => handleSearchChange('travelClass', e.target.value)}
                            className="search-meta-select"
                          >
                            <option value="economy">Economy</option>
                            <option value="premium">Premium Economy</option>
                            <option value="business">Business</option>
                            <option value="first">First Class</option>
                          </select>
                        </div>

                        <div className="search-meta-group">
                          <i className="fas fa-dollar-sign" style={{ color: '#64748b' }}></i>
                          <select 
                            value={searchData.currency} 
                            onChange={(e) => handleSearchChange('currency', e.target.value)}
                            className="search-meta-select"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="CAD">CAD (C$)</option>
                          </select>
                        </div>

                        <div className="search-meta-group" style={{ position: 'relative' }}>
                          <button 
                            type="button" 
                            className="passenger-trigger-btn"
                            onClick={() => setShowPassengerPopup(!showPassengerPopup)}
                          >
                            <i className="fas fa-user-friends" style={{ color: '#64748b' }}></i>
                            <span>{searchData.adults + searchData.children + searchData.infants} Traveler(s)</span>
                            <i className={`fas fa-chevron-${showPassengerPopup ? 'up' : 'down'}`} style={{ fontSize: '0.7rem' }}></i>
                          </button>

                          {showPassengerPopup && (
                            <div className="passenger-popover">
                              <div className="passenger-row">
                                <div className="passenger-label">
                                  <span className="passenger-type">Adults</span>
                                  <span className="passenger-age-desc">Age 18+</span>
                                </div>
                                <div className="passenger-counters">
                                  <button type="button" className="counter-btn" onClick={() => decrementPassenger('adults')} disabled={searchData.adults <= 1}>-</button>
                                  <span className="counter-value">{searchData.adults}</span>
                                  <button type="button" className="counter-btn" onClick={() => incrementPassenger('adults')}>+</button>
                                </div>
                              </div>
                              <div className="passenger-row">
                                <div className="passenger-label">
                                  <span className="passenger-type">Children</span>
                                  <span className="passenger-age-desc">Age 2-17</span>
                                </div>
                                <div className="passenger-counters">
                                  <button type="button" className="counter-btn" onClick={() => decrementPassenger('children')} disabled={searchData.children <= 0}>-</button>
                                  <span className="counter-value">{searchData.children}</span>
                                  <button type="button" className="counter-btn" onClick={() => incrementPassenger('children')}>+</button>
                                </div>
                              </div>
                              <div className="passenger-row">
                                <div className="passenger-label">
                                  <span className="passenger-type">Infants</span>
                                  <span className="passenger-age-desc">Under 2 (lap)</span>
                                </div>
                                <div className="passenger-counters">
                                  <button type="button" className="counter-btn" onClick={() => decrementPassenger('infants')} disabled={searchData.infants <= 0}>-</button>
                                  <span className="counter-value">{searchData.infants}</span>
                                  <button type="button" className="counter-btn" onClick={() => incrementPassenger('infants')}>+</button>
                                </div>
                              </div>
                              <button type="button" className="passenger-popup-close" onClick={() => setShowPassengerPopup(false)}>Done</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Airport Autocomplete Row */}
                      <div className="flights-form__row" style={{ gap: '1.25rem' }}>
                        <div className="flights-form__group" style={{ margin: 0 }}>
                          <AirportAutocomplete 
                            label="Origin Airport"
                            id="search-origin"
                            value={searchData.from}
                            onChange={(val) => handleSearchChange('from', val)}
                            placeholder="e.g. New York (JFK)"
                            required
                          />
                        </div>
                        <div className="flights-form__group" style={{ margin: 0 }}>
                          <AirportAutocomplete 
                            label="Destination Airport"
                            id="search-destination"
                            value={searchData.to}
                            onChange={(val) => handleSearchChange('to', val)}
                            placeholder="e.g. Los Angeles (LAX)"
                            required
                          />
                        </div>
                      </div>

                      {/* Dates Row */}
                      <div className="flights-form__row" style={{ gap: '1.25rem', marginTop: '1.25rem' }}>
                        <div className="flights-form__group" style={{ margin: 0 }}>
                          <label htmlFor="search-departure-date">Departure Date</label>
                          <input 
                            type="date" 
                            id="search-departure-date"
                            value={searchData.departure}
                            onChange={(e) => handleSearchChange('departure', e.target.value)}
                            required
                            style={{ width: '100%', height: '48px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem' }}
                          />
                        </div>
                        <div className="flights-form__group" style={{ margin: 0, opacity: searchData.tripType === 'oneway' ? 0.5 : 1 }}>
                          <label htmlFor="search-return-date">Return Date</label>
                          <input 
                            type="date" 
                            id="search-return-date"
                            value={searchData.returnDate}
                            onChange={(e) => handleSearchChange('returnDate', e.target.value)}
                            disabled={searchData.tripType === 'oneway'}
                            required={searchData.tripType === 'roundtrip'}
                            style={{ width: '100%', height: '48px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem' }}
                          />
                        </div>
                      </div>

                      {/* Submit action */}
                      <div style={{ marginTop: '1.5rem' }}>
                        <button 
                          type="submit" 
                          className="flights-btn flights-btn--cta" 
                          style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }}
                        >
                          <i className="fas fa-search"></i> Search Flights
                        </button>
                      </div>

                      {submitMessage && submitStatus === 'error' && (
                        <p className="inquiry-form__message inquiry-form__message--error" role="alert" style={{ marginTop: '1rem' }}>
                          {submitMessage}
                        </p>
                      )}

                    </form>
                  </>
                ) : (
                  <>
                    <h2 style={{ marginBottom: '0.5rem', color: '#1e293b', fontSize: '1.75rem' }}>Consulting Inquiry</h2>
                    <p className="flights-inquiry__intro">
                      Submit your air logistics details. A consultant will respond with advisory options and a quote outline.
                    </p>
                    <form className="flights-form" onSubmit={handleSubmit}>
                      <div className="flights-form__row">
                        <div className="flights-form__group">
                          <label htmlFor="flight-name">Full name</label>
                          <input
                            id="flight-name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            required
                            autoComplete="name"
                          />
                        </div>
                        <div className="flights-form__group">
                          <label htmlFor="flight-email">Email</label>
                          <input
                            id="flight-email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            required
                            autoComplete="email"
                          />
                        </div>
                      </div>
                      <div className="flights-form__row">
                        <div className="flights-form__group">
                          <label htmlFor="flight-phone">Phone (optional)</label>
                          <input
                            id="flight-phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            autoComplete="tel"
                          />
                        </div>
                        <div className="flights-form__group">
                          <label htmlFor="flight-passengers">Passengers</label>
                          <select
                            id="flight-passengers"
                            value={formData.passengers}
                            onChange={(e) => handleChange('passengers', e.target.value)}
                          >
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5+">5+</option>
                          </select>
                        </div>
                      </div>
                      <div className="flights-form__row">
                        <div className="flights-form__group">
                          <InquiryLocationSelect
                            id="flight-origin"
                            label="Origin airport"
                            value={formData.origin}
                            onChange={(value) => handleChange('origin', value)}
                            groups={flightAirportSelectGroups}
                            placeholder="Select origin airport"
                            required
                          />
                        </div>
                        <div className="flights-form__group">
                          <InquiryLocationSelect
                            id="flight-destination"
                            label="Destination airport"
                            value={formData.destination}
                            onChange={(value) => handleChange('destination', value)}
                            groups={flightAirportSelectGroups}
                            placeholder="Select destination airport"
                            required
                          />
                        </div>
                      </div>
                      <div className="flights-form__row">
                        <div className="flights-form__group">
                          <label htmlFor="flight-trip-type">Trip type</label>
                          <select
                            id="flight-trip-type"
                            value={formData.tripType}
                            onChange={(e) => handleChange('tripType', e.target.value)}
                          >
                            <option value="oneway">One way</option>
                            <option value="roundtrip">Round trip</option>
                          </select>
                        </div>
                        <div className="flights-form__group">
                          <label htmlFor="flight-cabin">Preferred cabin</label>
                          <select
                            id="flight-cabin"
                            value={formData.cabinClass}
                            onChange={(e) => handleChange('cabinClass', e.target.value)}
                          >
                            <option value="economy">Economy</option>
                            <option value="premium">Premium economy</option>
                            <option value="business">Business</option>
                            <option value="first">First</option>
                          </select>
                        </div>
                      </div>
                      <div className="flights-form__row">
                        <div className="flights-form__group">
                          <label htmlFor="flight-date">Departure date</label>
                          <input
                            id="flight-date"
                            type="date"
                            value={formData.travelDate}
                            onChange={(e) => handleChange('travelDate', e.target.value)}
                          />
                        </div>
                        {formData.tripType === 'roundtrip' && (
                          <div className="flights-form__group">
                            <label htmlFor="flight-return">Return date</label>
                            <input
                              id="flight-return"
                              type="date"
                              value={formData.returnDate}
                              onChange={(e) => handleChange('returnDate', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flights-form__group">
                        <label htmlFor="flight-notes">Advisory notes (urgency, visa, accessibility, etc.)</label>
                        <textarea
                          id="flight-notes"
                          rows={4}
                          value={formData.notes}
                          onChange={(e) => handleChange('notes', e.target.value)}
                          placeholder="Describe your logistics needs and timeline."
                        />
                      </div>

                      {/* SMS OPT-IN COMPLIANCE DISCLOSURE BLOCK */}
                      <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1rem', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <input 
                            type="checkbox" 
                            id="smsOptIn" 
                            name="smsOptIn" 
                            required 
                            style={{ marginTop: '0.25rem', cursor: 'pointer' }}
                          />
                          <label htmlFor="smsOptIn" style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.625', cursor: 'pointer' }}>
                            By checking this box and submitting this request, I provide my express written consent to receive automated flight updates, travel quotes, and booking notifications via SMS from The Final Seat LLC at the number provided. <strong>Consent is not a condition of purchase. Message frequency varies based on booking activity (up to 4 messages per month).</strong> Message and data rates may apply. Text STOP to cancel at any time, or HELP for assistance. View our <Link to="/privacy-policy" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Privacy Policy</Link> and <Link to="/terms" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Terms of Service</Link>.
                          </label>
                        </div>
                      </div>
                      <div className="flights-form__actions-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button
                            type="submit"
                            className="flights-btn flights-btn--cta"
                            style={{ flex: 1 }}
                            disabled={submitStatus === 'submitting'}
                          >
                            {submitStatus === 'submitting' ? 'Submitting…' : 'Request Callback'}
                          </button>
                          <button
                            type="button"
                            onClick={handleSearchSchedules}
                            className="flights-btn"
                            style={{ flex: 1, backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            Search Flights
                          </button>
                        </div>
                      </div>
                      {submitMessage && (
                        <p
                          className={`inquiry-form__message ${
                            submitStatus === 'success'
                              ? 'inquiry-form__message--success'
                              : 'inquiry-form__message--error'
                          }`}
                          role="alert"
                          style={{ marginTop: '1rem' }}
                        >
                          {submitMessage}
                        </p>
                      )}
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flights-section">
        <div className="container route-slider-section">
          <RouteSlider routes={flightFamousRoutes} btnClassPrefix="flights" />
        </div>
      </section>

      <SeamlessAdvisorySection variant="flight" />



            <CustomerReviews reviews={flightReviews} variant="flights" />
    </div>
  );
}

export default Home;
