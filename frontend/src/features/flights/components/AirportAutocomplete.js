import React, { useEffect, useRef, useState } from 'react';
import { airportAPI } from '../../../shared/api/api';
import { buildAirportSelection, normalizeIataCode } from '../utils/airportIdentity';
import './AirportAutocomplete.css';

export function formatAirportLabel(airport) {
  if (!airport) return '';

  if (typeof airport === 'string') {
    const text = airport.trim();
    const code = normalizeIataCode(text);
    const clean = text.replace(/\s*\([A-Z]{3}\)\s*$/i, '').trim();
    return clean && code ? `${clean} (${code})` : (clean || code || text);
  }

  const code = normalizeIataCode(airport);
  let city = String(airport.city || airport.municipality || airport.name || '').trim();
  if (code) {
    city = city.replace(/\([^)]*\)/g, '').replace(new RegExp(`\\b${code}\\b`, 'gi'), '').trim();
  }

  if (city && code) return `${city} (${code})`;
  return city || code || '';
}

const LOCAL_FALLBACK_AIRPORTS = [
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', state: 'NY', country: 'United States' },
  { code: 'LGA', name: 'LaGuardia Airport', city: 'New York', state: 'NY', country: 'United States' },
  { code: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', state: 'NJ', country: 'United States' },
  { code: 'GEG', name: 'Spokane International Airport', city: 'Spokane', state: 'WA', country: 'United States' },
  { code: 'TPA', name: 'Tampa International Airport', city: 'Tampa', state: 'FL', country: 'United States' },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA', country: 'United States' },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', state: 'CA', country: 'United States' },
  { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', state: 'WA', country: 'United States' },
  { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', state: 'IL', country: 'United States' },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', state: 'GA', country: 'United States' },
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL', country: 'United States' },
  { code: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', state: 'FL', country: 'United States' },
  { code: 'MCO', name: 'Orlando International Airport', city: 'Orlando', state: 'FL', country: 'United States' },
  { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas/Fort Worth', state: 'TX', country: 'United States' },
  { code: 'DEN', name: 'Denver International Airport', city: 'Denver', state: 'CO', country: 'United States' },
  { code: 'BOS', name: 'Logan International Airport', city: 'Boston', state: 'MA', country: 'United States' },
  { code: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', state: 'DC', country: 'United States' },
  { code: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington', state: 'DC', country: 'United States' },
  { code: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', state: 'TX', country: 'United States' },
  { code: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom' },
  { code: 'LGW', name: 'London Gatwick Airport', city: 'London', country: 'United Kingdom' },
  { code: 'CDG', name: 'Paris Charles de Gaulle Airport', city: 'Paris', country: 'France' },
  { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'United Arab Emirates' },
  { code: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan' },
  { code: 'NRT', name: 'Tokyo Narita Airport', city: 'Tokyo', country: 'Japan' },
  { code: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia' },
];

function scoreAirportMatch(airport, queryStr) {
  const q = String(queryStr || '').trim().toLowerCase();
  if (!q) return 0;
  const code = normalizeIataCode(airport);
  if (!code) return 0;

  const city = String(airport.city || '').toLowerCase();
  const name = String(airport.name || '').toLowerCase();
  const country = String(airport.country || '').toLowerCase();
  const qUpper = q.toUpperCase();

  if (code === qUpper) return 10000;
  if (code.startsWith(qUpper)) return 8000;
  if (city === q) return 6000;
  if (city.startsWith(q)) return 4000;
  if (city.includes(q)) return 3000;
  if (name.startsWith(q)) return 2000;
  if (name.includes(q)) return 1000;
  if (country.includes(q)) return 500;
  return 0;
}

function rankAirportSuggestions(airports, queryStr) {
  return (Array.isArray(airports) ? airports : [])
    .filter((airport) => normalizeIataCode(airport))
    .map((airport) => ({ airport, score: scoreAirportMatch(airport, queryStr) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || normalizeIataCode(a.airport).localeCompare(normalizeIataCode(b.airport)))
    .map(({ airport }) => airport);
}

function AirportAutocomplete({ label, id, value, onChange, placeholder, excludeCode, required = false }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => {
    setQuery(value ? formatAirportLabel(value) : '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  const fetchSuggestions = async (searchVal) => {
    const trimmed = String(searchVal || '').trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setErrorMsg('');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    const excluded = normalizeIataCode(excludeCode);

    try {
      const response = await airportAPI.search(trimmed);
      const apiList = response?.success && Array.isArray(response.data) ? response.data : [];
      const validApiList = apiList.filter((item) => normalizeIataCode(item) && normalizeIataCode(item) !== excluded);
      const localList = LOCAL_FALLBACK_AIRPORTS.filter((item) => normalizeIataCode(item) !== excluded);
      const merged = new Map();
      [...localList, ...validApiList].forEach((item) => {
        const code = normalizeIataCode(item);
        if (code && !merged.has(code)) merged.set(code, { ...item, code });
      });
      const ranked = rankAirportSuggestions([...merged.values()], trimmed);
      setSuggestions(ranked);
      if (ranked.length === 0 && !normalizeIataCode(trimmed)) {
        setErrorMsg('No matching airport found. Select a suggestion or enter an exact 3-letter IATA code.');
      }
    } catch {
      const ranked = rankAirportSuggestions(LOCAL_FALLBACK_AIRPORTS, trimmed)
        .filter((item) => normalizeIataCode(item) !== excluded);
      setSuggestions(ranked);
      if (ranked.length === 0 && !normalizeIataCode(trimmed)) {
        setErrorMsg('No matching airport found. Select a suggestion or enter an exact 3-letter IATA code.');
      }
    } finally {
      setLoading(false);
      setActiveIndex(-1);
    }
  };

  const emitSelection = (selection) => {
    if (typeof onChange === 'function') onChange(selection, selection);
  };

  const handleInputChange = (event) => {
    const val = event.target.value;
    setQuery(val);
    setShowSuggestions(true);
    setErrorMsg('');

    const exactLocal = LOCAL_FALLBACK_AIRPORTS.find((airport) => normalizeIataCode(airport) === val.trim().toUpperCase());
    emitSelection(buildAirportSelection(val, exactLocal || null));

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const handleSelectSuggestion = (suggestion) => {
    const code = normalizeIataCode(suggestion);
    if (!code) return;
    const canonical = {
      ...suggestion,
      code,
      city: suggestion.city || suggestion.name || code,
      name: suggestion.name || suggestion.city || code,
      unresolved: false,
    };
    setQuery(formatAirportLabel(canonical));
    emitSelection(canonical);
    setSuggestions([]);
    setShowSuggestions(false);
    setErrorMsg('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }
    if (!showSuggestions) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % Math.max(suggestions.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + Math.max(suggestions.length, 1)) % Math.max(suggestions.length, 1));
    } else if (event.key === 'Enter' && suggestions.length > 0) {
      event.preventDefault();
      handleSelectSuggestion(suggestions[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  return (
    <div className="airport-autocomplete-container" ref={containerRef}>
      {label && <label htmlFor={id} className="autocomplete-label">{label}</label>}
      <div className="autocomplete-input-wrapper">
        <i className="fas fa-plane-departure input-icon" aria-hidden="true" />
        <input
          type="text"
          id={id}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder || 'City or Airport Code'}
          required={required}
          autoComplete="off"
          className="autocomplete-input"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
        />
        {loading && <i className="fas fa-circle-notch fa-spin input-loading-icon" />}
      </div>

      {showSuggestions && (suggestions.length > 0 || errorMsg) && (
        <ul className="autocomplete-suggestions-list" role="listbox">
          {errorMsg && (
            <li className="suggestion-error-banner" role="status">
              <i className="fas fa-exclamation-triangle" /> <span>{errorMsg}</span>
            </li>
          )}
          {suggestions.map((item, index) => {
            const code = normalizeIataCode(item);
            return (
              <li
                key={code}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleSelectSuggestion(item)}
                className={`suggestion-item ${index === activeIndex ? 'active' : ''}`}
              >
                <div className="suggestion-icon"><i className="fas fa-plane" /></div>
                <div className="suggestion-details">
                  <span className="suggestion-name">{item.name || item.city || code}</span>
                  <span className="suggestion-location">
                    <strong>{code}</strong> · {item.city || 'Airport'}{item.state ? `, ${item.state}` : ''}{item.country ? ` · ${item.country}` : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default AirportAutocomplete;
