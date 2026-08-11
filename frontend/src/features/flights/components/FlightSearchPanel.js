import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AirportAutocomplete from './AirportAutocomplete';
import CustomSelect from '../../../shared/components/CustomSelect';
import TravelDatePicker from './TravelDatePicker';
import analytics from '../../../shared/utils/analytics';
import './FlightSearchPanel.css';

const MAX_TRAVELERS = 9;

function FlightSearchPanel({
  pageId = 'home',
  title = 'Search Flights',
  subtitle = 'Compare flight options with real-time routes, fares, and personal booking assistance.',
  defaultBookingForSomeoneElse = false,
  isUrgentContext = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassengerPopup, setShowPassengerPopup] = useState(false);
  const passengerRef = useRef(null);

  // Initialize search form state
  const todayStr = new Date().toISOString().split('T')[0];

  const [searchData, setSearchData] = useState({
    from: '',
    fromAirport: null,
    to: '',
    toAirport: null,
    departure: todayStr,
    returnDate: '',
    tripType: 'roundtrip',
    adults: 1,
    children: 0,
    infantsInSeat: 0,
    infantsOnLap: 0,
    travelClass: 'economy',
    currency: 'USD',
    isBookingForSomeoneElse: defaultBookingForSomeoneElse,
    airlinePrefill: '',
  });

  // Safe URL Query Parameter Pre-filling
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const airline = params.get('airline') || '';
    const fromParam = params.get('from') || '';
    const toParam = params.get('to') || '';
    const depParam = params.get('departure') || params.get('dep') || '';
    const retParam = params.get('returnDate') || params.get('return') || params.get('ret') || '';
    const tripParam = params.get('tripType') || params.get('trip') || '';
    const adultsParam = parseInt(params.get('adults'), 10);
    const childrenParam = parseInt(params.get('children'), 10);
    const legacyInfantsParam = parseInt(params.get('infants'), 10);
    const infantsInSeatParam = parseInt(params.get('infantsInSeat'), 10);
    const infantsOnLapParam = parseInt(params.get('infantsOnLap'), 10);
    const hasSplitInfants = params.has('infantsInSeat') || params.has('infantsOnLap');
    const cabinParam = params.get('cabin') || params.get('travelClass') || '';
    const bookingForOtherParam = params.get('bookingForOther') === 'true';

    setSearchData((prev) => ({
      ...prev,
      airlinePrefill: airline || prev.airlinePrefill,
      from: fromParam ? fromParam.toUpperCase() : prev.from,
      to: toParam ? toParam.toUpperCase() : prev.to,
      departure: depParam || (isUrgentContext ? todayStr : prev.departure),
      returnDate: retParam || prev.returnDate,
      tripType: tripParam === 'oneway' ? 'oneway' : prev.tripType,
      adults: Number.isInteger(adultsParam) && adultsParam >= 1 ? adultsParam : prev.adults,
      children: Number.isInteger(childrenParam) && childrenParam >= 0 ? childrenParam : prev.children,
      infantsInSeat: hasSplitInfants && Number.isInteger(infantsInSeatParam) && infantsInSeatParam >= 0
        ? infantsInSeatParam
        : 0,
      // Old links only had `infants`, and that field historically meant lap infants.
      infantsOnLap: hasSplitInfants
        ? (Number.isInteger(infantsOnLapParam) && infantsOnLapParam >= 0 ? infantsOnLapParam : 0)
        : (Number.isInteger(legacyInfantsParam) && legacyInfantsParam >= 0 ? legacyInfantsParam : prev.infantsOnLap),
      travelClass: ['economy', 'premium', 'business', 'first'].includes(cabinParam) ? cabinParam : prev.travelClass,
      isBookingForSomeoneElse: bookingForOtherParam || defaultBookingForSomeoneElse,
    }));

    analytics.trackSeoPageView(pageId);
  }, [location.search, pageId, defaultBookingForSomeoneElse, isUrgentContext, todayStr]);

  // Outside click listener for passenger popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (passengerRef.current && !passengerRef.current.contains(event.target)) {
        setShowPassengerPopup(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (field, value) => {
    setSearchData((prev) => ({ ...prev, [field]: value }));
    setErrorMessage('');
  };

  // Passenger count modifiers
  const incrementPassenger = (type) => {
    setSearchData((prev) => {
      const total = prev.adults + prev.children + prev.infantsInSeat + prev.infantsOnLap;
      if (total >= MAX_TRAVELERS) return prev;
      if (type === 'infantsOnLap' && prev.infantsOnLap >= prev.adults) return prev;
      return { ...prev, [type]: prev[type] + 1 };
    });
  };

  const decrementPassenger = (type) => {
    setSearchData((prev) => {
      if (type === 'adults' && prev.adults <= 1) return prev;
      if (prev[type] <= 0) return prev;
      const nextState = { ...prev, [type]: prev[type] - 1 };
      if (type === 'adults' && nextState.infantsOnLap > nextState.adults) {
        nextState.infantsOnLap = nextState.adults;
      }
      return nextState;
    });
  };

  const handlePassengerKeyDown = (e) => {
    if (e.key === 'Escape') setShowPassengerPopup(false);
  };

  const validateSearchForm = () => {
    if (!searchData.from || !searchData.from.trim()) {
      setErrorMessage('Select your departure airport.');
      return false;
    }
    if (!searchData.to || !searchData.to.trim()) {
      setErrorMessage('Select your destination airport.');
      return false;
    }
    if (searchData.from.trim().toUpperCase() === searchData.to.trim().toUpperCase()) {
      setErrorMessage('Origin and destination airports cannot be identical.');
      return false;
    }
    if (!searchData.departure) {
      setErrorMessage('Choose a valid departure date.');
      return false;
    }
    if (searchData.tripType === 'roundtrip' && !searchData.returnDate) {
      setErrorMessage('Choose a valid return date for round trip search.');
      return false;
    }
    if (searchData.tripType === 'roundtrip' && searchData.returnDate < searchData.departure) {
      setErrorMessage('Return date cannot be before departure date.');
      return false;
    }
    if (searchData.adults < 1) {
      setErrorMessage('At least one adult traveler is required.');
      return false;
    }
    if (searchData.infantsOnLap > searchData.adults) {
      setErrorMessage('Infants on lap cannot exceed the number of adult travelers.');
      return false;
    }
    return true;
  };

  const handleSearchFlightsSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validateSearchForm()) {
      analytics.trackFlightSearchFailed(pageId, 'Validation Failed');
      return;
    }

    setIsSearching(true);
    analytics.trackFlightSearchSubmitted(pageId, searchData);

    try {
      const totalInfants = searchData.infantsInSeat + searchData.infantsOnLap;

      // Save criteria into shared session state. `infants` remains the total so
      // existing booking forms create one traveler form for every infant.
      sessionStorage.setItem('searchParams', JSON.stringify({
        ...searchData,
        infants: totalInfants,
        searchDate: new Date().toISOString(),
      }));

      // Construct URL query string
      const searchQueryParams = new URLSearchParams({
        from: searchData.from.trim().toUpperCase(),
        to: searchData.to.trim().toUpperCase(),
        departure: searchData.departure,
        tripType: searchData.tripType,
        adults: searchData.adults,
        children: searchData.children,
        infants: totalInfants,
        infantsInSeat: searchData.infantsInSeat,
        infantsOnLap: searchData.infantsOnLap,
        travelClass: searchData.travelClass,
        currency: searchData.currency,
      });

      if (searchData.tripType === 'roundtrip' && searchData.returnDate) {
        searchQueryParams.set('returnDate', searchData.returnDate);
      }
      if (searchData.airlinePrefill) {
        searchQueryParams.set('airline', searchData.airlinePrefill);
      }
      if (searchData.isBookingForSomeoneElse) {
        searchQueryParams.set('bookingForOther', 'true');
      }

      navigate(`/search?${searchQueryParams.toString()}`);
    } catch (err) {
      console.error('[Flight Search Error]:', err);
      setErrorMessage('We could not load flight options right now. Please try again or call a travel specialist.');
      analytics.trackFlightSearchFailed(pageId, err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const totalTravelers = searchData.adults + searchData.children + searchData.infantsInSeat + searchData.infantsOnLap;

  return (
    <div className="flight-search-panel-wrapper" id="flight-search-form">
      <div className="flights-inquiry-card">
        {/* Panel Title & Header */}
        <h2 className="flight-search-title">{title}</h2>
        {subtitle && <p className="flights-inquiry__intro">{subtitle}</p>}

        {/* Airline Intent Note */}
        {searchData.airlinePrefill && (
          <div className="airline-prefill-banner">
            <i className="fas fa-plane-departure"></i>
            <span>Showing flight options matching preferred airline: <strong>{searchData.airlinePrefill.toUpperCase()}</strong></span>
          </div>
        )}

        {/* Urgent Search Hint */}
        {isUrgentContext && (
          <p className="search-urgent-hint">
            <i className="fas fa-bolt"></i>
            <span><strong>Need to travel within 3 days?</strong> Priority assistance is available. Save up to 20% on eligible reservations.</span>
          </p>
        )}

        <form className="flights-form" onSubmit={handleSearchFlightsSubmit}>
          {/* Meta Selections Row */}
          <div className="search-meta-row">
            <div className="search-meta-left">
              <CustomSelect
                id="search-trip-type"
                value={searchData.tripType}
                onChange={(val) => handleSearchChange('tripType', val)}
                options={[
                  { value: 'roundtrip', label: 'Round Trip' },
                  { value: 'oneway', label: 'One Way' },
                ]}
                icon="fas fa-route"
              />

              <CustomSelect
                id="search-travel-class"
                value={searchData.travelClass}
                onChange={(val) => handleSearchChange('travelClass', val)}
                options={[
                  { value: 'economy', label: 'Economy' },
                  { value: 'premium', label: 'Premium Economy' },
                  { value: 'business', label: 'Business' },
                  { value: 'first', label: 'First Class' },
                ]}
                icon="fas fa-chair"
              />

              {/* Traveler Popover */}
              <div className="search-meta-group" style={{ position: 'relative' }} ref={passengerRef} onKeyDown={handlePassengerKeyDown}>
                <button
                  type="button"
                  className={`passenger-trigger-btn ${showPassengerPopup ? 'active' : ''}`}
                  onClick={() => setShowPassengerPopup(!showPassengerPopup)}
                  aria-haspopup="dialog"
                  aria-expanded={showPassengerPopup}
                >
                  <i className="fas fa-user-friends" style={{ color: '#64748b' }}></i>
                  <span>{totalTravelers} Traveler(s)</span>
                  <i className={`fas fa-chevron-${showPassengerPopup ? 'up' : 'down'}`} style={{ fontSize: '0.7rem' }}></i>
                </button>

                {showPassengerPopup && (
                  <div className="passenger-popover" role="dialog" aria-label="Traveler selector">
                    <div className="passenger-row">
                      <div className="passenger-label">
                        <span className="passenger-type">Adults</span>
                        <span className="passenger-age-desc">Age 18+</span>
                      </div>
                      <div className="passenger-counters">
                        <button type="button" className="counter-btn" onClick={() => decrementPassenger('adults')} disabled={searchData.adults <= 1}>-</button>
                        <span className="counter-value">{searchData.adults}</span>
                        <button type="button" className="counter-btn" onClick={() => incrementPassenger('adults')} disabled={totalTravelers >= MAX_TRAVELERS}>+</button>
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
                        <button type="button" className="counter-btn" onClick={() => incrementPassenger('children')} disabled={totalTravelers >= MAX_TRAVELERS}>+</button>
                      </div>
                    </div>
                    <div className="passenger-row">
                      <div className="passenger-label">
                        <span className="passenger-type">Infants in seat</span>
                        <span className="passenger-age-desc">Under 2</span>
                      </div>
                      <div className="passenger-counters">
                        <button type="button" className="counter-btn" onClick={() => decrementPassenger('infantsInSeat')} disabled={searchData.infantsInSeat <= 0}>-</button>
                        <span className="counter-value">{searchData.infantsInSeat}</span>
                        <button type="button" className="counter-btn" onClick={() => incrementPassenger('infantsInSeat')} disabled={totalTravelers >= MAX_TRAVELERS}>+</button>
                      </div>
                    </div>
                    <div className="passenger-row">
                      <div className="passenger-label">
                        <span className="passenger-type">Infants on lap</span>
                        <span className="passenger-age-desc">Under 2</span>
                      </div>
                      <div className="passenger-counters">
                        <button type="button" className="counter-btn" onClick={() => decrementPassenger('infantsOnLap')} disabled={searchData.infantsOnLap <= 0}>-</button>
                        <span className="counter-value">{searchData.infantsOnLap}</span>
                        <button type="button" className="counter-btn" onClick={() => incrementPassenger('infantsOnLap')} disabled={searchData.infantsOnLap >= searchData.adults || totalTravelers >= MAX_TRAVELERS}>+</button>
                      </div>
                    </div>
                    <button type="button" className="passenger-popup-close" onClick={() => setShowPassengerPopup(false)}>Done</button>
                  </div>
                )}
              </div>
            </div>

            <div className="search-meta-right">
              <CustomSelect
                id="search-currency"
                value={searchData.currency}
                onChange={(val) => handleSearchChange('currency', val)}
                options={[
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'EUR', label: 'EUR (€)' },
                  { value: 'GBP', label: 'GBP (£)' },
                  { value: 'CAD', label: 'CAD (C$)' },
                ]}
                icon="fas fa-dollar-sign"
              />
            </div>
          </div>

          {/* Airport Autocomplete Row */}
          <div className="flights-form__row" style={{ gap: '1.25rem' }}>
            <div className="flights-form__group" style={{ margin: 0 }}>
              <AirportAutocomplete
                label="Origin Airport"
                id="search-origin"
                value={searchData.from}
                excludeCode={searchData.toAirport?.code}
                onChange={(val, item) => {
                  handleSearchChange('from', val);
                  handleSearchChange('fromAirport', item);
                }}
                placeholder="e.g. New York (JFK)"
                required
              />
            </div>
            <div className="flights-form__group" style={{ margin: 0 }}>
              <AirportAutocomplete
                label="Destination Airport"
                id="search-destination"
                value={searchData.to}
                excludeCode={searchData.fromAirport?.code}
                onChange={(val, item) => {
                  handleSearchChange('to', val);
                  handleSearchChange('toAirport', item);
                }}
                placeholder="e.g. Los Angeles (LAX)"
                required
              />
            </div>
          </div>

          {/* Dates Row */}
          <div className="flights-form__row" style={{ gap: '1.25rem', marginTop: '1.25rem' }}>
            <div className="flights-form__group" style={{ margin: 0 }}>
              <TravelDatePicker
                id="search-departure-date"
                label="Departure Date"
                value={searchData.departure}
                onChange={(val) => handleSearchChange('departure', val)}
                minDate={todayStr}
                required
              />
            </div>
            <div className="flights-form__group" style={{ margin: 0, opacity: searchData.tripType === 'oneway' ? 0.4 : 1 }}>
              <TravelDatePicker
                id="search-return-date"
                label="Return Date"
                value={searchData.returnDate}
                onChange={(val) => handleSearchChange('returnDate', val)}
                minDate={searchData.departure || todayStr}
                disabled={searchData.tripType === 'oneway'}
                required={searchData.tripType === 'roundtrip'}
              />
            </div>
          </div>

          {/* Booking For Someone Else Checkbox */}
          <div className="search-booking-for-someone-else" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1' }}>
            <label htmlFor="booking-for-someone-else" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#334155', fontWeight: '500' }}>
              <input
                type="checkbox"
                id="booking-for-someone-else"
                checked={!!searchData.isBookingForSomeoneElse}
                onChange={(e) => handleSearchChange('isBookingForSomeoneElse', e.target.checked)}
                style={{ width: '17px', height: '17px', accentColor: '#8b1538', cursor: 'pointer' }}
              />
              <span>I am arranging this trip for a parent, relative or family member</span>
            </label>
          </div>

          {/* Submit Action */}
          <div style={{ marginTop: '1.25rem' }}>
            <button
              type="submit"
              className="flights-btn flights-btn--cta btn-primary-search"
              disabled={isSearching}
            >
              {isSearching ? (
                <><i className="fas fa-circle-notch fa-spin"></i> Searching Flights...</>
              ) : (
                <><i className="fas fa-search"></i> Search Flights</>
              )}
            </button>
          </div>

          {/* Validation & API Error Notice */}
          {errorMessage && (
            <p className="inquiry-form__message inquiry-form__message--error" role="alert" style={{ marginTop: '1rem' }}>
              <i className="fas fa-exclamation-triangle"></i> {errorMessage}
            </p>
          )}

          {/* Airline Intent Independent Service Disclosure */}
          <p className="airline-intent-disclosure" style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', marginTop: '1.25rem', marginBottom: 0, lineHeight: 1.45 }}>
            <i className="fas fa-info-circle"></i> The Final Seat is an independent flight-search and reservation-assistance service and is not affiliated with or endorsed by individual airlines.
          </p>
        </form>
      </div>
    </div>
  );
}

export default FlightSearchPanel;