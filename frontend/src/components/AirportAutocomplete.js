import React, { useState, useEffect, useRef } from 'react';
import { airportAPI } from '../services/api';
import './AirportAutocomplete.css';

function AirportAutocomplete({ label, id, value, onChange, placeholder, excludeCode, required = false }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const debounceTimer = useRef(null);

  // Sync display query with external value (e.g. from parent/sessionStorage)
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
    airportAPI.search(searchVal)
      .then(response => {
        if (response && response.success) {
          const list = response.data || [];
          // Filter out excluded code
          const filtered = list.filter(item => item.code !== excludeCode);
          setSuggestions(filtered);
        }
      })
      .catch(err => {
        console.error('Failed to fetch airport suggestions:', err);
      })
      .finally(() => {
        setLoading(false);
        setActiveIndex(-1);
      });
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val, null); // Clear parent object representation until fully selected
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
    onChange(selectedText, suggestion);
    setShowSuggestions(false);
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
          // If activeIndex is -1, enter selects the first result
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
    // Clean query text for regex compatibility
    const cleanQuery = queryText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const parts = text.split(new RegExp(`(${cleanQuery})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === queryText.toLowerCase() 
        ? <strong key={index} className="autocomplete-highlight">{part}</strong> 
        : part
    );
  };

  const hasSuggestions = suggestions.length > 0;
  const showEmptyMessage = showSuggestions && !loading && query.length >= 2 && !hasSuggestions;

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

      {showSuggestions && (hasSuggestions || showEmptyMessage) && (
        <ul className="autocomplete-suggestions-list" role="listbox">
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
            <li className="suggestion-empty-item">
              <i className="fas fa-exclamation-circle empty-icon"></i>
              <span>No airports found</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default AirportAutocomplete;
