from pathlib import Path

home_path = Path('frontend/src/features/flights/pages/Home.js')
css_path = Path('frontend/src/features/flights/pages/Home.css')
home = home_path.read_text()
css = css_path.read_text()

function_anchor = """  const handleSearchChange = (field, value) => {
    setSearchData((prev) => ({ ...prev, [field]: value }));
  };
"""
function_insert = function_anchor + """

  const handleSwapSearchAirports = () => {
    setSearchData((prev) => ({
      ...prev,
      from: prev.to || '',
      to: prev.from || '',
      fromAirport: prev.toAirport || null,
      toAirport: prev.fromAirport || null,
    }));
    setSubmitStatus('idle');
    setSubmitMessage('');
  };

  const handleSwapInquiryAirports = () => {
    setFormData((prev) => ({
      ...prev,
      origin: prev.destination || '',
      destination: prev.origin || '',
    }));
    setFieldErrors((prev) => ({ ...prev, origin: undefined, destination: undefined }));
  };
"""
if 'const handleSwapSearchAirports' not in home:
    if function_anchor not in home:
        raise SystemExit('handleSearchChange anchor not found')
    home = home.replace(function_anchor, function_insert, 1)

old_search = """                      {/* Airport Autocomplete Row */}
                      <div className=\"flights-form__row\" style={{ gap: '1.25rem' }}>
                        <div className=\"flights-form__group\" style={{ margin: 0 }}>
                          <AirportAutocomplete 
                            label=\"Origin Airport\"
                            id=\"search-origin\"
                            value={searchData.from}
                            excludeCode={searchData.toAirport?.code}
                            onChange={(val, item) => {
                              handleSearchChange('from', val);
                              handleSearchChange('fromAirport', item);
                            }}
                            placeholder=\"e.g. New York (JFK)\"
                            required
                          />
                        </div>
                        <div className=\"flights-form__group\" style={{ margin: 0 }}>
                          <AirportAutocomplete 
                            label=\"Destination Airport\"
                            id=\"search-destination\"
                            value={searchData.to}
                            excludeCode={searchData.fromAirport?.code}
                            onChange={(val, item) => {
                              handleSearchChange('to', val);
                              handleSearchChange('toAirport', item);
                            }}
                            placeholder=\"e.g. Los Angeles (LAX)\"
                            required
                          />
                        </div>
                      </div>
"""
new_search = """                      {/* Airport Autocomplete Row */}
                      <div className=\"airport-swap-row\">
                        <div className=\"flights-form__group\" style={{ margin: 0 }}>
                          <AirportAutocomplete 
                            label=\"Origin Airport\"
                            id=\"search-origin\"
                            value={searchData.from}
                            excludeCode={searchData.toAirport?.code}
                            onChange={(val, item) => {
                              handleSearchChange('from', val);
                              handleSearchChange('fromAirport', item);
                            }}
                            placeholder=\"e.g. New York (JFK)\"
                            required
                          />
                        </div>
                        <button
                          type=\"button\"
                          className=\"airport-swap-button\"
                          onClick={handleSwapSearchAirports}
                          disabled={!searchData.from && !searchData.to}
                          aria-label=\"Swap origin and destination airports\"
                          title=\"Swap origin and destination\"
                        >
                          <i className=\"fas fa-exchange-alt\" aria-hidden=\"true\"></i>
                        </button>
                        <div className=\"flights-form__group\" style={{ margin: 0 }}>
                          <AirportAutocomplete 
                            label=\"Destination Airport\"
                            id=\"search-destination\"
                            value={searchData.to}
                            excludeCode={searchData.fromAirport?.code}
                            onChange={(val, item) => {
                              handleSearchChange('to', val);
                              handleSearchChange('toAirport', item);
                            }}
                            placeholder=\"e.g. Los Angeles (LAX)\"
                            required
                          />
                        </div>
                      </div>
"""
if 'onClick={handleSwapSearchAirports}' not in home:
    if old_search not in home:
        raise SystemExit('search airport row anchor not found')
    home = home.replace(old_search, new_search, 1)

