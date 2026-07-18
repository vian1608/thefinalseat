import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { flightAPI } from '../services/api';
import './SearchResults.css';

function ReturnFlightSelection() {
  const navigate = useNavigate();
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const outboundFlight = JSON.parse(sessionStorage.getItem('selectedFlight') || 'null');
    const searchParams = JSON.parse(sessionStorage.getItem('searchParams') || '{}');
    
    if (!outboundFlight || !searchParams.returnDate) {
      navigate('/');
      return;
    }

    // Set search return parameter: reverse route
    searchReturnFlights({
      from: searchParams.to,
      to: searchParams.from,
      departure: searchParams.returnDate,
      adults: searchParams.adults || 1,
      children: searchParams.children || 0,
      infants: searchParams.infants || 0,
      travelClass: searchParams.travelClass || 'economy',
      currency: searchParams.currency || 'USD'
    });
  }, [navigate]);

  const searchReturnFlights = async (params) => {
    try {
      setLoading(true);
      const response = await flightAPI.search(params);
      setFlights(response.data?.flights || []);
    } catch (err) {
      console.error('Error searching return flights:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReturnFlight = (flight) => {
    sessionStorage.setItem('returnFlight', JSON.stringify(flight));
    navigate('/booking');
  };

  if (loading) {
    return (
      <div className="search-results-page">
        <div className="container">
          <div className="loading-spinner">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Searching for return flight options...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results-page">
      <div className="container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <div className="results-toolbar" style={{ marginBottom: '20px' }}>
          <div className="results-meta-text">
            <h2>Select Return Flight</h2>
            <p>Choose your returning flight schedule to complete your round-trip booking</p>
          </div>
        </div>

        <div className="flight-results">
          {flights.length === 0 ? (
            <div className="no-results">
              <i className="fas fa-plane-departure"></i>
              <p>No return flights found matching dates and destinations.</p>
              <button onClick={() => navigate('/')} className="btn-primary">Back to Home</button>
            </div>
          ) : (
            flights.map((flight, index) => (
              <div key={flight.id || index} className="flight-card">
                <div className="flight-header">
                  <div className="airline-info">
                    <div className="carrier-logo-wrapper">
                      <img 
                        src={flight.airline_logo || 'https://www.gstatic.com/flights/airline_logos/70px/airline.png'} 
                        alt={flight.airline} 
                        className="carrier-logo"
                        onError={(e) => { e.target.src = 'https://www.gstatic.com/flights/airline_logos/70px/airline.png'; }}
                      />
                    </div>
                    <div>
                      <h4>{flight.airline}</h4>
                      <span className="flight-number">{flight.flightNumber}</span>
                    </div>
                  </div>
                  <div className="flight-price">
                    <span className="price">{flight.price?.formatted || '$0.00'}</span>
                    <small className="website-price-notice">Web Fare Only</small>
                  </div>
                </div>
                <div className="flight-details">
                  <div className="flight-route">
                    <div className="route-item">
                      <span className="time">{flight.departure?.time || 'N/A'}</span>
                      <span className="airport">{flight.departure?.airport || 'N/A'}</span>
                      <span className="date">{flight.departure?.date || 'N/A'}</span>
                    </div>
                    <div className="route-arrow">
                      <i className="fas fa-arrow-right"></i>
                      <span className="duration">{flight.duration || 'N/A'}</span>
                    </div>
                    <div className="route-item">
                      <span className="time">{flight.arrival?.time || 'N/A'}</span>
                      <span className="airport">{flight.arrival?.airport || 'N/A'}</span>
                      <span className="date">{flight.arrival?.date || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flight-info">
                    <span><i className="fas fa-chair"></i> {flight.class || 'Economy'}</span>
                    <span><i className="fas fa-plane"></i> {flight.stops === 0 ? 'Direct / Nonstop' : `${flight.stops} stop(s)`}</span>
                    {flight.aircraft && <span><i className="fas fa-info-circle"></i> {flight.aircraft}</span>}
                  </div>

                  {/* Layovers */}
                  {flight.layovers && flight.layovers.length > 0 && (
                    <div className="flight-layovers-bar">
                      <span>Layover:</span>
                      {flight.layovers.map((l, lIdx) => (
                        <span key={lIdx} className="layover-tag">
                          {l.airportCode} ({Math.floor(l.duration / 60)}h {l.duration % 60}m)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flight-actions">
                  <button 
                    className="book-btn"
                    onClick={() => handleSelectReturnFlight(flight)}
                  >
                    Select Return Flight <i className="fas fa-chevron-right" style={{ fontSize: '0.8rem', marginLeft: '6px' }}></i>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ReturnFlightSelection;
