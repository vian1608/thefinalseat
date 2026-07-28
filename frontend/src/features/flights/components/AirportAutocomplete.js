import React, { useState, useEffect, useRef } from 'react';
import { airportAPI } from '../../../shared/api/api';
import './AirportAutocomplete.css';

const LOCAL_FALLBACK_AIRPORTS = [
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', state: 'NY', country: 'United States' },
  { code: 'LGA', name: 'LaGuardia Airport', city: 'New York', state: 'NY', country: 'United States' },
  { code: 'EWR', name: 'Newark Liberty International Airport', city: 'New York', state: 'NJ', country: 'United States' },
  { code: 'GEG', name: 'Spokane International Airport', city: 'Spokane', state: 'WA', country: 'United States' },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA', country: 'United States' },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', state: 'CA', country: 'United States' },
  { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', state: 'WA', country: 'United States' },
  { code: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago', state: 'IL', country: 'United States' },
  { code: 'MDW', name: 'Midway International Airport', city: 'Chicago', state: 'IL', country: 'United States' },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', state: 'GA', country: 'United States' },
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL', country: 'United States' },
  { code: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', state: 'FL', country: 'United States' },
  { code: 'MCO', name: 'Orlando International Airport', city: 'Orlando', state: 'FL', country: 'United States' },
  { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas/Fort Worth', state: 'TX', country: 'United States' },
  { code: 'DAL', name: 'Dallas Love Field', city: 'Dallas', state: 'TX', country: 'United States' },
  { code: 'DEN', name: 'Denver International Airport', city: 'Denver', state: 'CO', country: 'United States' },
  { code: 'BOS', name: 'Logan International Airport', city: 'Boston', state: 'MA', country: 'United States' },
  { code: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', state: 'DC', country: 'United States' },
  { code: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington', state: 'DC', country: 'United States' },

  // International
  { code: 'LHR', name: 'London Heathrow Airport', city: 'London', state: '', country: 'United Kingdom' },
  { code: 'LGW', name: 'London Gatwick Airport', city: 'London', state: '', country: 'United Kingdom' },
  { code: 'LCY', name: 'London City Airport', city: 'London', state: '', country: 'United Kingdom' },
  { code: 'STN', name: 'London Stansted Airport', city: 'London', state: '', country: 'United Kingdom' },
  { code: 'CDG', name: 'Paris Charles de Gaulle Airport', city: 'Paris', state: '', country: 'France' },
  { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', state: '', country: 'United Arab Emirates' },
  { code: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', state: '', country: 'Japan' },
  { code: 'NRT', name: 'Tokyo Narita Airport', city: 'Tokyo', state: '', country: 'Japan' },
  { code: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', state: '', country: 'Australia' }
];

function scoreAirportMatch(airport, queryStr) {
  if (!queryStr || !airport) return 0;
  const q = String(queryStr).trim().toLowerCase();
  const qUpper = q.toUpperCase();
  if (!q) return 0;

  const code = (airport.code || '').toUpperCase();
  const city = (airport.city || '').toLowerCase();
  const name = (airport.name || '').toLowerCase();
  const country = (airport.country || '').toLowerCase();

  // 1. Exact IATA Code Match (Highest Priority)
  if (code === qUpper) return 10000;

  // 2. IATA Code Prefix Match
  if (code.startsWith(qUpper)) return 8000;

  // 3. Exact City Match
  if (city === q) return 6000;

  // 4. City Prefix Match
  if (city.startsWith(q)) return 4000;

  // 5. City Partial Match
  if (city.includes(q)) return 3000;

  // 6. Airport Name Prefix Match
  if (name.startsWith(q)) return 2000;

  // 7. Airport Name Substring Match
  if (name.includes(q)) return 1000;

  // 8. Country Match
  if (country.startsWith(q) || country.includes(q)) return 500;

  return 0;
}

function rankAirportSuggestions(airports, queryStr) {
  if (!Array.isArray(airports)) return [];
  const qLower = (queryStr || '').trim().toLowerCase();

  const scored = airports.map(ap => ({
    airport: ap,
    score: scoreAirportMatch(ap, queryStr)
  })).filter(item => item.score > 0);

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const cityA = (a.airport.city || '').toLowerCase();
    const cityB = (b.airport.city || '').toLowerCase();
    if (cityA === qLower && cityB !== qLower) return -1;
    if (cityB === qLower && cityA !== qLower) return 1;

    return (a.airport.code || '').localeCompare(b.airport.code || '');
  });

  return scored.map(item => item.airport);
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

  // Sync display query with external value (e.g. string or airport object)
  useEffect(() => {
    if (value) {
      if (typeof value === 'object') {
        const text = value.city ? `${value.city} (${value.code})` : (value.name ? `${value.name} (${value.code})` : value.code);
        setQuery(text);
      } else {
        setQuery(String(value));
      }
    } else {
      setQuery('');
    }
  }, [value]);

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocalFallback = (searchVal) => {
    return rankAirportSuggestions(LOCAL_FALLBACK_AIRPORTS, searchVal);
  };


  // Fetch suggestions with debounce
  const fetchSuggestions = (searchVal) => {
    const trimmedVal = (searchVal || '').trim();
    if (!trimmedVal || trimmedVal.length < 2) {
      setSuggestions([]);
      setErrorMsg('');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    airportAPI.search(trimmedVal)
      .then(response => {
        if (response && response.success && Array.isArray(response.data)) {
          const list = response.data || [];
          const filtered = list.filter(item => item.code !== excludeCode);
          setSuggestions(rankAirportSuggestions(filtered, trimmedVal));
          setErrorMsg('');

        } else {
          // If API response is empty or unformatted, throw error to use local fallback
          throw new Error('API response invalid or empty');
        }
      })
      .catch(err => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to fetch airport suggestions from API, falling back locally:', err?.message || err);
        }
        
        // Use local fallback silently
        const localList = searchLocalFallback(trimmedVal);
        const filteredLocal = localList.filter(item => item.code !== excludeCode);
        setSuggestions(filteredLocal);

        if (filteredLocal.length === 0) {
          setErrorMsg('No matching airports found.');
        } else {
          setErrorMsg('');
        }
      })
      .finally(() => {
        setLoading(false);
        setActiveIndex(-1);
      });
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    
    // Check if input is a 3-letter IATA code directly typed by user
    const cleanVal = val.trim().toUpperCase();
    const directMatch = LOCAL_FALLBACK_AIRPORTS.find(a => a.code === cleanVal);
    
    if (directMatch) {
      onChange(val, directMatch);
    } else {
      // Pass raw text and temporary structured object with extracted code
      const codeMatch = val.match(/\(([A-Z]{3,4})\)/i);
      const extractedCode = codeMatch ? codeMatch[1].toUpperCase() : (cleanVal.length === 3 ? cleanVal : '');
      onChange(val, extractedCode ? { code: extractedCode, name: val, city: val.split('(')[0].trim() } : null);
    }

    setShowSuggestions(true);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 250);
  };

  const handleSelectSuggestion = (suggestion) => {
    const selectedText = `${suggestion.city} (${suggestion.code})`;
    setQuery(selectedText);
    onChange(selectedText, suggestion);
    setShowSuggestions(false);
    setErrorMsg('');
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setShowSuggestions(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % (suggestions.length || 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + (suggestions.length || 1)) % (suggestions.length || 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[activeIndex]);
        } else if (suggestions.length > 0) {
          handleSelectSuggestion(suggestions[0]);
        }
        break;
      case 'Tab':
        setShowSuggestions(false);
        break;
      default:
        break;
    }
  };

  // Helper to highlight matching characters
  const highlightMatch = (text, queryText) => {
    if (!text || !queryText) return text;
    const cleanQuery = queryText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const parts = text.split(new RegExp(`(${cleanQuery})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === queryText.toLowerCase() 
        ? <strong key={index} className="autocomplete-highlight">{part}</strong> 
        : part
    );
  };

  const hasSuggestions = suggestions.length > 0;
  const showEmptyMessage = showSuggestions && !loading && query.trim().length >= 2 && !hasSuggestions && !errorMsg;

  return (
    <div className="airport-autocomplete-container" ref={containerRef}>
      <label htmlFor={id} className="autocomplete-label">{label}</label>
      <div className="autocomplete-input-wrapper">
        <i className="fas fa-plane-departure input-icon"></i>
        <input
          type="text"
          id={id}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="autocomplete-input"
        />
        {loading && <i className="fas fa-circle-notch fa-spin input-loading-icon"></i>}
      </div>

      {showSuggestions && (hasSuggestions || showEmptyMessage || errorMsg) && (
        <ul className="autocomplete-suggestions-list" role="listbox">
          {errorMsg && (
            <li className="suggestion-error-banner">
              <i className="fas fa-exclamation-triangle"></i>
              <span>{errorMsg}</span>
            </li>
          )}
          
          {hasSuggestions ? (
            suggestions.map((item, idx) => {
              const isActive = idx === activeIndex;
              return (
                <li 
                  key={item.code} 
                  id={`${id}-suggestion-${idx}`}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelectSuggestion(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`suggestion-item ${isActive ? 'active' : ''}`}
                >
                  <div className="suggestion-icon">
                    <i className="fas fa-plane"></i>
                  </div>
                  <div className="suggestion-details">
                    <span className="suggestion-name">{highlightMatch(item.name, query)}</span>
                    <span className="suggestion-location">
                      <strong>{highlightMatch(item.code, query)}</strong> · {highlightMatch(item.city, query)}
                      {item.state ? `, ${highlightMatch(item.state, query)}` : ''} · {highlightMatch(item.country, query)}
                    </span>
                  </div>
                </li>
              );
            })
          ) : (
            showEmptyMessage && (
              <li className="suggestion-empty-item">
                <i className="fas fa-exclamation-circle empty-icon"></i>
                <span>No airports found</span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

export default AirportAutocomplete;
