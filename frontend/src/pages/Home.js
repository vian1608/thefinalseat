import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { airportAPI } from '../services/api';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState('roundtrip');
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    departure: '',
    return: '',
    passengers: 1,
    class: 'economy'
  });
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  const fromTimeoutRef = useRef(null);
  const toTimeoutRef = useRef(null);

  useEffect(() => {
    // Set default dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(tomorrow);
    nextWeek.setDate(nextWeek.getDate() + 7);

    setFormData(prev => ({
      ...prev,
      departure: tomorrow.toISOString().split('T')[0],
      return: nextWeek.toISOString().split('T')[0]
    }));
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFromInput = async (value) => {
    handleInputChange('from', value);
    if (value.length >= 2) {
      clearTimeout(fromTimeoutRef.current);
      fromTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await airportAPI.search(value);
          setFromSuggestions(response.data || []);
          setShowFromSuggestions(true);
        } catch (error) {
          console.error('Error fetching airport suggestions:', error);
        }
      }, 300);
    } else {
      setShowFromSuggestions(false);
    }
  };

  const handleToInput = async (value) => {
    handleInputChange('to', value);
    if (value.length >= 2) {
      clearTimeout(toTimeoutRef.current);
      toTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await airportAPI.search(value);
          setToSuggestions(response.data || []);
          setShowToSuggestions(true);
        } catch (error) {
          console.error('Error fetching airport suggestions:', error);
        }
      }, 300);
    } else {
      setShowToSuggestions(false);
    }
  };

  const selectAirport = (airport, type) => {
    const displayValue = `${airport.name} (${airport.code})`;
    if (type === 'from') {
      handleInputChange('from', displayValue);
      setShowFromSuggestions(false);
    } else {
      handleInputChange('to', displayValue);
      setShowToSuggestions(false);
    }
  };

  const swapAirports = () => {
    setFormData(prev => ({
      ...prev,
      from: prev.to,
      to: prev.from
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const searchParams = {
      from: formData.from,
      to: formData.to,
      departure: formData.departure,
      passengers: formData.passengers,
      travelClass: formData.class.toUpperCase(),
      maxResults: 10
    };

    if (searchType === 'roundtrip' && formData.return) {
      searchParams.returnDate = formData.return;
    }

    // Store search params in sessionStorage
    sessionStorage.setItem('searchParams', JSON.stringify(searchParams));
    sessionStorage.setItem('searchType', searchType);

    // Navigate to search results
    navigate('/search', { state: { searchParams, searchType } });
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h2 className="hero-title">Experience Premium Travel</h2>
            <p className="hero-subtitle">Discover the world with The Final Seat - Where speed meets comfort</p>
            
            <div className="promo-banner">
              <div className="promo-content">
                <div className="promo-icon">
                  <i className="fas fa-percentage"></i>
                </div>
                <div className="promo-text">
                  <h3>Get Up To 30% Off</h3>
                  <p>On flights booked within 7 days</p>
                </div>
                <div className="promo-badge">
                  <span>Limited Time</span>
                </div>
              </div>
            </div>
            
            <div className="urgent-badges">
              <span className="badge urgent">24/7 Support</span>
              <span className="badge urgent">Same Day Flights</span>
              <span className="badge urgent">Emergency Booking</span>
            </div>
          </div>
        </div>
      </section>

      {/* Flight Search Form */}
      <section id="search" className="search-section">
        <div className="container">
          <div className="search-card">
            <div className="search-tabs">
              <button 
                className={`tab-btn ${searchType === 'roundtrip' ? 'active' : ''}`}
                onClick={() => setSearchType('roundtrip')}
              >
                <i className="fas fa-exchange-alt"></i>
                Round Trip
              </button>
              <button 
                className={`tab-btn ${searchType === 'oneway' ? 'active' : ''}`}
                onClick={() => setSearchType('oneway')}
              >
                <i className="fas fa-arrow-right"></i>
                One Way
              </button>
            </div>

            <form className="search-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="from">From</label>
                  <div className="input-wrapper">
                    <i className="fas fa-plane-departure"></i>
                    <input
                      type="text"
                      id="from"
                      ref={fromInputRef}
                      value={formData.from}
                      onChange={(e) => handleFromInput(e.target.value)}
                      onFocus={() => formData.from.length >= 2 && setShowFromSuggestions(true)}
                      placeholder="City or Airport"
                      required
                    />
                    <button type="button" className="swap-btn" onClick={swapAirports}>
                      <i className="fas fa-exchange-alt"></i>
                    </button>
                    {showFromSuggestions && fromSuggestions.length > 0 && (
                      <div className="suggestions-dropdown">
                        {fromSuggestions.map((airport, idx) => (
                          <div
                            key={idx}
                            className="suggestion-item"
                            onClick={() => selectAirport(airport, 'from')}
                          >
                            <i className="fas fa-plane"></i>
                            <div>
                              <strong>{airport.name}</strong>
                              <span>{airport.code} - {airport.city}, {airport.country}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="to">To</label>
                  <div className="input-wrapper">
                    <i className="fas fa-plane-arrival"></i>
                    <input
                      type="text"
                      id="to"
                      ref={toInputRef}
                      value={formData.to}
                      onChange={(e) => handleToInput(e.target.value)}
                      onFocus={() => formData.to.length >= 2 && setShowToSuggestions(true)}
                      placeholder="City or Airport"
                      required
                    />
                    {showToSuggestions && toSuggestions.length > 0 && (
                      <div className="suggestions-dropdown">
                        {toSuggestions.map((airport, idx) => (
                          <div
                            key={idx}
                            className="suggestion-item"
                            onClick={() => selectAirport(airport, 'to')}
                          >
                            <i className="fas fa-plane"></i>
                            <div>
                              <strong>{airport.name}</strong>
                              <span>{airport.code} - {airport.city}, {airport.country}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="departure">Departure</label>
                  <div className="input-wrapper">
                    <i className="fas fa-calendar-alt"></i>
                    <input
                      type="date"
                      id="departure"
                      value={formData.departure}
                      onChange={(e) => handleInputChange('departure', e.target.value)}
                      required
                    />
                  </div>
                </div>

                {searchType === 'roundtrip' && (
                  <div className="form-group">
                    <label htmlFor="return">Return</label>
                    <div className="input-wrapper">
                      <i className="fas fa-calendar-alt"></i>
                      <input
                        type="date"
                        id="return"
                        value={formData.return}
                        onChange={(e) => handleInputChange('return', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="passengers">Passengers</label>
                  <div className="input-wrapper">
                    <i className="fas fa-users"></i>
                    <select
                      id="passengers"
                      value={formData.passengers}
                      onChange={(e) => handleInputChange('passengers', parseInt(e.target.value))}
                    >
                      <option value="1">1 Passenger</option>
                      <option value="2">2 Passengers</option>
                      <option value="3">3 Passengers</option>
                      <option value="4">4 Passengers</option>
                      <option value="5">5+ Passengers</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="class">Class</label>
                  <div className="input-wrapper">
                    <i className="fas fa-chair"></i>
                    <select
                      id="class"
                      value={formData.class}
                      onChange={(e) => handleInputChange('class', e.target.value)}
                    >
                      <option value="economy">Economy</option>
                      <option value="premium">Premium Economy</option>
                      <option value="business">Business</option>
                      <option value="first">First Class</option>
                    </select>
                  </div>
                </div>
              </div>

              <button type="submit" className="search-btn">
                <i className="fas fa-search"></i>
                Search Flights
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Emergency Section */}
      <section id="emergency" className="emergency-section">
        <div className="container">
          <h2 className="section-title">Emergency Travel Services</h2>
          <div className="emergency-grid">
            <div className="emergency-card">
              <div className="card-icon">
                <i className="fas fa-phone-alt"></i>
              </div>
              <h3>24/7 Emergency Hotline</h3>
              <p>Call our emergency hotline for immediate assistance with urgent travel needs.</p>
              <a href="tel:+1-800-URGENT" className="emergency-btn">Call Now</a>
            </div>
            <div className="emergency-card">
              <div className="card-icon">
                <i className="fas fa-user-md"></i>
              </div>
              <h3>Medical Emergency</h3>
              <p>Specialized services for medical emergencies requiring immediate travel.</p>
              <button type="button" className="emergency-btn">Get Help</button>
            </div>
            <div className="emergency-card">
              <div className="card-icon">
                <i className="fas fa-heart"></i>
              </div>
              <h3>Family Emergency</h3>
              <p>Compassionate support for family emergencies and bereavement travel.</p>
              <button type="button" className="emergency-btn">Contact Us</button>
            </div>
            <div className="emergency-card">
              <div className="card-icon">
                <i className="fas fa-briefcase"></i>
              </div>
              <h3>Business Emergency</h3>
              <p>Rapid deployment for critical business meetings and urgent corporate travel.</p>
              <button type="button" className="emergency-btn">Book Now</button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Why Choose The Final Seat?</h2>
          <div className="features-grid">
            <div className="feature-item">
              <i className="fas fa-clock"></i>
              <h3>24/7 Availability</h3>
              <p>Book flights anytime, anywhere with our round-the-clock service.</p>
            </div>
            <div className="feature-item">
              <i className="fas fa-bolt"></i>
              <h3>Lightning Fast</h3>
              <p>Find and book flights in minutes, not hours.</p>
            </div>
            <div className="feature-item">
              <i className="fas fa-dollar-sign"></i>
              <h3>Best Prices</h3>
              <p>Competitive pricing with exclusive discounts for urgent bookings.</p>
            </div>
            <div className="feature-item">
              <i className="fas fa-shield-alt"></i>
              <h3>Secure Booking</h3>
              <p>Your data and payments are protected with industry-leading security.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
