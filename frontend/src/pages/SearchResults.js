import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { flightAPI } from '../services/api';
import './SearchResults.css';

function SearchResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useState(null);
  const [searchType, setSearchType] = useState('oneway');

  useEffect(() => {
    const params = location.state?.searchParams || JSON.parse(sessionStorage.getItem('searchParams') || '{}');
    const type = location.state?.searchType || sessionStorage.getItem('searchType') || 'oneway';
    
    setSearchParams(params);
    setSearchType(type);

    if (params.from && params.to && params.departure) {
      searchFlights(params);
    } else {
      setError('Missing search parameters');
      setLoading(false);
    }
  }, [location]);

  const searchFlights = async (params) => {
    try {
      setLoading(true);
      setError(null);
      const response = await flightAPI.search(params);
      setFlights(response.data?.flights || []);
    } catch (err) {
      console.error('Error searching flights:', err);
      setError(err.response?.data?.error || 'Failed to search flights');
    } finally {
      setLoading(false);
    }
  };

  const handleBookFlight = (flight) => {
    sessionStorage.setItem('selectedFlight', JSON.stringify(flight));
    sessionStorage.setItem('searchType', searchType);
    navigate('/booking');
  };

  if (loading) {
    return (
      <div className="search-results-page">
        <div className="container">
          <div className="loading-spinner">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Searching for flights...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="search-results-page">
        <div className="container">
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i>
            <p>{error}</p>
            <button onClick={() => navigate('/')} className="btn-primary">Go Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results-page">
      <div className="container">
        <div className="results-header">
          <h2>Flight Search Results</h2>
          <p>{flights.length} flights found</p>
        </div>

        <div className="flight-results">
          {flights.length === 0 ? (
            <div className="no-results">
              <i className="fas fa-search"></i>
              <p>No flights found. Please try different search criteria.</p>
              <button onClick={() => navigate('/')} className="btn-primary">New Search</button>
            </div>
          ) : (
            flights.map((flight, index) => (
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
                    <span><i className="fas fa-chair"></i> {flight.class || 'ECONOMY'}</span>
                    <span><i className="fas fa-plane"></i> {flight.stops === 0 ? 'Direct' : `${flight.stops} stop(s)`}</span>
                  </div>
                </div>
                <div className="flight-actions">
                  <button 
                    className="book-btn"
                    onClick={() => handleBookFlight(flight)}
                  >
                    Book Now
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

export default SearchResults;
