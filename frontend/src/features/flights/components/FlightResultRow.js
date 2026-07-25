import React, { useState, useEffect } from 'react';
import './FlightResultRow.css';

// Helper to get initials for fallback logo
function getInitials(name) {
  if (!name) return 'FL';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// AirlineLogo Component with Safe Fallbacks
export function AirlineLogo({ logoUrl, name }) {
  const [error, setError] = useState(!logoUrl);

  useEffect(() => {
    setError(!logoUrl);
  }, [logoUrl]);

  if (error) {
    return (
      <div className="carrier-logo-fallback" title={name}>
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img 
      src={logoUrl} 
      alt={name} 
      className="carrier-logo"
      onError={() => setError(true)}
    />
  );
}

// Safe data normalization for cards rendering
export function normalizeFlight(flight, idx) {
  if (!flight) return null;
  const isMock = !!flight.isMock;
  const rawTotal = parseFloat(flight.price?.total || flight.price?.finalPrice || 0);
  const rawOriginal = parseFloat(flight.price?.originalApiPrice || flight.price?.original || rawTotal);
  
  const discountPercent = isMock ? 0 : (typeof flight.price?.discountPercent === 'number' ? flight.price.discountPercent : 10);
  const discountAmountNum = isMock ? 0 : (parseFloat(flight.price?.discountAmount || (rawOriginal - rawTotal)));

  return {
    id: flight.id || `normalized-flight-${idx}-${Math.random()}`,
    isMock,
    airline: flight.airline || 'Unknown Airline',
    airline_logo: flight.airline_logo || '',
    flightNumber: flight.flightNumber || 'N/A',
    price: {
      total: rawTotal,
      finalPrice: rawTotal.toFixed(2),
      originalApiPrice: rawOriginal.toFixed(2),
      discountPercent,
      discountAmount: discountAmountNum > 0 ? discountAmountNum.toFixed(2) : '0.00',
      currency: flight.price?.currency || 'USD',
      formatted: `$${rawTotal.toFixed(2)}`,
      formattedOriginal: `$${rawOriginal.toFixed(2)}`,
      formattedDiscount: `$${discountAmountNum.toFixed(2)}`
    },
    departure: {
      airport: flight.departure?.airport || 'N/A',
      city: flight.departure?.city || 'Origin',
      time: flight.departure?.time || 'N/A',
      date: flight.departure?.date || 'N/A'
    },
    arrival: {
      airport: flight.arrival?.airport || 'N/A',
      city: flight.arrival?.city || 'Destination',
      time: flight.arrival?.time || 'N/A',
      date: flight.arrival?.date || 'N/A'
    },
    duration: flight.duration || 'N/A',
    stops: typeof flight.stops === 'number' ? flight.stops : 0,
    class: flight.class || 'Economy',
    aircraft: flight.aircraft || '',
    layovers: Array.isArray(flight.layovers) ? flight.layovers : [],
    isTrain: !!flight.isTrain,
    refundableStatus: flight.refundableStatus || (isMock ? 'Unavailable Online / Call Desk' : 'Non-Refundable'),
    baggageAllowance: flight.baggageAllowance || 'Standard Baggage Rules Apply',
    segments: flight.segments || []
  };
}

// Helper to parse or generate segments for the timeline
export function getFlightSegments(flight) {
  if (!flight) return [];
  
  if (Array.isArray(flight.segments) && flight.segments.length > 0) {
    return flight.segments.map((seg, sIdx) => ({
      from: seg.departure?.airport || flight.departure.airport,
      fromCity: seg.departure?.city || (sIdx === 0 ? flight.departure.city : ''),
      fromTime: seg.departure?.time || 'N/A',
      fromDate: seg.departure?.date || flight.departure.date,
      to: seg.arrival?.airport || flight.arrival.airport,
      toCity: seg.arrival?.city || (sIdx === flight.segments.length - 1 ? flight.arrival.city : ''),
      toTime: seg.arrival?.time || 'N/A',
      toDate: seg.arrival?.date || flight.arrival.date,
      duration: seg.duration || flight.duration,
      airline: seg.airline || flight.airline,
      flightNumber: seg.flightNumber || flight.flightNumber,
      class: seg.class || flight.class,
      aircraft: seg.aircraft || flight.aircraft,
      layoverAfter: seg.layoverAfter || null
    }));
  }

  if (flight.stops === 0 || !flight.layovers || flight.layovers.length === 0) {
    return [{
      from: flight.departure.airport,
      fromCity: flight.departure.city,
      fromTime: flight.departure.time,
      fromDate: flight.departure.date,
      to: flight.arrival.airport,
      toCity: flight.arrival.city,
      toTime: flight.arrival.time,
      toDate: flight.arrival.date,
      duration: flight.duration,
      airline: flight.airline,
      flightNumber: flight.flightNumber,
      class: flight.class,
      aircraft: flight.aircraft,
      layoverAfter: null
    }];
  }

  const generatedSegments = [];
  const totalStops = flight.layovers.length;

  flight.layovers.forEach((layover, lIdx) => {
    const isFirst = lIdx === 0;
    const isLast = lIdx === totalStops - 1;

    generatedSegments.push({
      from: isFirst ? flight.departure.airport : flight.layovers[lIdx - 1].airportCode,
      fromCity: isFirst ? flight.departure.city : flight.layovers[lIdx - 1].airportName,
      fromTime: isFirst ? flight.departure.time : '12:00',
      fromDate: flight.departure.date,
      to: layover.airportCode,
      toCity: layover.airportName,
      toTime: '11:15',
      toDate: flight.departure.date,
      duration: '2h 10m',
      airline: flight.airline,
      flightNumber: `${flight.flightNumber.split(',')[0] || flight.flightNumber}`,
      class: flight.class,
      aircraft: flight.aircraft,
      layoverAfter: {
        airport: layover.airportCode,
        name: layover.airportName,
        duration: typeof layover.duration === 'number' ? `${Math.floor(layover.duration / 60)}h ${layover.duration % 60}m` : (layover.duration || '1h 30m'),
        durationMinutes: typeof layover.duration === 'number' ? layover.duration : 90
      }
    });

    if (isLast) {
      generatedSegments.push({
        from: layover.airportCode,
        fromCity: layover.airportName,
        fromTime: '13:45',
        fromDate: flight.departure.date,
        to: flight.arrival.airport,
        toCity: flight.arrival.city,
        toTime: flight.arrival.time,
        toDate: flight.arrival.date,
        duration: '2h 45m',
        airline: flight.airline,
        flightNumber: `${flight.flightNumber.split(',')[1] || flight.flightNumber}`,
        class: flight.class,
        aircraft: flight.aircraft,
        layoverAfter: null
      });
    }
  });

  return generatedSegments;
}

export function FlightResultRow({ 
  flight: rawFlight, 
  isExpanded = false, 
  onToggleExpand, 
  onSelect,
  actionLabel = 'Book Now',
  travelersCount = 1,
  index = 0
}) {
  const flight = normalizeFlight(rawFlight, index);
  if (!flight) return null;

  const isRail = flight.isTrain;
  const segments = getFlightSegments(flight);

  let stopsText = 'Nonstop';
  if (flight.stops === 1) {
    const code = flight.layovers?.[0]?.airportCode || '1 Stop';
    stopsText = `1 stop (${code})`;
  } else if (flight.stops > 1) {
    const layoverCodes = flight.layovers?.map(l => l.airportCode).filter(Boolean).join(', ') || `${flight.stops} Stops`;
    stopsText = `${flight.stops} stops · ${layoverCodes}`;
  }

  const isTightConnection = flight.layovers?.some(l => l.duration < 45);

  return (
    <div className={`flight-row-card ${isExpanded ? 'expanded' : ''} ${isRail ? 'flight-row-card--rail' : ''}`}>
      {/* Collapsed Header summary row */}
      <div 
        className="flight-row-header-summary" 
        onClick={onToggleExpand}
        role="button"
        aria-expanded={isExpanded}
        aria-controls={`details-${flight.id}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        {/* 1. Logo & Carrier */}
        <div className="col-carrier">
          <AirlineLogo logoUrl={flight.airline_logo} name={flight.airline} />
          <div className="carrier-info-text">
            <span className="carrier-name">{flight.airline}</span>
            <span className="carrier-flight-number-sub">{flight.flightNumber}</span>
          </div>
        </div>

        {/* 2. Times & Airport Codes */}
        <div className="col-times">
          <span className="route-times">{flight.departure.time} – {flight.arrival.time}</span>
          <span className="route-airports-codes">
            <span>{flight.departure.airport}</span>
            <span className="route-date-sub">{flight.departure.date}</span>
            <span> – </span>
            <span>{flight.arrival.airport}</span>
            <span className="route-date-sub">{flight.arrival.date}</span>
          </span>
        </div>

        {/* 3. Duration */}
        <div className="col-duration">
          <span className="journey-duration">{flight.duration}</span>
          <span className="secondary-label">{flight.departure.city} to {flight.arrival.city}</span>
        </div>

        {/* 4. Stops & Layover summary */}
        <div className="col-stops">
          <span className={`stops-count-label ${flight.stops > 0 ? 'has-stops' : 'nonstop'} ${isTightConnection ? 'warning-text' : ''}`}>
            {stopsText}
          </span>
        </div>

        {/* 5. Class */}
        <div className="col-class">
          <span className="cabin-class-badge">{flight.class}</span>
        </div>

        {/* 6. Price & Chevron toggle */}
        <div className="col-price-action">
          <div className="fare-price-col">
            {!flight.isMock && parseFloat(flight.price.discountAmount) > 0 ? (
              <>
                {/* Original supplier price — crossed out */}
                <span className="original-supplier-fare">
                  ${flight.price.originalApiPrice}
                </span>
                {/* Discounted Final Seat price — prominent */}
                <span className="final-fare-price">
                  ${flight.price.finalPrice}
                </span>
                {/* Chip row: 10% OFF pill + savings text */}
                <div className="fare-savings-row">
                  <span className="discount-promo-chip">
                    <i className="fas fa-tag" style={{ fontSize: '0.55rem' }}></i>
                    10% OFF
                  </span>
                  <span className="savings-label">You save ${flight.price.discountAmount}</span>
                </div>
              </>
            ) : (
              <>
                <span className="final-fare-price">
                  ${flight.price.finalPrice}
                </span>
                <span className="mock-fare-badge">
                  {flight.isMock ? 'Offline / Call Desk' : 'Web Fare Only'}
                </span>
              </>
            )}
          </div>
          <button 
            type="button" 
            className="mobile-select-btn" 
            onClick={(e) => {
              e.stopPropagation();
              onSelect(flight);
            }}
          >
            Select
          </button>
          <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} row-expand-chevron`}></i>
        </div>
      </div>

      {/* Expandable Dropdown Section */}
      {isExpanded && (
        <div id={`details-${flight.id}`} className="flight-row-expanded-details animate-slide-down">
          <div className="expanded-details-grid">
            {/* Timeline layout */}
            <div className="itinerary-timeline-column">
              <div className="vertical-timeline-container">
                {segments.map((segment, segIdx) => {
                  const isConnectionTight = segment.layoverAfter && segment.layoverAfter.durationMinutes < 45;
                  return (
                    <React.Fragment key={segIdx}>
                      <div className="timeline-node start">
                        <div className="timeline-dot"></div>
                        <div className="timeline-time-airport">
                          <strong className="timeline-time">{segment.fromTime}</strong>
                          <span className="timeline-airport-name">
                            · {segment.fromCity} ({segment.from}) · {segment.fromDate}
                          </span>
                        </div>
                      </div>

                      <div className="timeline-segment-travel">
                        <div className="timeline-connecting-bar"></div>
                        <div className="timeline-segment-info-grid">
                          <div className="segment-carrier-detail">
                            <i className={`fas ${isRail ? 'fa-subway' : 'fa-plane'} segment-type-icon`}></i>
                            <span>Travel time: {segment.duration} · {segment.airline} · {segment.flightNumber}</span>
                          </div>
                          <div className="segment-aircraft-class">
                            <span>Class: {segment.class} · Aircraft: {segment.aircraft}</span>
                          </div>
                        </div>
                      </div>

                      <div className="timeline-node end">
                        <div className="timeline-dot"></div>
                        <div className="timeline-time-airport">
                          <strong className="timeline-time">{segment.toTime}</strong>
                          <span className="timeline-airport-name">
                            · {segment.toCity} ({segment.to}) · {segment.toDate}
                          </span>
                        </div>
                      </div>

                      {segment.layoverAfter && (
                        <div className={`timeline-connection-row ${isConnectionTight ? 'tight-warning' : ''}`}>
                          <div className="timeline-connecting-bar dashed"></div>
                          <div className="connection-details-box">
                            <i className="fas fa-clock connection-clock-icon"></i>
                            <span>
                              {segment.layoverAfter.duration} connection in {segment.layoverAfter.name} ({segment.layoverAfter.airport})
                              {isConnectionTight && ' (Tight Connection Alert)'}
                            </span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Selection & Fare details Column */}
            <div className="expanded-fare-restrictions-column">
              <div className="fare-details-card">
                <h4>Fare and Booking Details</h4>
                
                <div className="fare-amenities-list">
                  <div className="amenity-item">
                    <i className="fas fa-suitcase-rolling amenity-icon"></i>
                    <div>
                      <h5>Baggage Allowance</h5>
                      <p>{flight.baggageAllowance}</p>
                    </div>
                  </div>
                  <div className="amenity-item">
                    <i className="fas fa-undo-alt amenity-icon"></i>
                    <div>
                      <h5>Refundability</h5>
                      <p>{flight.refundableStatus}</p>
                    </div>
                  </div>
                  <div className="amenity-item">
                    <i className="fas fa-percentage amenity-icon" style={{ color: '#047857' }}></i>
                    <div>
                      <h5>Direct Final Seat Subsidy</h5>
                      <p>{flight.isMock ? 'Offline route (0% discount applicable)' : '10% instant airfare discount applied directly to your booking.'}</p>
                    </div>
                  </div>
                </div>

                {/* Premium fare breakdown card */}
                {!flight.isMock && parseFloat(flight.price.discountAmount) > 0 ? (
                  <div className="fare-breakdown-premium">
                    {/* Chip header */}
                    <div className="fare-breakdown-premium__chip-row">
                      <span className="discount-promo-chip">
                        <i className="fas fa-tag" style={{ fontSize: '0.55rem' }}></i>
                        10% OFF
                      </span>
                      <span className="fare-breakdown-premium__label">Final Seat Exclusive Discount</span>
                    </div>
                    {/* Supplier crossed-out */}
                    <div className="fare-breakdown-premium__row">
                      <span>Supplier Airfare ({travelersCount} traveler{travelersCount > 1 ? 's' : ''})</span>
                      <span className="original-supplier-fare">${flight.price.originalApiPrice}</span>
                    </div>
                    {/* Discount saving */}
                    <div className="fare-breakdown-premium__row fare-breakdown-premium__row--discount">
                      <span>Final Seat Subsidy (10% OFF)</span>
                      <span>−${flight.price.discountAmount}</span>
                    </div>
                    {/* Total */}
                    <div className="fare-breakdown-premium__row fare-breakdown-premium__row--total">
                      <span>Total Customer Price</span>
                      <span>${flight.price.finalPrice}</span>
                    </div>
                  </div>
                ) : (
                  <div className="fare-breakdown-premium">
                    <div className="fare-breakdown-premium__row fare-breakdown-premium__row--total">
                      <span>Total Price ({travelersCount} traveler{travelersCount > 1 ? 's' : ''})</span>
                      <span>${flight.price.finalPrice}</span>
                    </div>
                  </div>
                )}

                <button 
                  type="button" 
                  className="expanded-select-flight-btn"
                  onClick={() => onSelect(flight)}
                >
                  {actionLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlightResultRow;
