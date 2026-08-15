import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AirportAutocomplete from './AirportAutocomplete';
import CustomSelect from '../../../shared/components/CustomSelect';
import TravelDatePicker from './TravelDatePicker';
import analytics from '../../../shared/utils/analytics';
import './FlightSearchPanel.css';

const extractAirportCode = (value, airport) => {
  const directCode = airport?.code || airport?.id;
  if (directCode && /^[A-Z]{3}$/i.test(String(directCode))) {
    return String(directCode).toUpperCase();
  }

  const text = String(value || '').trim();
  const parenthesized = text.match(/\(([A-Z]{3})\)/i);
  if (parenthesized) return parenthesized[1].toUpperCase();
  if (/^[A-Z]{3}$/i.test(text)) return text.toUpperCase();
  return '';
};

export default function SeniorFlightSearchPanel() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchData, setSearchData] = useState({
    from: '',
    fromAirport: null,
    to: '',
    toAirport: null,
    departure: today,
    returnDate: '',
    tripType: 'roundtrip',
    adults: 1,
    travelClass: 'economy',
    currency: 'USD',
  });

  const change = (field, value) => {
    setSearchData((prev) => ({ ...prev, [field]: value }));
    setErrorMessage('');
  };

  const handleSearch = (event) => {
    event.preventDefault();
    if (isSearching) return;

    const fromCode = extractAirportCode(searchData.from, searchData.fromAirport);
    const toCode = extractAirportCode(searchData.to, searchData.toAirport);

    if (!fromCode || !toCode) {
      setErrorMessage('Please select valid origin and destination airports from the suggestions.');
      return;
    }
    if (fromCode === toCode) {
      setErrorMessage('Origin and destination airports cannot be the same.');
      return;
    }
    if (!searchData.departure) {
      setErrorMessage('Please select a departure date.');
      return;
    }
    if (searchData.tripType === 'roundtrip' && !searchData.returnDate) {
      setErrorMessage('Please select a return date for a round trip.');
      return;
    }
    if (
      searchData.tripType === 'roundtrip' &&
      searchData.returnDate &&
      searchData.returnDate < searchData.departure
    ) {
      setErrorMessage('Return date cannot be before the departure date.');
      return;
    }

    setIsSearching(true);

    try {
      const fromDisplay = typeof searchData.from === 'string' ? searchData.from : fromCode;
      const toDisplay = typeof searchData.to === 'string' ? searchData.to : toCode;

      const payload = {
        ...searchData,
        from: fromDisplay,
        to: toDisplay,
        fromCode,
        toCode,
        children: 0,
        infants: 0,
        infantsInSeat: 0,
        infantsOnLap: 0,
        fromAirport: searchData.fromAirport || { code: fromCode, name: fromDisplay },
        toAirport: searchData.toAirport || { code: toCode, name: toDisplay },
        searchDate: new Date().toISOString(),
      };

      sessionStorage.setItem('searchParams', JSON.stringify(payload));
      sessionStorage.setItem('searchType', searchData.tripType);
      sessionStorage.removeItem('selectedFlight');
      sessionStorage.removeItem('returnFlight');

      analytics.trackFlightSearchSubmitted('senior-travel-flight-deals', payload);

      const params = new URLSearchParams({
        from: fromCode,
        to: toCode,
        fromDisplay,
        toDisplay,
        departure: searchData.departure,
        tripType: searchData.tripType,
        adults: String(searchData.adults),
        children: '0',
        infants: '0',
        infantsInSeat: '0',
        infantsOnLap: '0',
        travelClass: searchData.travelClass,
        currency: searchData.currency,
      });

      if (searchData.tripType === 'roundtrip') {
        params.set('returnDate', searchData.returnDate);
      }

      navigate(`/search?${params.toString()}`);
    } catch (error) {
      analytics.trackFlightSearchFailed('senior-travel-flight-deals', error?.message || 'Search failed');
      setErrorMessage('We could not open flight results. Please try again.');
      setIsSearching(false);
    }
  };

  return (
    <div className="flight-search-panel-wrapper" id="senior-flight-search-form">
      <div className="flights-inquiry-card">
        <h2 className="flight-search-title">Search Flights</h2>
        <p className="flights-inquiry__intro">
          Enter your route and travel dates to compare available flight options. Personal booking assistance is also available below.
        </p>

        <form className="flights-form" onSubmit={handleSearch}>
          <div className="search-meta-row">
            <div className="search-meta-left">
              <CustomSelect
                id="senior-search-trip-type"
                value={searchData.tripType}
                onChange={(value) => change('tripType', value)}
                options={[
                  { value: 'roundtrip', label: 'Round Trip' },
                  { value: 'oneway', label: 'One Way' },
                ]}
                icon="fas fa-route"
              />
              <CustomSelect
                id="senior-search-class"
                value={searchData.travelClass}
                onChange={(value) => change('travelClass', value)}
                options={[
                  { value: 'economy', label: 'Economy' },
                  { value: 'premium', label: 'Premium Economy' },
                  { value: 'business', label: 'Business' },
                  { value: 'first', label: 'First Class' },
                ]}
                icon="fas fa-chair"
              />
              <CustomSelect
                id="senior-search-travelers"
                value={String(searchData.adults)}
                onChange={(value) => change('adults', Number(value))}
                options={[1, 2, 3, 4, 5, 6].map((count) => ({
                  value: String(count),
                  label: `${count} Traveler${count > 1 ? 's' : ''}`,
                }))}
                icon="fas fa-user-friends"
              />
            </div>
            <div className="search-meta-right">
              <CustomSelect
                id="senior-search-currency"
                value={searchData.currency}
                onChange={(value) => change('currency', value)}
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

          <div className="flights-form__row" style={{ gap: '1.25rem' }}>
            <div className="flights-form__group" style={{ margin: 0 }}>
              <AirportAutocomplete
                label="Origin Airport"
                id="senior-search-origin"
                value={searchData.from}
                excludeCode={searchData.toAirport?.code}
                onChange={(value, item) => {
                  change('from', value);
                  setSearchData((prev) => ({ ...prev, fromAirport: item }));
                }}
                placeholder="e.g. New York (JFK)"
                required
              />
            </div>
            <div className="flights-form__group" style={{ margin: 0 }}>
              <AirportAutocomplete
                label="Destination Airport"
                id="senior-search-destination"
                value={searchData.to}
                excludeCode={searchData.fromAirport?.code}
                onChange={(value, item) => {
                  change('to', value);
                  setSearchData((prev) => ({ ...prev, toAirport: item }));
                }}
                placeholder="e.g. Los Angeles (LAX)"
                required
              />
            </div>
          </div>

          <div className="flights-form__row" style={{ gap: '1.25rem', marginTop: '1.25rem' }}>
            <div className="flights-form__group" style={{ margin: 0 }}>
              <TravelDatePicker
                id="senior-search-departure"
                label="Departure Date"
                value={searchData.departure}
                onChange={(value) => change('departure', value)}
                minDate={today}
                required
              />
            </div>
            <div
              className="flights-form__group"
              style={{ margin: 0, opacity: searchData.tripType === 'oneway' ? 0.45 : 1 }}
            >
              <TravelDatePicker
                id="senior-search-return"
                label="Return Date"
                value={searchData.returnDate}
                onChange={(value) => change('returnDate', value)}
                minDate={searchData.departure || today}
                disabled={searchData.tripType === 'oneway'}
                required={searchData.tripType === 'roundtrip'}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <button
              type="submit"
              className="flights-btn flights-btn--cta btn-primary-search"
              disabled={isSearching}
              style={{ width: '100%' }}
            >
              {isSearching ? (
                <><i className="fas fa-circle-notch fa-spin"></i> Searching Flights...</>
              ) : (
                <><i className="fas fa-search"></i> Search Flights</>
              )}
            </button>
          </div>

          {errorMessage && (
            <p
              className="inquiry-form__message inquiry-form__message--error"
              role="alert"
              style={{ marginTop: '1rem' }}
            >
              <i className="fas fa-exclamation-triangle"></i> {errorMessage}
            </p>
          )}

          <p
            className="airline-intent-disclosure"
            style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', marginTop: '1.25rem', marginBottom: 0, lineHeight: 1.45 }}
          >
            <i className="fas fa-info-circle"></i> The Final Seat is an independent flight-search and reservation-assistance service and is not affiliated with or endorsed by individual airlines.
          </p>
        </form>
      </div>
    </div>
  );
}
