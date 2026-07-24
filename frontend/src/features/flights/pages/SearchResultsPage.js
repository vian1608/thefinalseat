import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { flightAPI } from '../../../shared/api/api';
import './SearchResultsPage.css';
import FlightResultRow, { normalizeFlight } from '../components/FlightResultRow';

// Helper to safely format error into string
function getErrorMessage(err) {
  if (!err) return 'An unexpected error occurred while searching for flights.';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    if (err.message && typeof err.message === 'string') return err.message;
    if (err.error) return getErrorMessage(err.error);
    if (err.code) return `Error (${err.code}): Unable to process search.`;
    try {
      return JSON.stringify(err);
    } catch (e) {
      return 'Unable to process search.';
    }
  }
  return String(err);
}

// Helper to safely get airport code from string or object
function getAirportCode(val) {
  if (!val) return '';
  if (typeof val === 'object') return (val.code || val.id || '').toUpperCase();
  const str = String(val).trim();
  const match = str.match(/\(([A-Z]{3,4})\)/i);
  if (match) return match[1].toUpperCase();
  if (/^[A-Z]{3}$/i.test(str)) return str.toUpperCase();
  return str.toUpperCase().substring(0, 3);
}

// Helper to safely get display city/name from string or object
function getAirportName(val) {
  if (!val) return '';
  if (typeof val === 'object') return val.city || val.name || val.code || '';
  const str = String(val).trim();
  const cityPart = str.split('(')[0].trim();
  return cityPart || str;
}

// Helper to safely format dates for display without throwing Invalid Date errors
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  try {
    const cleanDate = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
    const d = new Date(cleanDate);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return String(dateStr || '');
  }
}

// Helper to convert duration string (e.g. "3h 15m") to minutes
function durationToMinutes(durationStr) {
  if (!durationStr) return 0;
  const hoursMatch = String(durationStr).match(/(\d+)\s*h/i);
  const minutesMatch = String(durationStr).match(/(\d+)\s*m/i);
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
  return (hours * 60) + minutes;
}

