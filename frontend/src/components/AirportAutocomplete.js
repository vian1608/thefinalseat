import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './AirportAutocomplete.css';

function AirportAutocomplete({ label, id, value, onChange, placeholder, required = false }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const debounceTimer = useRef(null);

  // Sync display query with external value (e.g., if set from parent or sessionStorage)
  useEffect(() => {
    if (value) {
      setQuery(value);
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

  // Fetch suggestions with debounce
  const fetchSuggestions = (searchVal) => {
    if (!searchVal || searchVal.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    const backendUrl = process.env.REACT_APP_API_URL || '';
    
    axios.get(`${backendUrl}/api/airports/search`, { params: { q: searchVal } })
      .then(response => {
        if (response.data && response.data.success) {
          setSuggestions(response.data.data || []);
        }
      })
      .catch(err => {
        console.error('Failed to fetch airport suggestions:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val); // Update parent state immediately so required validation works
    setShowSuggestions(true);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  const handleSelectSuggestion = (suggestion) => {
    const selectedText = `${suggestion.city} (${suggestion.code})`;
    setQuery(selectedText);
    onChange(selectedText);
    setShowSuggestions(false);
  };

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
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="autocomplete-input"
        />
        {loading && <i className="fas fa-circle-notch fa-spin input-loading-icon"></i>}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="autocomplete-suggestions-list">
          {suggestions.map((item, idx) => (
            <li 
              key={item.code || idx} 
              onClick={() => handleSelectSuggestion(item)}
              className="suggestion-item"
            >
              <div className="suggestion-icon">
                <i className="fas fa-plane"></i>
              </div>
              <div className="suggestion-details">
                <span className="suggestion-code">{item.code}</span>
                <span className="suggestion-name">{item.name}</span>
                <span className="suggestion-location">{item.city}{item.country ? `, ${item.country}` : ''}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AirportAutocomplete;
