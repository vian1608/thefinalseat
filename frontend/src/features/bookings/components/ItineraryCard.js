import React, { useState } from 'react';
import ItineraryTimeline from '../../../shared/components/ItineraryTimeline';
import './ItineraryCard.css';

// Inline logo with fallback
function CardAirlineLogo({ logoUrl, name }) {
  const [err, setErr] = useState(!logoUrl);

  if (err || !logoUrl) {
    const initials = name
      ? name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
      : 'FL';
    return <div className="itin-logo-fallback" title={name}>{initials}</div>;
  }
  return <img src={logoUrl} alt={name} className="itin-logo" onError={() => setErr(true)} />;
}

function ItineraryCard({ flight, label, labelColor, isTrain }) {
  const [expanded, setExpanded] = useState(false);

  if (!flight) return null;

  const airline = flight.airline || flight.carrier_name || 'Airline';
  const flightNum = flight.flightNumber || flight.flight_number || '';
  const depTime = flight.departure?.time || '--:--';
  const arrTime = flight.arrival?.time || '--:--';
  const depAirport = flight.departure?.airport || '---';
  const arrAirport = flight.arrival?.airport || '---';
  const depDate = flight.departure?.date || '';
  const arrDate = flight.arrival?.date || '';
  const depCity = flight.departure?.city || '';
  const arrCity = flight.arrival?.city || '';
  const duration = flight.duration || 'N/A';
  const stops = typeof flight.stops === 'number' ? flight.stops : (flight.layovers?.length || 0);
  const cabinClass = flight.class || flight.cabinClass || 'Economy';
  const aircraft = flight.aircraft || '';
  const baggageAllowance = flight.baggageAllowance || 'Standard Baggage Rules Apply';
  const layovers = Array.isArray(flight.layovers) ? flight.layovers : [];
  const segments = Array.isArray(flight.segments) && flight.segments.length > 0 ? flight.segments : null;

  const layoverCities = layovers.map(l => l.airportCode || l.airportName).filter(Boolean).join(', ');
  const stopsLabel = stops === 0
    ? 'Nonstop'
    : stops === 1
      ? `1 stop ${layoverCities ? `in ${layoverCities}` : ''}`.trim()
      : `${stops} stops ${layoverCities ? `(${layoverCities})` : ''}`.trim();

  const cardId = `itin-detail-${label?.toLowerCase().replace(/\s+/g, '-') || 'flight'}`;

  const timelineSegments = segments || [
    {
      carrier_code: flight.carrierCode || (airline ? airline.substring(0, 2).toUpperCase() : ''),
      flight_number: flightNum,
      origin_airport: depAirport,
      destination_airport: arrAirport,
      departure_time: depTime,
      arrival_time: arrTime,
      departure_date: depDate,
      arrival_date: arrDate
    }
  ];

  const journeyTitle = /^return/i.test(label || '')
    ? 'Return Flight Route Timeline'
    : /^outbound/i.test(label || '')
      ? 'Outbound Flight Route Timeline'
      : 'Flight Route Timeline';

  return (
    <div className={`itin-card ${expanded ? 'itin-card--expanded' : ''}`}>
      <span className="itin-badge" style={{ backgroundColor: labelColor || '#1e3a5f' }}>
        {label}
      </span>

      <div style={{ padding: '12px 14px 0 14px' }}>
        <ItineraryTimeline segments={timelineSegments} title={journeyTitle} />
      </div>

      <div
        className="itin-summary-row"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={cardId}
        onClick={() => setExpanded(prev => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(prev => !prev); }
        }}
      >
        <div className="itin-col-carrier">
          <CardAirlineLogo logoUrl={flight.airline_logo} name={airline} />
          <div className="itin-carrier-text">
            <span className="itin-airline-name">{airline}</span>
            {flightNum && <span className="itin-flight-num">{flightNum}</span>}
          </div>
        </div>

        <div className="itin-col-route">
          <div className="itin-times">
            <span className="itin-time">{depTime}</span>
            <span className="itin-route-dash">—</span>
            <span className="itin-time">{arrTime}</span>
          </div>
          <div className="itin-airports">
            <span>{depAirport}</span>
            <i className={`fas ${isTrain ? 'fa-train' : 'fa-arrow-right'} itin-route-arrow`}></i>
            <span>{arrAirport}</span>
          </div>
        </div>

        <div className="itin-col-meta">
          <span className="itin-duration">{duration}</span>
          <span className={`itin-stops ${stops === 0 ? 'itin-stops--nonstop' : ''}`}>{stopsLabel}</span>
        </div>

        <i className={`fas fa-chevron-down itin-chevron ${expanded ? 'itin-chevron--rotated' : ''}`}></i>
      </div>

      {expanded && (
        <div id={cardId} className="itin-details">
          <div className="itin-details-grid">
            {segments ? (
              <div className="itin-segments-list">
                {segments.map((seg, sIdx) => (
                  <div key={sIdx} className="itin-segment-item" style={{ marginBottom: sIdx < segments.length - 1 ? '0.85rem' : 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8b1538', marginBottom: '0.2rem' }}>
                      Segment {sIdx + 1}: {seg.airline || airline} {seg.flightNumber || seg.flight_number || ''}
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#1e293b', fontWeight: 600 }}>
                      {seg.departureTime || seg.departure?.time || depTime} ({seg.departureAirport || seg.departure?.airport || depAirport})
                      {' → '}
                      {seg.arrivalTime || seg.arrival?.time || arrTime} ({seg.arrivalAirport || seg.arrival?.airport || arrAirport})
                    </div>
                    {sIdx < segments.length - 1 && (
                      <div className="itin-layover-info" style={{ marginTop: '0.4rem' }}>
                        <i className="fas fa-clock"></i> Connection stop in {seg.arrivalAirport || seg.arrival?.airport || 'layover'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="itin-detail-point">
                  <div className="itin-detail-dot"></div>
                  <div>
                    <strong className="itin-detail-time">{depTime}</strong>
                    <span className="itin-detail-airport">{depCity ? `${depCity} (${depAirport})` : depAirport}</span>
                    {depDate && <span className="itin-detail-date">{depDate}</span>}
                  </div>
                </div>

                <div className="itin-segment-bar">
                  <div className="itin-segment-line"></div>
                  <div className="itin-segment-info">
                    <span><i className={`fas ${isTrain ? 'fa-subway' : 'fa-plane'}`}></i> {duration} · {airline} {flightNum}</span>
                    {aircraft && <span><i className="fas fa-jet-fighter"></i> {aircraft}</span>}
                    <span><i className="fas fa-chair"></i> {cabinClass}</span>
                    <span><i className="fas fa-suitcase"></i> {baggageAllowance}</span>
                  </div>
                </div>

                {layovers.map((layover, idx) => (
                  <div key={idx} className="itin-layover-block">
                    <div className="itin-layover-dot"></div>
                    <div className="itin-layover-info">
                      <i className="fas fa-clock"></i>
                      <span>
                        {Math.floor((layover.duration || 0) / 60)}h {(layover.duration || 0) % 60}m layover in {layover.airportName || layover.airportCode} ({layover.airportCode})
                      </span>
                    </div>
                  </div>
                ))}

                <div className="itin-detail-point">
                  <div className="itin-detail-dot itin-detail-dot--end"></div>
                  <div>
                    <strong className="itin-detail-time">{arrTime}</strong>
                    <span className="itin-detail-airport">{arrCity ? `${arrCity} (${arrAirport})` : arrAirport}</span>
                    {arrDate && <span className="itin-detail-date">{arrDate}</span>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ItineraryCard;