// Helper to get time period (morning, afternoon, evening) from time string
function getTimePeriod(timeStr) {
  if (!timeStr || timeStr === 'N/A') return 'other';
  const hour = parseInt(String(timeStr).split(':')[0], 10);
  if (isNaN(hour)) return 'other';
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

function SearchResultsContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchType, setSearchType] = useState('oneway');
  const [searchParams, setSearchParams] = useState(null);

  // Filter States
  const [maxPrice, setMaxPrice] = useState(3000);
  const [sliderPrice, setSliderPrice] = useState(3000);
  const [selectedStops, setSelectedStops] = useState({ nonstop: true, oneStop: true, twoPlusStops: true });
  const [selectedAirlines, setSelectedAirlines] = useState([]);
  const [depTimeFilter, setDepTimeFilter] = useState('all');
  const [arrTimeFilter, setArrTimeFilter] = useState('all');
  const [maxDuration, setMaxDuration] = useState(1440); // in minutes
  const [sliderDuration, setSliderDuration] = useState(1440);
  const [sortBy, setSortBy] = useState('best');

  // Accordion Expand State
  const [expandedFlightId, setExpandedFlightId] = useState(null);

  // Top Filter Popover State
  const [activeFilterPopover, setActiveFilterPopover] = useState(null);

  // Mobile Filter Drawer State
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  const popoverRef = useRef(null);

  // Close popover on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setActiveFilterPopover(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const executeSearch = (params, type) => {
    if (!params || !params.from || !params.to || !params.departure) {
      setError('Missing or invalid flight search parameters.');
      setLoading(false);
      return;
    }
    if (type === 'rail') {
      searchTrains(params);
    } else {
      searchFlights(params);
    }
  };

  useEffect(() => {
    // 1. Read URL Query Parameters first (allows page refresh & shareable URL)
    const urlQuery = new URLSearchParams(location.search);
    const urlFrom = urlQuery.get('from');
    const urlTo = urlQuery.get('to');
    const urlDeparture = urlQuery.get('departure');

    let params = null;
    let type = 'oneway';

    if (urlFrom && urlTo && urlDeparture) {
      type = urlQuery.get('tripType') || 'oneway';
      params = {
        from: urlQuery.get('fromDisplay') || urlFrom,
        to: urlQuery.get('toDisplay') || urlTo,
        fromCode: getAirportCode(urlFrom),
        toCode: getAirportCode(urlTo),
        departure: urlDeparture,
        returnDate: urlQuery.get('returnDate') || undefined,
        adults: parseInt(urlQuery.get('adults') || '1', 10),
        children: parseInt(urlQuery.get('children') || '0', 10),
        infants: parseInt(urlQuery.get('infants') || '0', 10),
        travelClass: urlQuery.get('travelClass') || 'economy',
        currency: urlQuery.get('currency') || 'USD',
        tripType: type
      };
    } else if (location.state?.searchParams) {
      params = location.state.searchParams;
      type = location.state.searchType || 'oneway';
    } else {
      try {
        const stored = sessionStorage.getItem('searchParams');
        if (stored) params = JSON.parse(stored);
        type = sessionStorage.getItem('searchType') || 'oneway';
      } catch (e) {
        params = null;
      }
    }

    setSearchType(type);
    setSearchParams(params);
    executeSearch(params, type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const searchTrains = (params) => {
    setLoading(true);
    setError(null);
    try {
      const fromStation = params.from || 'New York';
      const toStation = params.to || 'Washington';
      const departureDate = params.departure || new Date().toISOString().split('T')[0];
      const passengers = parseInt(params.passengers || 1, 10);

      const mockTrains = [
        {
          id: `mock-train-acela-1`,
          isTrain: true,
          airline: 'Amtrak Acela Express',
          flightNumber: 'ACELA #2151',
          price: {
            total: (120 * passengers).toFixed(2),
            originalApiPrice: (133.33 * passengers).toFixed(2),
            currency: 'USD',
            formatted: `$${(120 * passengers).toFixed(2)}`
          },
          departure: {
            airport: fromStation.match(/\(([A-Z]{3,4})\)/)?.[1] || fromStation.substring(0, 3).toUpperCase(),
            city: fromStation.split('(')[0].trim(),
            time: '08:00',
            date: departureDate
          },
          arrival: {
            airport: toStation.match(/\(([A-Z]{3,4})\)/)?.[1] || toStation.substring(0, 3).toUpperCase(),
            city: toStation.split('(')[0].trim(),
            time: '10:55',
            date: departureDate
          },
          duration: '2h 55m',
          stops: 0,
          class: 'Business Class',
          aircraft: 'High-Speed Acela Trainset',
          refundableStatus: 'Refundable (Fees Apply)',
          baggageAllowance: '2 carry-on bags included'
        },
        {
          id: `mock-train-regional-2`,
          isTrain: true,
          airline: 'Amtrak Northeast Regional',
          flightNumber: 'REGIONAL #143',
          price: {
            total: (65 * passengers).toFixed(2),
            originalApiPrice: (72.22 * passengers).toFixed(2),
            currency: 'USD',
            formatted: `$${(65 * passengers).toFixed(2)}`
          },
          departure: {
            airport: fromStation.match(/\(([A-Z]{3,4})\)/)?.[1] || fromStation.substring(0, 3).toUpperCase(),
            city: fromStation.split('(')[0].trim(),
            time: '09:30',
            date: departureDate
          },
          arrival: {
            airport: toStation.match(/\(([A-Z]{3,4})\)/)?.[1] || toStation.substring(0, 3).toUpperCase(),
            city: toStation.split('(')[0].trim(),
            time: '13:05',
            date: departureDate
          },
          duration: '3h 35m',
          stops: 1,
          layovers: [{ airportCode: 'PHL', airportName: 'Philadelphia 30th St', duration: 10 }],
          class: 'Coach Class',
          aircraft: 'Northeast Regional Trainset',
          refundableStatus: 'Non-Refundable',
          baggageAllowance: '2 carry-on bags included'
        },
        {
          id: `mock-train-acela-3`,
          isTrain: true,
          airline: 'Amtrak Acela Express',
          flightNumber: 'ACELA #2163',
          price: {
            total: (190 * passengers).toFixed(2),
            originalApiPrice: (211.11 * passengers).toFixed(2),
            currency: 'USD',
            formatted: `$${(190 * passengers).toFixed(2)}`
          },
          departure: {
            airport: fromStation.match(/\(([A-Z]{3,4})\)/)?.[1] || fromStation.substring(0, 3).toUpperCase(),
            city: fromStation.split('(')[0].trim(),
            time: '14:00',
            date: departureDate
          },
          arrival: {
            airport: toStation.match(/\(([A-Z]{3,4})\)/)?.[1] || toStation.substring(0, 3).toUpperCase(),
            city: toStation.split('(')[0].trim(),
            time: '16:55',
            date: departureDate
          },
          duration: '2h 55m',
          stops: 0,
          class: 'First Class (Roomette)',
          aircraft: 'High-Speed Acela Trainset',
          refundableStatus: 'Refundable (No Fees)',
          baggageAllowance: '3 bags included'
        }
      ];

      setFlights(mockTrains);
      initFilterLimits(mockTrains);
    } catch (err) {
      console.error('Error simulating train search:', err);
      setError('Failed to load train schedules.');
    } finally {
      setLoading(false);
    }
  };

  const searchFlights = async (params) => {
    try {
      setLoading(true);
      setError(null);
      const response = await flightAPI.search(params);
      const list = response?.data?.flights || (Array.isArray(response?.data) ? response.data : []);
      const flightList = Array.isArray(list) ? list : [];
      setFlights(flightList);
      initFilterLimits(flightList);
    } catch (err) {
      console.error('Error searching flights:', err);
      const errorMsg = getErrorMessage(err.response?.data?.error || err.response?.data?.message || err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const initFilterLimits = (list) => {
    if (!Array.isArray(list) || list.length === 0) return;
    const prices = list.map(f => parseFloat(f?.price?.total || 0)).filter(p => !isNaN(p) && p > 0);
    if (prices.length > 0) {
      const maxP = Math.max(...prices);
      setMaxPrice(Math.ceil(maxP));
      setSliderPrice(Math.ceil(maxP));
    }

    const durations = list.map(f => durationToMinutes(f?.duration)).filter(d => d > 0);
    if (durations.length > 0) {
      const maxD = Math.max(...durations);
      setMaxDuration(maxD || 1440);
      setSliderDuration(maxD || 1440);
    }

    const validAirlines = [...new Set(list.map(f => f?.airline).filter(Boolean))];
    setSelectedAirlines(validAirlines);
  };

  const handleBookFlight = (flight) => {
    sessionStorage.setItem('selectedFlight', JSON.stringify(flight));
    sessionStorage.setItem('searchType', searchType);
    
    if (searchType === 'roundtrip') {
      navigate('/return-flight');
    } else {
      navigate('/booking');
    }
  };

  const toggleAirline = (airline) => {
    setSelectedAirlines(prev => 
      prev.includes(airline) ? prev.filter(a => a !== airline) : [...prev, airline]
    );
  };

  const toggleStop = (stopType) => {
    setSelectedStops(prev => ({ ...prev, [stopType]: !prev[stopType] }));
  };

  // 1. FILTERING
  const flightArray = Array.isArray(flights) ? flights : [];
  const filteredFlights = flightArray
    .map((f, idx) => normalizeFlight(f, idx))
    .filter(Boolean)
    .filter(flight => {
      if (flight.price?.total > sliderPrice) return false;

      // Stops check
      const stops = flight.stops;
      if (stops === 0 && !selectedStops.nonstop) return false;
      if (stops === 1 && !selectedStops.oneStop) return false;
      if (stops >= 2 && !selectedStops.twoPlusStops) return false;

      // Airline check
      if (selectedAirlines.length > 0 && !selectedAirlines.includes(flight.airline)) return false;

      // Time ranges check
      const depPeriod = getTimePeriod(flight.departure?.time);
      if (depTimeFilter !== 'all' && depPeriod !== depTimeFilter) return false;

      const arrPeriod = getTimePeriod(flight.arrival?.time);
      if (arrTimeFilter !== 'all' && arrPeriod !== arrTimeFilter) return false;

      // Duration check
      const durationMin = durationToMinutes(flight.duration);
      if (durationMin > sliderDuration) return false;

      return true;
    });

  // 2. SORTING
  const sortedFlights = [...filteredFlights].sort((a, b) => {
    if (sortBy === 'cheapest') {
      return (a.price?.total || 0) - (b.price?.total || 0);
    }
    if (sortBy === 'fastest') {
      return durationToMinutes(a.duration) - durationToMinutes(b.duration);
    }
    if (sortBy === 'earliest') {
      return (a.departure?.time || '').localeCompare(b.departure?.time || '');
    }
    if (sortBy === 'latest') {
      return (b.departure?.time || '').localeCompare(a.departure?.time || '');
    }
    if (sortBy === 'best') {
      const scoreA = (a.price?.total || 0) + (durationToMinutes(a.duration) * 1.25) + ((a.stops || 0) * 150);
      const scoreB = (b.price?.total || 0) + (durationToMinutes(b.duration) * 1.25) + ((b.stops || 0) * 150);
      return scoreA - scoreB;
    }
    return 0;
  });

  const isRail = searchType === 'rail';
  const uniqueAirlines = [...new Set(flightArray.map(f => f?.airline).filter(Boolean))];

  // Active filters calculation
  let activeFiltersCount = 0;
  if (sliderPrice < maxPrice) activeFiltersCount++;
  if (!selectedStops.nonstop || !selectedStops.oneStop || !selectedStops.twoPlusStops) activeFiltersCount++;
  if (depTimeFilter !== 'all') activeFiltersCount++;
  if (arrTimeFilter !== 'all') activeFiltersCount++;
  if (sliderDuration < maxDuration) activeFiltersCount++;
  if (selectedAirlines.length < uniqueAirlines.length) activeFiltersCount++;

  const handleClearAllFilters = () => {
    setSliderPrice(maxPrice);
    setSelectedStops({ nonstop: true, oneStop: true, twoPlusStops: true });
    setDepTimeFilter('all');
    setArrTimeFilter('all');
    setSliderDuration(maxDuration);
    setSelectedAirlines(uniqueAirlines);
  };

  const toggleExpandFlight = (flightId) => {
    setExpandedFlightId(prev => (prev === flightId ? null : flightId));
  };

  // Rendering Loading Skeletons
  if (loading) {
    return (
      <div className="search-results-page">
        <div className="container search-layout-container">
          <aside className="filters-sidebar skeleton-loader">
            <div className="skeleton-title pulsing"></div>
            <div className="skeleton-group pulsing"></div>
            <div className="skeleton-group pulsing"></div>
            <div className="skeleton-group pulsing"></div>
          </aside>

          <div className="results-main-panel">
            <div className="results-toolbar skeleton-loader pulsing-fast">
              <div className="skeleton-line-title"></div>
              <div className="skeleton-line-sort"></div>
            </div>

            <div className="flight-results">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flight-card skeleton-card">
                  <div className="flight-header skeleton-flex">
                    <div className="skeleton-circle pulsing"></div>
                    <div className="skeleton-lines">
                      <div className="skeleton-line-heading pulsing"></div>
                      <div className="skeleton-line-sub pulsing"></div>
                    </div>
                    <div className="skeleton-price-block pulsing"></div>
                  </div>
                  <div className="flight-details skeleton">
                    <div className="skeleton-route-bar pulsing"></div>
                    <div className="skeleton-info-tags pulsing"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isMissingParams = String(error).toLowerCase().includes('missing');
    return (
      <div className="search-results-page">
        <div className="container">
          <div className="search-error-card">
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', margin: '0 auto 1.25rem' }}>
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.75rem', fontWeight: 700 }}>
              {isMissingParams ? 'Invalid Search Criteria' : 'Flight Search Error'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
              {getErrorMessage(error)}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {!isMissingParams && searchParams && (
                <button 
                  onClick={() => executeSearch(searchParams, searchType)} 
                  className="btn-primary"
                  style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#2563eb', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  <i className="fas fa-redo-alt" style={{ marginRight: '0.5rem' }}></i> Retry Search
                </button>
              )}
              <button 
                onClick={() => navigate(isRail ? '/amtrak' : '/')} 
                className="btn-outline-modify"
                style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 600 }}
              >
                <i className="fas fa-search" style={{ marginRight: '0.5rem' }}></i> {isMissingParams ? 'Start New Search' : 'Modify Search'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Sidebar Filters Content
  const renderSidebarFilters = () => (
    <>
      <div className="sidebar-header-row">
        <h3>Filter {isRail ? 'Trains' : 'Flights'}</h3>
        {activeFiltersCount > 0 && (
          <button 
            type="button" 
            className="clear-filters-action" 
            onClick={handleClearAllFilters}
          >
            Clear All ({activeFiltersCount})
          </button>
        )}
      </div>
      
      {/* Price Filter */}
      <div className="filter-group">
        <label className="filter-label">
          <span>Max Price:</span>
          <strong>${sliderPrice}</strong>
        </label>
        <input 
          type="range" 
          min={flights.length > 0 ? Math.min(...flights.map(f => parseFloat(f.price?.total || 0))) : 0}
          max={maxPrice || 3000}
          value={sliderPrice} 
          onChange={(e) => setSliderPrice(parseFloat(e.target.value))}
          className="filter-slider"
        />
      </div>

      {/* Stops Filter */}
      <div className="filter-group">
        <span className="filter-group-title">Stops</span>
        <label className="checkbox-filter-row">
          <input type="checkbox" checked={selectedStops.nonstop} onChange={() => toggleStop('nonstop')} />
          <span className="custom-checkbox"></span>
          <span>Nonstop / Direct</span>
        </label>
        <label className="checkbox-filter-row">
          <input type="checkbox" checked={selectedStops.oneStop} onChange={() => toggleStop('oneStop')} />
          <span className="custom-checkbox"></span>
          <span>1 Stop</span>
        </label>
        <label className="checkbox-filter-row">
          <input type="checkbox" checked={selectedStops.twoPlusStops} onChange={() => toggleStop('twoPlusStops')} />
          <span className="custom-checkbox"></span>
          <span>2+ Stops</span>
        </label>
      </div>

      {/* Time Filter */}
      <div className="filter-group">
        <span className="filter-group-title">Departure Time</span>
        <select value={depTimeFilter} onChange={(e) => setDepTimeFilter(e.target.value)} className="filter-select">
          <option value="all">Any Departure Time</option>
          <option value="morning">Morning (5 AM - 12 PM)</option>
          <option value="afternoon">Afternoon (12 PM - 6 PM)</option>
          <option value="evening">Evening (6 PM - 5 AM)</option>
        </select>
      </div>

      <div className="filter-group">
        <span className="filter-group-title">Arrival Time</span>
        <select value={arrTimeFilter} onChange={(e) => setArrTimeFilter(e.target.value)} className="filter-select">
          <option value="all">Any Arrival Time</option>
          <option value="morning">Morning (5 AM - 12 PM)</option>
          <option value="afternoon">Afternoon (12 PM - 6 PM)</option>
          <option value="evening">Evening (6 PM - 5 AM)</option>
        </select>
      </div>

      {/* Airline Filter */}
      {uniqueAirlines.length > 0 && (
        <div className="filter-group">
          <span className="filter-group-title">{isRail ? 'Train Lines' : 'Airlines'}</span>
          {uniqueAirlines.map(airline => (
            <label key={airline} className="checkbox-filter-row">
              <input 
                type="checkbox" 
                checked={selectedAirlines.includes(airline)} 
                onChange={() => toggleAirline(airline)} 
              />
              <span className="custom-checkbox"></span>
              <span className="truncate">{airline}</span>
            </label>
          ))}
        </div>
      )}

      {/* Duration Filter */}
      <div className="filter-group">
        <label className="filter-label">
          <span>Max Travel Time:</span>
          <strong>{Math.floor(sliderDuration / 60)}h {sliderDuration % 60}m</strong>
        </label>
        <input 
          type="range" 
          min={30}
          max={maxDuration || 1440}
          value={sliderDuration} 
          onChange={(e) => setSliderDuration(parseInt(e.target.value, 10))}
          className="filter-slider"
        />
      </div>
    </>
  );

  return (
    <div className={`search-results-page ${isRail ? 'search-results-page--rail' : ''}`}>
      <div className="container search-layout-container">
        
        {/* DESKTOP SIDEBAR FILTERS PANEL */}
        <aside className="filters-sidebar desktop-only">
          {renderSidebarFilters()}
        </aside>

        {/* MOBILE SLIDE-OVER DRAWER MODAL */}
        {showFiltersDrawer && (
          <>
            <div className="drawer-backdrop" onClick={() => setShowFiltersDrawer(false)}></div>
            <aside className="filters-sidebar mobile-drawer animate-slide-in">
              <div className="drawer-header-row">
                <h3>Filters</h3>
                <button type="button" className="drawer-close-btn" onClick={() => setShowFiltersDrawer(false)} aria-label="Close filters">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="drawer-body">
                {renderSidebarFilters()}
              </div>
              <div className="drawer-footer">
                <button type="button" className="drawer-apply-btn" onClick={() => setShowFiltersDrawer(false)}>
                  Apply Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
                </button>
              </div>
            </aside>
          </>
        )}

        {/* RESULTS SECTION */}
        <div className="results-main-panel">
          
          {/* Top Bar with Route, Dates, and Outlined filter chips */}
          <div className="results-toolbar-row">
            <div className="results-meta-header-row">
              <div className="route-dates-summary">
                <span className="summary-route">
                  {getAirportName(searchParams?.from) || getAirportCode(searchParams?.fromCode || searchParams?.from) || 'Origin'} <i className="fas fa-arrow-right route-arrow-icon"></i> {getAirportName(searchParams?.to) || getAirportCode(searchParams?.toCode || searchParams?.to) || 'Destination'}
                </span>
                <span className="summary-date-separator">·</span>
                <span className="summary-date">
                  {formatDateDisplay(searchParams?.departure) || 'Departure'}
                  {searchParams?.returnDate && ` – ${formatDateDisplay(searchParams.returnDate)}`}
                </span>
              </div>
              <span className="results-count-badge">{sortedFlights.length} result(s)</span>
            </div>

            {/* Outlined Filter Chips */}
            <div className="filter-chips-container" ref={popoverRef}>
              {/* Stops chip */}
              <div className="filter-chip-wrapper">
                <button 
                  type="button" 
                  className={`filter-chip ${!selectedStops.nonstop || !selectedStops.oneStop || !selectedStops.twoPlusStops ? 'selected' : ''}`}
                  onClick={() => setActiveFilterPopover(prev => (prev === 'stops' ? null : 'stops'))}
                >
                  <span>Stops</span>
                  <i className="fas fa-chevron-down chip-chevron"></i>
                </button>
                {activeFilterPopover === 'stops' && (
                  <div className="filter-chip-popover">
                    <label className="checkbox-filter-row">
                      <input type="checkbox" checked={selectedStops.nonstop} onChange={() => toggleStop('nonstop')} />
                      <span className="custom-checkbox"></span>
                      <span>Nonstop</span>
                    </label>
                    <label className="checkbox-filter-row">
                      <input type="checkbox" checked={selectedStops.oneStop} onChange={() => toggleStop('oneStop')} />
                      <span className="custom-checkbox"></span>
                      <span>1 Stop</span>
                    </label>
                    <label className="checkbox-filter-row">
                      <input type="checkbox" checked={selectedStops.twoPlusStops} onChange={() => toggleStop('twoPlusStops')} />
                      <span className="custom-checkbox"></span>
                      <span>2+ Stops</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Airlines chip */}
              <div className="filter-chip-wrapper">
                <button 
                  type="button" 
                  className={`filter-chip ${selectedAirlines.length < uniqueAirlines.length ? 'selected' : ''}`}
                  onClick={() => setActiveFilterPopover(prev => (prev === 'airlines' ? null : 'airlines'))}
                >
                  <span>Airlines</span>
                  <i className="fas fa-chevron-down chip-chevron"></i>
                </button>
                {activeFilterPopover === 'airlines' && (
                  <div className="filter-chip-popover max-height-popover">
                    {uniqueAirlines.map(airline => (
                      <label key={airline} className="checkbox-filter-row">
                        <input 
                          type="checkbox" 
                          checked={selectedAirlines.includes(airline)} 
                          onChange={() => toggleAirline(airline)} 
                        />
                        <span className="custom-checkbox"></span>
                        <span className="truncate">{airline}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Price chip */}
              <div className="filter-chip-wrapper">
                <button 
                  type="button" 
                  className={`filter-chip ${sliderPrice < maxPrice ? 'selected' : ''}`}
                  onClick={() => setActiveFilterPopover(prev => (prev === 'price' ? null : 'price'))}
                >
                  <span>Price: Under ${sliderPrice}</span>
                  <i className="fas fa-chevron-down chip-chevron"></i>
                </button>
                {activeFilterPopover === 'price' && (
                  <div className="filter-chip-popover slider-popover">
                    <label className="filter-label">Max Price: <strong>${sliderPrice}</strong></label>
                    <input 
                      type="range" 
                      min={flights.length > 0 ? Math.min(...flights.map(f => parseFloat(f.price?.total || 0))) : 0}
                      max={maxPrice || 3000}
                      value={sliderPrice} 
                      onChange={(e) => setSliderPrice(parseFloat(e.target.value))}
                      className="filter-slider"
                    />
                  </div>
                )}
              </div>

              {/* Times chip */}
              <div className="filter-chip-wrapper">
                <button 
                  type="button" 
                  className={`filter-chip ${depTimeFilter !== 'all' || arrTimeFilter !== 'all' ? 'selected' : ''}`}
                  onClick={() => setActiveFilterPopover(prev => (prev === 'times' ? null : 'times'))}
                >
                  <span>Times</span>
                  <i className="fas fa-chevron-down chip-chevron"></i>
                </button>
                {activeFilterPopover === 'times' && (
                  <div className="filter-chip-popover dropdown-popover">
                    <span className="popover-section-title">Departure</span>
                    <select value={depTimeFilter} onChange={(e) => setDepTimeFilter(e.target.value)} className="filter-select popover-select">
                      <option value="all">Any Departure Time</option>
                      <option value="morning">Morning (5 AM - 12 PM)</option>
                      <option value="afternoon">Afternoon (12 PM - 6 PM)</option>
                      <option value="evening">Evening (6 PM - 5 AM)</option>
                    </select>

                    <span className="popover-section-title" style={{ marginTop: '10px', display: 'block' }}>Arrival</span>
                    <select value={arrTimeFilter} onChange={(e) => setArrTimeFilter(e.target.value)} className="filter-select popover-select">
                      <option value="all">Any Arrival Time</option>
                      <option value="morning">Morning (5 AM - 12 PM)</option>
                      <option value="afternoon">Afternoon (12 PM - 6 PM)</option>
                      <option value="evening">Evening (6 PM - 5 AM)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Duration chip */}
              <div className="filter-chip-wrapper">
                <button 
                  type="button" 
                  className={`filter-chip ${sliderDuration < maxDuration ? 'selected' : ''}`}
                  onClick={() => setActiveFilterPopover(prev => (prev === 'duration' ? null : 'duration'))}
                >
                  <span>Duration</span>
                  <i className="fas fa-chevron-down chip-chevron"></i>
                </button>
                {activeFilterPopover === 'duration' && (
                  <div className="filter-chip-popover slider-popover">
                    <label className="filter-label">Max Travel Time: <strong>{Math.floor(sliderDuration / 60)}h {sliderDuration % 60}m</strong></label>
                    <input 
                      type="range" 
                      min={30}
                      max={maxDuration || 1440}
                      value={sliderDuration} 
                      onChange={(e) => setSliderDuration(parseInt(e.target.value, 10))}
                      className="filter-slider"
                    />
                  </div>
                )}
              </div>

              <button 
                type="button" 
                className="mobile-filter-trigger-chip" 
                onClick={() => setShowFiltersDrawer(true)}
              >
                <i className="fas fa-sliders-h"></i> All Filters 
                {activeFiltersCount > 0 && <span className="badge">{activeFiltersCount}</span>}
              </button>

              {activeFiltersCount > 0 && (
                <button type="button" className="clear-all-chips-btn" onClick={handleClearAllFilters}>
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Results Toolbar with Heading & Sort dropdown */}
          <div className="results-toolbar-comparison">
            <h3 className="results-heading-google">{isRail ? 'Departing Trains' : 'Departing Flights'}</h3>
            
            <div className="sorting-group">
              <label htmlFor="results-sort-select">Sort by:</label>
              <div className="sort-select-wrapper">
                <select 
                  id="results-sort-select"
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)} 
                  className="sort-select"
                >
                  <option value="best">Best Flights</option>
                  <option value="cheapest">Cheapest Price</option>
                  <option value="fastest">Shortest Duration</option>
                  <option value="earliest">Earliest Departure</option>
                  <option value="latest">Latest Departure</option>
                </select>
                <i className="fas fa-chevron-down sort-chevron"></i>
              </div>
            </div>
          </div>

          {/* Flight comparison rows */}
          <div className="flight-results-rows-container">
            {sortedFlights.length === 0 ? (
              <div className="no-results-card">
                <div className="no-results-icon-circle">
                  <i className={`fas ${isRail ? 'fa-train' : 'fa-plane-departure'}`}></i>
                </div>
                <h3>No flights match your filters</h3>
                <p>Try clearing your active filters or modify your search criteria to find available schedules.</p>
                
                <div className="no-results-actions">
                  {activeFiltersCount > 0 && (
                    <button 
                      onClick={handleClearAllFilters} 
                      className="btn-primary-reset"
                    >
                      Clear All Filters
                    </button>
                  )}
                  <button 
                    onClick={() => navigate(isRail ? '/amtrak' : '/')} 
                    className="btn-outline-modify"
                  >
                    Modify Search
                  </button>
                </div>
              </div>
            ) : (
              sortedFlights.map((flight) => (
                <FlightResultRow
                  key={flight.id}
                  flight={flight}
                  isExpanded={expandedFlightId === flight.id}
                  onToggleExpand={() => toggleExpandFlight(flight.id)}
                  onSelect={handleBookFlight}
                  actionLabel="Select Flight"
                  isRail={isRail}
                  travelersCount={parseInt(searchParams?.adults || 1, 10)}
                />
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

class SearchResultsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error in SearchResultsPage:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="search-results-page">
          <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
            <div className="error-message" style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 25px rgba(0,0,0,0.08)' }}>
              <i className="fas fa-exclamation-circle" style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '1rem' }}></i>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#1e293b' }}>Display Error</h2>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{getErrorMessage(this.state.error)}</p>
              <button onClick={() => window.location.href = '/'} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Return to Search Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function SearchResults() {
  return (
    <SearchResultsErrorBoundary>
      <SearchResultsContent />
    </SearchResultsErrorBoundary>
  );
}

export default SearchResults;
