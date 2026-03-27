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

    searchReturnFlights({
      from: searchParams.to,
      to: searchParams.from,
      departure: searchParams.returnDate,
      passengers: searchParams.passengers,
      travelClass: searchParams.travelClass,
      maxResults: 10
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
    return <div>Loading return flights...</div>;
  }

  return (
    <div className="search-results-page">
      <div className="container">
        <h2>Select Return Flight</h2>
        <div className="flight-results">
          {flights.map((flight, index) => (
            <div key={flight.id || index} className="flight-card">
              <div className="flight-header">
                <div className="airline-info">
                  <h4>{flight.airline}</h4>
                  <span className="flight-number">{flight.flightNumber}</span>
                </div>
                <div className="flight-price">
                  <span className="price">{flight.price?.formatted || '$0.00'}</span>
                </div>
              </div>
              <div className="flight-details">
                <div className="flight-route">
                  <div className="route-item">
                    <span className="time">{flight.departure?.time || 'N/A'}</span>
                    <span className="airport">{flight.departure?.airport || 'N/A'}</span>
                  </div>
                  <div className="route-arrow">
                    <i className="fas fa-arrow-right"></i>
                    <span className="duration">{flight.duration || 'N/A'}</span>
                  </div>
                  <div className="route-item">
                    <span className="time">{flight.arrival?.time || 'N/A'}</span>
                    <span className="airport">{flight.arrival?.airport || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="flight-actions">
                <button 
                  className="book-btn"
                  onClick={() => handleSelectReturnFlight(flight)}
                >
                  Select This Flight
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ReturnFlightSelection;