old_inquiry = """                      <div className=\"flights-form__row\">
                        <div className=\"flights-form__group\">
                          <InquiryLocationSelect
                            id=\"flight-origin\"
                            label=\"Origin airport\"
                            value={formData.origin}
                            onChange={(value) => handleChange('origin', value)}
                            groups={flightAirportSelectGroups}
                            placeholder=\"Select origin airport\"
                            required
                          />
                        </div>
                        <div className=\"flights-form__group\">
                          <InquiryLocationSelect
                            id=\"flight-destination\"
                            label=\"Destination airport\"
                            value={formData.destination}
                            onChange={(value) => handleChange('destination', value)}
                            groups={flightAirportSelectGroups}
                            placeholder=\"Select destination airport\"
                            required
                          />
                        </div>
                      </div>
"""
new_inquiry = """                      <div className=\"airport-swap-row airport-swap-row--inquiry\">
                        <div className=\"flights-form__group\">
                          <InquiryLocationSelect
                            id=\"flight-origin\"
                            label=\"Origin airport\"
                            value={formData.origin}
                            onChange={(value) => handleChange('origin', value)}
                            groups={flightAirportSelectGroups}
                            placeholder=\"Select origin airport\"
                            required
                          />
                        </div>
                        <button
                          type=\"button\"
                          className=\"airport-swap-button\"
                          onClick={handleSwapInquiryAirports}
                          disabled={!formData.origin && !formData.destination}
                          aria-label=\"Swap origin and destination airports\"
                          title=\"Swap origin and destination\"
                        >
                          <i className=\"fas fa-exchange-alt\" aria-hidden=\"true\"></i>
                        </button>
                        <div className=\"flights-form__group\">
                          <InquiryLocationSelect
                            id=\"flight-destination\"
                            label=\"Destination airport\"
                            value={formData.destination}
                            onChange={(value) => handleChange('destination', value)}
                            groups={flightAirportSelectGroups}
                            placeholder=\"Select destination airport\"
                            required
                          />
                        </div>
                      </div>
"""
if 'onClick={handleSwapInquiryAirports}' not in home:
    if old_inquiry not in home:
        raise SystemExit('inquiry airport row anchor not found')
    home = home.replace(old_inquiry, new_inquiry, 1)

css_marker = '/* Airport origin/destination swap control */'
if css_marker not in css:
    css += """

/* Airport origin/destination swap control */
.airport-swap-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px minmax(0, 1fr);
  gap: 0.7rem;
  align-items: center;
  width: 100%;
}

.airport-swap-row .flights-form__group {
  min-width: 0;
}

.airport-swap-button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #8b1538;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  align-self: center;
  margin-top: 1.55rem;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.10);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease;
  z-index: 2;
}

.airport-swap-button i {
  font-size: 1rem;
  margin: 0;
  transition: transform 0.22s ease;
}

.airport-swap-button:hover:not(:disabled),
.airport-swap-button:focus-visible:not(:disabled) {
  border-color: #8b1538;
  background: #fff8fa;
  box-shadow: 0 6px 16px rgba(139, 21, 56, 0.18);
  outline: none;
}

.airport-swap-button:hover:not(:disabled) i {
  transform: rotate(180deg);
}

.airport-swap-button:active:not(:disabled) {
  transform: scale(0.96);
}

.airport-swap-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.airport-swap-row--inquiry .airport-swap-button {
  margin-top: 0.4rem;
}

@media (max-width: 768px) {
  .airport-swap-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.45rem;
  }

  .airport-swap-button,
  .airport-swap-row--inquiry .airport-swap-button {
    margin: -0.05rem auto;
    transform: rotate(90deg);
  }

  .airport-swap-button:active:not(:disabled) {
    transform: rotate(90deg) scale(0.96);
  }
}
"""

home_path.write_text(home)
css_path.write_text(css)
