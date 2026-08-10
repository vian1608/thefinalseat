import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { flightAPI } from '../../../shared/api/api';
import { normalizeError } from '../../../shared/utils/normalizeError';
import FlightResultRow, { normalizeFlight } from '../components/FlightResultRow';
import ModifySearchSummaryBar from '../components/ModifySearchSummaryBar';
import ModifySearchModal from '../components/ModifySearchModal';
import './SearchResultsPage.css';

const RETURN_SEARCH_TIMEOUT_MS = 25000;

function airportCode(value, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'object') return String(value.code || value.iata || fallback).toUpperCase();
  const str = String(value).trim();
  const paren = str.match(/\(([A-Z]{3})\)/i);
  if (paren) return paren[1].toUpperCase();
  if (/^[A-Z]{3}$/i.test(str)) return str.toUpperCase();
  return fallback;
}

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
    let timeoutId;
    try {
      const response = await Promise.race([
        flightAPI.search(params),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('The return-flight search is taking longer than expected.')), RETURN_SEARCH_TIMEOUT_MS);
        })
      ]);
      if (timeoutId) clearTimeout(timeoutId);
      setFlights(Array.isArray(response?.data?.flights) ? response.data.flights : []);
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
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

    setSearchParams(params);

    if (!outboundFlight || !params.returnDate) {
      setFlights([]);
      setLoading(false);
      setError('We could not find your selected departure flight or return date. Your browser session may have expired. Go back to flight search and choose the departure flight again.');
      return;
    }

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
  }, [searchReturnFlights]);

  const handleSelectReturnFlight = (flight) => {
    sessionStorage.setItem('returnFlight', JSON.stringify(flight));
    navigate('/booking');
  };

  const handleBackToDepartureFlights = () => {
    const params = searchParams || {};
    const fromCode = params.fromCode || airportCode(params.fromAirport) || airportCode(params.from);
    const toCode = params.toCode || airportCode(params.toAirport) || airportCode(params.to);

    sessionStorage.removeItem('selectedFlight');
    sessionStorage.removeItem('selectedReturnFlight');
    sessionStorage.removeItem('returnFlight');
    sessionStorage.removeItem('bookingDraft');

    if (!fromCode || !toCode || !params.departure) {
      navigate('/');
      return;
    }

    const query = new URLSearchParams({
      from: fromCode,
      to: toCode,
      fromDisplay: typeof params.from === 'string' ? params.from : (params.fromAirport?.name || fromCode),
      toDisplay: typeof params.to === 'string' ? params.to : (params.toAirport?.name || toCode),
      departure: params.departure,
      adults: String(params.adults || 1),
      children: String(params.children || 0),
      infants: String(params.infants || 0),
      travelClass: params.travelClass || params.cabinClass || 'economy',
      currency: params.currency || 'USD',
      tripType: params.tripType || 'roundtrip'
    });

    if (params.returnDate) query.set('returnDate', params.returnDate);
    navigate(`/search?${query.toString()}`);
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

  const retryReturnSearch = () => {
    if (!searchParams?.returnDate) return;
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
  };

  const normalizedFlights = flights.map((flight, index) => normalizeFlight(flight, index)).filter(Boolean);

  if (loading) {
    return (
      <div className="search-results-page">
        <div className="container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <button type="button" className="btn-outline-modify" onClick={handleBackToDepartureFlights} style={{ marginBottom: '16px' }}>
            <i className="fas fa-arrow-left" style={{ marginRight: '8px' }} /> Back to departure flights
          </button>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <button type="button" className="btn-outline-modify" onClick={handleBackToDepartureFlights}>
            <i className="fas fa-arrow-left" style={{ marginRight: '8px' }} /> Back to departure flights
          </button>
          <span style={{ color: '#64748b', fontSize: '.82rem', fontWeight: 600 }}>Change your outbound flight without restarting the trip.</span>
        </div>

        <ModifySearchSummaryBar searchParams={searchParams || {}} onOpenModifyModal={() => setIsModifySearchOpen(true)} />

        <div className="results-toolbar-comparison" style={{ marginBottom: '20px' }}>
          <div className="results-meta-text">
            <h2 style={{ fontSize: '1.4rem', color: '#1e293b', fontWeight: 700, margin: '0 0 4px' }}>Select Return Flight</h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, fontWeight: 500 }}>Choose your return flight from {searchParams?.to?.split?.('(')?.[0]?.trim?.() || 'your destination'} to {searchParams?.from?.split?.('(')?.[0]?.trim?.() || 'your origin'}.</p>
          </div>
        </div>

        {error && (
          <div className="search-error-card" role="alert" style={{ marginBottom: '1.5rem' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fff1f2', color: '#9f1239', display: 'grid', placeItems: 'center', marginBottom: '12px' }}>
              <i className="fas fa-circle-exclamation" />
            </div>
            <h3>Return Flight Search Failed</h3>
            <p>{error}</p>
            <p style={{ color: '#64748b', fontSize: '.86rem' }}>You are not stuck. You can retry, change the search, or go back and select a different departure flight.</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {searchParams?.returnDate && <button type="button" className="btn-primary" onClick={retryReturnSearch}>Retry Search</button>}
              <button type="button" className="btn-outline-modify" onClick={handleBackToDepartureFlights}>Back to departure flights</button>
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
                <p>No return flights matched this route and date. Try modifying your travel criteria or choose a different departure flight.</p>
                <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={handleBackToDepartureFlights} className="btn-outline-modify">Back to departure flights</button>
                  <button type="button" onClick={() => setIsModifySearchOpen(true)} className="btn-outline-modify">Modify Search</button>
                </div>
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
