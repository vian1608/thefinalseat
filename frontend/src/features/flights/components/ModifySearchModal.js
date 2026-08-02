import React, { useState, useEffect, useRef } from 'react';
import AirportAutocomplete, { formatAirportLabel } from './AirportAutocomplete';
import TravelDatePicker from './TravelDatePicker';
import './ModifySearchModal.css';

function extractIataCode(val) {
  if (!val) return '';
  if (typeof val === 'object') return (val.code || val.iata || '').toUpperCase();
  const str = String(val).toUpperCase();
  const match = str.match(/\b([A-Z]{3,4})\b/);
  return match ? match[1] : (str.length === 3 ? str : '');
}

function ModifySearchModal({
  isOpen,
  onClose,
  initialSearch = {},
  onUpdateSearch,
  isCheckoutPage = false
}) {
  const resolveOriginVal = (search) => {
    const rawVal = search.origin || search.from || search.departure_airport || search.selectedFlight?.departure?.airport || '';
    const code = extractIataCode(rawVal);
    if (typeof search.origin === 'object' && search.origin && search.origin.code) {
      const cleanCity = formatAirportLabel(search.origin).replace(/\s*\([A-Z]{3,4}\)/i, '').trim();
      return {
        code: (search.origin.code).toUpperCase(),
        city: cleanCity || search.origin.code,
        name: search.origin.name || cleanCity || search.origin.code
      };
    }
    if (code) {
      const cleanCity = formatAirportLabel(rawVal).replace(/\s*\([A-Z]{3,4}\)/i, '').trim();
      return { code, city: cleanCity || code, name: cleanCity || code };
    }
    return '';
  };

  const resolveDestVal = (search) => {
    const rawVal = search.destination || search.to || search.arrival_airport || search.selectedFlight?.arrival?.airport || '';
    const code = extractIataCode(rawVal);
    if (typeof search.destination === 'object' && search.destination && search.destination.code) {
      const cleanCity = formatAirportLabel(search.destination).replace(/\s*\([A-Z]{3,4}\)/i, '').trim();
      return {
        code: (search.destination.code).toUpperCase(),
        city: cleanCity || search.destination.code,
        name: search.destination.name || cleanCity || search.destination.code
      };
    }
    if (code) {
      const cleanCity = formatAirportLabel(rawVal).replace(/\s*\([A-Z]{3,4}\)/i, '').trim();
      return { code, city: cleanCity || code, name: cleanCity || code };
    }
    return '';
  };

  const [tripType, setTripType] = useState(initialSearch.tripType || (initialSearch.returnDate ? 'round-trip' : 'one-way'));
  const [origin, setOrigin] = useState(resolveOriginVal(initialSearch));
  const [destination, setDestination] = useState(resolveDestVal(initialSearch));
  const [departureDate, setDepartureDate] = useState(initialSearch.departureDate || initialSearch.departure || '');
  const [returnDate, setReturnDate] = useState(initialSearch.returnDate || initialSearch.return || '');
  const [adults, setAdults] = useState(parseInt(initialSearch.adults || 1, 10));
  const [children, setChildren] = useState(parseInt(initialSearch.children || 0, 10));
  const [infants, setInfants] = useState(parseInt(initialSearch.infants || 0, 10));
  const [cabinClass, setCabinClass] = useState(initialSearch.cabinClass || initialSearch.cabin || 'Economy');

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCheckoutWarning, setShowCheckoutWarning] = useState(false);

  const dialogRef = useRef(null);

  // Prevent background body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Sync state when modal opens or initialSearch changes
  useEffect(() => {
    if (isOpen) {
      const isRound = (initialSearch.tripType === 'round-trip') || !!(initialSearch.returnDate || initialSearch.return);
      setTripType(isRound ? 'round-trip' : 'one-way');
      setOrigin(resolveOriginVal(initialSearch));
      setDestination(resolveDestVal(initialSearch));
      setDepartureDate(initialSearch.departureDate || initialSearch.departure || '');
      setReturnDate(initialSearch.returnDate || initialSearch.return || '');
      setAdults(parseInt(initialSearch.adults || 1, 10));
      setChildren(parseInt(initialSearch.children || 0, 10));
      setInfants(parseInt(initialSearch.infants || 0, 10));
      setCabinClass(initialSearch.cabinClass || initialSearch.cabin || 'Economy');
      setFormError('');
      setIsSubmitting(false);
      setShowCheckoutWarning(false);
    }
  }, [isOpen, initialSearch]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSwapAirports = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const validateSearchForm = () => {
    setFormError('');
    if (!origin) {
      setFormError('Please select a valid origin airport.');
      return false;
    }
    if (!destination) {
      setFormError('Please select a valid destination airport.');
      return false;
    }

    const oCode = extractIataCode(origin);
    const dCode = extractIataCode(destination);

    if (oCode && dCode && oCode === dCode) {
      setFormError('Origin and destination airports cannot be the same.');
      return false;
    }
    if (!departureDate) {
      setFormError('Please select a departure date.');
      return false;
    }
    if (tripType === 'round-trip' && !returnDate) {
      setFormError('Please select a return date for round trip.');
      return false;
    }
    if (adults < 1) {
      setFormError('At least 1 adult passenger is required.');
      return false;
    }
    if (infants > adults) {
      setFormError('Infants cannot exceed the number of adult passengers.');
      return false;
    }
    return true;
  };

  const handleFormSubmit = (e) => {
    if (e) e.preventDefault();
    if (!validateSearchForm()) return;

    if (isCheckoutPage && !showCheckoutWarning) {
      setShowCheckoutWarning(true);
      return;
    }

    proceedWithUpdate();
  };

  const proceedWithUpdate = () => {
    setIsSubmitting(true);
    setFormError('');

    const updatedParams = {
      from: extractIataCode(origin) || (typeof origin === 'object' ? origin.code : origin),
      to: extractIataCode(destination) || (typeof destination === 'object' ? destination.code : destination),
      origin,
      destination,
      departureDate,
      departure: departureDate,
      returnDate: tripType === 'round-trip' ? returnDate : '',
      return: tripType === 'round-trip' ? returnDate : '',
      tripType,
      adults,
      children,
      infants,
      cabinClass,
      cabin: cabinClass
    };

    if (onUpdateSearch) {
      onUpdateSearch(updatedParams);
    }
  };

  return (
    <div className="modify-search-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modify-search-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="modify-search-title">
        
        {/* Fixed Header */}
        <div className="modify-search-dialog__header">
          <h2 id="modify-search-title">
            <i className="fas fa-edit"></i> Modify Flight Search
          </h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="modify-search-dialog__body">
          {showCheckoutWarning ? (
            <div className="checkout-warning-box">
              <div className="warning-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h3>Change Your Search?</h3>
              <p>
                Changing your search will remove the currently selected flights and reset checkout details. Continue?
              </p>
              <div className="warning-actions">
                <button
                  type="button"
                  className="btn-warn btn-warn--continue"
                  onClick={proceedWithUpdate}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating Search...' : 'Continue & Update Search'}
                </button>
                <button
                  type="button"
                  className="btn-warn btn-warn--stay"
                  onClick={() => setShowCheckoutWarning(false)}
                >
                  Stay on This Page
                </button>
              </div>
            </div>
          ) : (
            <form id="modify-search-form" onSubmit={handleFormSubmit} className="modify-search-form">
              
              {formError && (
                <div className="modify-search-error">
                  <i className="fas fa-exclamation-circle"></i> {formError}
                </div>
              )}

              {/* Trip Type Selector */}
              <div className="form-group-trip-type">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="modalTripType"
                    value="round-trip"
                    checked={tripType === 'round-trip'}
                    onChange={() => setTripType('round-trip')}
                  />
                  <span>Round Trip</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="modalTripType"
                    value="one-way"
                    checked={tripType === 'one-way'}
                    onChange={() => setTripType('one-way')}
                  />
                  <span>One Way</span>
                </label>
              </div>

              {/* Airports Route Row */}
              <div className="modify-search-route">
                <div className="form-col">
                  <AirportAutocomplete
                    label="From"
                    id="modal-origin-airport"
                    value={origin}
                    onChange={(obj) => setOrigin(obj)}
                    placeholder="City or Airport Code"
                  />
                </div>

                <button
                  type="button"
                  className="swap-airports-button"
                  onClick={handleSwapAirports}
                  title="Swap Origin and Destination Airports"
                  aria-label="Swap Origin and Destination Airports"
                >
                  <i className="fas fa-exchange-alt"></i>
                </button>

                <div className="form-col">
                  <AirportAutocomplete
                    label="To"
                    id="modal-destination-airport"
                    value={destination}
                    onChange={(obj) => setDestination(obj)}
                    placeholder="City or Airport Code"
                  />
                </div>
              </div>

              {/* Dates Row */}
              <div className="form-row-dates" style={{ marginTop: '1.25rem' }}>
                <div className="form-col">
                  <label className="form-label-title">Departure Date</label>
                  <TravelDatePicker
                    value={departureDate}
                    onChange={setDepartureDate}
                    placeholder="Select Date"
                    minDate={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {tripType === 'round-trip' && (
                  <div className="form-col">
                    <label className="form-label-title">Return Date</label>
                    <TravelDatePicker
                      value={returnDate}
                      onChange={setReturnDate}
                      placeholder="Select Date"
                      minDate={departureDate || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                )}
              </div>

              {/* Passengers & Cabin Row */}
              <div className="form-row-passengers" style={{ marginTop: '1.25rem' }}>
                <div className="form-col">
                  <label className="form-label-title">Adults (12+)</label>
                  <div className="counter-controls">
                    <button
                      type="button"
                      onClick={() => setAdults(Math.max(1, adults - 1))}
                      disabled={adults <= 1}
                    >
                      -
                    </button>
                    <span>{adults}</span>
                    <button
                      type="button"
                      onClick={() => setAdults(Math.min(9, adults + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="form-col">
                  <label className="form-label-title">Children (2-11)</label>
                  <div className="counter-controls">
                    <button
                      type="button"
                      onClick={() => setChildren(Math.max(0, children - 1))}
                      disabled={children <= 0}
                    >
                      -
                    </button>
                    <span>{children}</span>
                    <button
                      type="button"
                      onClick={() => setChildren(Math.min(8, children + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="form-col">
                  <label className="form-label-title">Infants (&lt;2)</label>
                  <div className="counter-controls">
                    <button
                      type="button"
                      onClick={() => setInfants(Math.max(0, infants - 1))}
                      disabled={infants <= 0}
                    >
                      -
                    </button>
                    <span>{infants}</span>
                    <button
                      type="button"
                      onClick={() => setInfants(Math.min(adults, infants + 1))}
                      disabled={infants >= adults}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="form-col">
                  <label className="form-label-title">Cabin Class</label>
                  <select
                    value={cabinClass}
                    onChange={(e) => setCabinClass(e.target.value)}
                    className="cabin-select"
                  >
                    <option value="Economy">Economy</option>
                    <option value="Premium Economy">Premium Economy</option>
                    <option value="Business">Business</option>
                    <option value="First">First Class</option>
                  </select>
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="modify-search-dialog__footer">
          <button
            type="button"
            className="btn-cancel-search"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-update-search"
            onClick={handleFormSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-circle-notch fa-spin"></i> Updating...
              </>
            ) : (
              <>
                <i className="fas fa-search"></i> Update Search
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

export default ModifySearchModal;
