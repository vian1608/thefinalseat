import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './AddressAutocompleteInput.css';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

function AddressAutocompleteInput({
  id = 'billingAddress',
  value = '',
  onChange,
  onSelectSuggestion,
  placeholder = 'e.g. 123 Main Street',
  required = false,
  disabled = false,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [manualMode, setManualMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 3 || manualMode) {
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // Primary: backend proxy endpoint
      const res = await axios.get(`${API_BASE}/address-autocomplete`, {
        params: { q: query.trim() },
        timeout: 4000,
      });

      if (res.data?.success && Array.isArray(res.data.suggestions)) {
        setSuggestions(res.data.suggestions.slice(0, 5));
        setIsOpen(res.data.suggestions.length > 0);
        setActiveIdx(-1);
      } else {
        setSuggestions([]);
        setIsOpen(false);
      }
    } catch (err) {
      console.warn('[Address Autocomplete API Proxy Failed, trying fallback...]:', err.message);
      // Fallback: direct call to Photon OSM geocoder if backend is offline/error
      try {
        const fallbackRes = await axios.get('https://photon.komoot.io/api/', {
          params: { q: query.trim(), limit: 5, lang: 'en' },
          timeout: 4000,
        });

        const features = fallbackRes.data?.features || [];
        const mapped = features.map((feat) => {
          const props = feat.properties || {};
          const house = props.housenumber || '';
          const street = props.street || props.name || '';
          const line1 = [house, street].filter(Boolean).join(' ') || props.name || query;
          const city = props.city || props.town || props.village || props.county || '';
          const state = props.state || props.state_code || '';
          const postalCode = props.postcode || '';
          const country = props.country || '';
          const formatted = [line1, city, state, postalCode, country].filter(Boolean).join(', ');
          return { addressLine1: line1, addressLine2: '', city, state, postalCode, country, formatted };
        });

        setSuggestions(mapped);
        setIsOpen(mapped.length > 0);
        setActiveIdx(-1);
      } catch (fallbackErr) {
        setSuggestions([]);
        setIsOpen(false);
        setErrorMsg('Address suggestions are temporarily unavailable. Please enter your address manually.');
      }
    } finally {
      setLoading(false);
    }
  }, [manualMode]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length >= 3 && !manualMode) {
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(val);
      }, 300); // 300ms debounce
    } else {
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
    }
  };

  const handleSelect = (item) => {
    if (onSelectSuggestion) {
      onSelectSuggestion(item);
    } else {
      onChange(item.addressLine1);
    }
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const toggleManualMode = () => {
    setManualMode((prev) => !prev);
    setIsOpen(false);
    setSuggestions([]);
    setErrorMsg('');
  };

  return (
    <div className="address-autocomplete-container" ref={containerRef}>
      <div className="address-input-wrapper" style={{ position: 'relative' }}>
        <input
          type="text"
          id={id}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && !manualMode) setIsOpen(true);
          }}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id}-suggestions`}
          aria-activedescendant={activeIdx >= 0 ? `${id}-opt-${activeIdx}` : undefined}
          className="address-autocomplete-input"
        />

        {loading && (
          <span className="address-loading-spinner" aria-label="Loading address suggestions">
            <i className="fas fa-circle-notch fa-spin"></i>
          </span>
        )}
      </div>

      {/* Manual Entry Toggle & Error Bar */}
      <div className="address-autocomplete-controls">
        <button
          type="button"
          onClick={toggleManualMode}
          className="btn-manual-toggle"
          aria-pressed={manualMode}
        >
          <i className={manualMode ? 'fas fa-magic' : 'fas fa-pen'}></i>{' '}
          {manualMode ? 'Enable address suggestions' : 'Enter address manually'}
        </button>
      </div>

      {errorMsg && (
        <p className="address-fallback-warning" role="alert">
          <i className="fas fa-exclamation-triangle"></i> {errorMsg}
        </p>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          id={`${id}-suggestions`}
          className="address-suggestions-dropdown"
          role="listbox"
          aria-label="Address recommendations"
        >
          {suggestions.map((item, idx) => (
            <li
              key={`${item.formatted}-${idx}`}
              id={`${id}-opt-${idx}`}
              role="option"
              aria-selected={activeIdx === idx}
              className={`suggestion-item ${activeIdx === idx ? 'suggestion-item--active' : ''}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <i className="fas fa-map-marker-alt suggestion-icon" aria-hidden="true"></i>
              <div className="suggestion-text-block">
                <span className="suggestion-line1">{item.addressLine1}</span>
                <span className="suggestion-details">{item.formatted}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AddressAutocompleteInput;
