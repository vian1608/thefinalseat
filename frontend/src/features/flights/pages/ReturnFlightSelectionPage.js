import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { flightAPI } from '../../../shared/api/api';
import { normalizeError } from '../../../shared/utils/normalizeError';
import FlightResultRow, { normalizeFlight } from '../components/FlightResultRow';
import ModifySearchSummaryBar from '../components/ModifySearchSummaryBar';
import ModifySearchModal from '../components/ModifySearchModal';
import './SearchResultsPage.css';

function ReturnFlightSelection() {
  const navigate = useNavigate();
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useState(null);
  const [isModifySearchOpen, setIsModifySearchOpen] = useState(false);
  const [expandedFlightId, setExpandedFlightId] = useState(null);

  const searchReturnFlights = useCallback(async (params) => {
    setLoading(true);
    setError('');
    try {
      const response = await flightAPI.search(params);
      setFlights(Array.isArray(response?.data?.flights) ? response.data.flights : []);
    } catch (err) {
      setFlights([]);
      setError(normalizeError(err, 'Unable to load return flights right now. Please retry or modify your search.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let outboundFlight;
    let params;
    try {
      outboundFlight = JSON.parse(sessionStorage.getItem('selectedFlight') || 'null');
      params = JSON.parse(sessionStorage.getItem('searchParams') || '{}');
    } catch {
      outboundFlight = null;
      params = {};
    }

    if (!outboundFlight || !params.returnDate) {
      navigate('/');
      return;
    }

    setSearchParams(params);
    searchReturnFlights({
      from: params.to,
      to: params.from,
      departure: params.returnDate,
      adults: params.adults || 1,
      children: params.children || 0,
      infants: params.infants || 0,
      travelClass: params.travelClass || 'economy',
      currency: params.currency || 'USD'
    });
  }, [navigate, searchReturnFlights]);

  const handleSelectReturnFlight = (flight) => {
    sessionStorage.setItem('returnFlight', JSON.stringify(flight));
    navigate('/booking');
  };

  const handleUpdateSearchFromReturn = (updatedParams) => {
    setIsModifySearchOpen(false);
    sessionStorage.removeItem('selectedFlight');
    sessionStorage.removeItem('selectedReturnFlight');
    sessionStorage.removeItem('returnFlight');
    sessionStorage.removeItem('bookingDraft');

    const params = new URLSearchParams({
      from: updatedParams.from,
      to: updatedParams.to,
      departure: updatedParams.departure,
      return: updatedParams.return || '',
      returnDate: updatedParams.return || '',
      tripType: updatedParams.tripType,
      adults: String(updatedParams.adults),
      children: String(updatedParams.children),
      infants: String(updatedParams.infants),
      cabin: updatedParams.cabinClass,
      travelClass: updatedParams.cabinClass,
    });
    navigate(`/search?${params.toString()}`);
  };

  const normalizedFlights = flights.map((flight, index) => normalizeFlight(flight, index)).filter(Boolean);

  if (loading) {
    return (
      <div className="search-results-page">
        <div className="container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div className="results-toolbar-comparison" style={{ marginBottom: '20px' }}><div className="skeleton-line-title pulsing" /></div>
          <div className="flight-results-rows-container">
            {[1, 2, 3].map((item) => <div key={item} className="flight-card skeleton-card"><div className="flight-header skeleton-flex"><div className="skeleton-circle pulsing" /><div className="skeleton-lines"><div className="skeleton-line-heading pulsing" /><div className="skeleton-line-sub pulsing" /></div><div className="skeleton-price-block pulsing" /></div><div className="flight-details skeleton"><div className="skeleton-route-bar pulsing" /></div></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results-page">
      <div className="container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <ModifySearchSummaryBar searchParams={searchParams || {}} onOpenModifyModal={() => setIsModifySearchOpen(true)} />

        <div className="results-toolbar-comparison" style={{ marginBottom: '20px' }}>
          <div className="results-meta-text">
            <h2 style={{ fontSize: '1.4rem', color: '#1e293b', fontWeight: 700, margin: '0 0 4px' }}>Select Return Flight</h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, fontWeight: 500 }}>Choose your return flight from {searchParams?.to?.split('(')[0]?.trim()} to {searchParams?.from?.split('(')[0]?.trim()}.</p>
          </div>
        </div>

        {error && (
          <div className="search-error-card" role="alert" style={{ marginBottom: '1.5rem' }}>
            <h3>Return Flight Search Failed</h3>
            <p>{error}</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-primary" onClick={() => searchParams && searchReturnFlights({ from: searchParams.to, to: searchParams.from, departure: searchParams.returnDate, adults: searchParams.adults || 1, children: searchParams.children || 0, infants: searchParams.infants || 0, travelClass: searchParams.travelClass || 'economy', currency: searchParams.currency || 'USD' })}>Retry Search</button>
              <button type="button" className="btn-outline-modify" onClick={() => setIsModifySearchOpen(true)}>Modify Search</button>
            </div>
          </div>
        )}

        {!error && (
          <div className="flight-results-rows-container">
            {normalizedFlights.length === 0 ? (
              <div className="no-results-card">
                <div className="no-results-icon-circle"><i className="fas fa-plane-departure" /></div>
                <h3>No return flights found</h3>
                <p>No return flights matched this route and date. Try modifying your travel criteria.</p>
                <button type="button" onClick={() => setIsModifySearchOpen(true)} className="btn-outline-modify">Modify Search</button>
              </div>
            ) : normalizedFlights.map((flight) => (
              <FlightResultRow
                key={flight.id}
                flight={flight}
                isExpanded={expandedFlightId === flight.id}
                onToggleExpand={() => setExpandedFlightId((current) => current === flight.id ? null : flight.id)}
                onSelect={handleSelectReturnFlight}
                actionLabel="Select Return Flight"
                travelersCount={parseInt(searchParams?.adults || 1, 10)}
              />
            ))}
          </div>
        )}
      </div>

      <ModifySearchModal
        isOpen={isModifySearchOpen}
        onClose={() => setIsModifySearchOpen(false)}
        initialSearch={searchParams || {}}
        onUpdateSearch={handleUpdateSearchFromReturn}
        isCheckoutPage={false}
      />
    </div>
  );
}

export default ReturnFlightSelection;
