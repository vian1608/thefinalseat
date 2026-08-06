import React, { useState } from 'react';
import { getArrivalDayShiftLabel, calculateLayoverDuration, resolveAirlineName, getCarrierLogoUrl } from '../utils/gdsItineraryHelper';

function AirlineLogoBox({ carrierCode, airlineName }) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = getCarrierLogoUrl(carrierCode);

  if (imgError || !logoUrl || !carrierCode) {
    return (
      <div style={{ width: '60px', height: '44px', flex: '0 0 60px', border: '1px solid #d7e0ec', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.85rem', color: '#1e3a5f' }}>
        {carrierCode || 'FLT'}
      </div>
    );
  }

  return (
    <div style={{ width: '60px', height: '44px', flex: '0 0 60px', border: '1px solid #d7e0ec', borderRadius: '8px', background: '#ffffff', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <img
        src={logoUrl}
        alt={airlineName || carrierCode}
        onError={() => setImgError(true)}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}

export default function ItineraryTimeline({ segments = [], title = '', variant = 'web' }) {
  if (!Array.isArray(segments) || segments.length === 0) return null;

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];

  const overallDepDate = firstSeg.departure_date || firstSeg.departureDate || firstSeg.departureAt || '';
  const overallArrDate = lastSeg.arrival_date || lastSeg.arrivalDate || lastSeg.arrivalAt || '';
  const arrivalLabel = getArrivalDayShiftLabel(overallDepDate, overallArrDate);

  // Multi-carrier vs single carrier determination
  const uniqueCarriers = Array.from(new Set(segments.map(s => (s.carrier_code || s.marketing_carrier_code || s.carrierCode || '').trim().toUpperCase()).filter(Boolean)));
  const isMultiCarrier = uniqueCarriers.length > 1;
  const primaryCarrierCode = uniqueCarriers[0] || 'FLT';
  const primaryAirlineName = isMultiCarrier ? 'Multiple Airlines' : resolveAirlineName(primaryCarrierCode, firstSeg.carrier_name || firstSeg.airlineName);

  // Build nodes: 0 = origin of seg[0], 1..N-1 = dest of seg[i-1] (connections), N = dest of seg[last]
  const nodes = [];

  // Origin node (Endpoint)
  nodes.push({
    type: 'origin',
    isEndpoint: true,
    airportCode: firstSeg.origin_airport || firstSeg.origin_code || firstSeg.originCode || firstSeg.departureAirport || 'ORIG',
    cityName: firstSeg.origin_city || firstSeg.originCity || '',
    time: firstSeg.departure_time || firstSeg.departureTime || '',
    date: overallDepDate,
    label: 'DEPARTURE',
    labelStyle: { color: '#8b1236', fontWeight: '800' }
  });

  // Intermediate connection nodes
  for (let i = 0; i < segments.length - 1; i++) {
    const segArr = segments[i];
    const segNextDep = segments[i + 1];

    const arrDate = segArr.arrival_date || segArr.arrivalDate || '';
    const arrTime = segArr.arrival_time || segArr.arrivalTime || '';
    const depDate = segNextDep.departure_date || segNextDep.departureDate || '';
    const depTime = segNextDep.departure_time || segNextDep.departureTime || '';

    const layoverText = calculateLayoverDuration(arrDate, arrTime, depDate, depTime);

    nodes.push({
      type: 'connection',
      isEndpoint: false,
      airportCode: segArr.destination_airport || segArr.destination_code || segArr.destinationCode || segArr.arrivalAirport || 'CONN',
      cityName: segArr.destination_city || segArr.destinationCity || '',
      time: arrTime,
      label: layoverText.toUpperCase(),
      labelStyle: { color: '#0369a1', fontWeight: '700' }
    });
  }

  // Final destination node (Endpoint)
  nodes.push({
    type: 'destination',
    isEndpoint: true,
    airportCode: lastSeg.destination_airport || lastSeg.destination_code || lastSeg.destinationCode || lastSeg.arrivalAirport || 'DEST',
    cityName: lastSeg.destination_city || lastSeg.destinationCity || '',
    time: lastSeg.arrival_time || lastSeg.arrivalTime || '',
    date: overallArrDate,
    label: arrivalLabel,
    labelStyle: {
      color: arrivalLabel.includes('+') ? '#d97706' : '#15803d',
      fontWeight: '800'
    }
  });

  const headingTitle = title || (segments.length > 1 ? 'Outbound Flight Route Timeline' : 'Flight Route Timeline');

  return (
    <div className="itinerary-timeline-container" style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
      {/* JOURNEY HEADING WITH LEFT-SIDE AIRLINE LOGO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
        <AirlineLogoBox carrierCode={primaryCarrierCode} airlineName={primaryAirlineName} />
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {headingTitle}
          </h3>
          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#64748b' }}>
            {primaryAirlineName}
          </span>
        </div>
      </div>

      {/* TIMELINE HORIZONTAL ROUTE CONTAINER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
        {nodes.map((node, idx) => {
          const segForLeg = segments[idx];
          const carrier = segForLeg ? (segForLeg.carrier_code || segForLeg.marketing_carrier_code || segForLeg.carrierCode || '') : '';
          const flightNum = segForLeg ? (segForLeg.flight_number || segForLeg.flightNumber || '') : '';
          const flightCode = carrier && flightNum ? `${carrier} ${flightNum}` : (carrier || flightNum || '');

          return (
            <React.Fragment key={idx}>
              {/* NODE ITEM */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: node.isEndpoint ? '110px' : '75px' }}>
                {/* TIME ABOVE NODE */}
                <div style={{ fontSize: node.isEndpoint ? '1.35rem' : '0.9rem', fontWeight: node.isEndpoint ? '800' : '700', color: '#1e293b', lineHeight: 1.2, height: '24px', display: 'flex', alignItems: 'center' }}>
                  {node.time}
                </div>

                {/* AIRPORT NODE DOT & CODE (50% scale for connections) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: node.isEndpoint ? '6px' : '4px', margin: '6px 0' }}>
                  <div style={{
                    width: node.isEndpoint ? '16px' : '10px',
                    height: node.isEndpoint ? '16px' : '10px',
                    borderRadius: '50%',
                    background: node.type === 'origin' ? '#8b1236' : (node.type === 'destination' ? '#15803d' : '#0284c7'),
                    border: '2px solid #ffffff',
                    boxShadow: '0 0 0 2px rgba(0,0,0,0.1)'
                  }} />
                  <span style={{
                    fontSize: node.isEndpoint ? '2.4rem' : '1.25rem', // ~50% scale for connections
                    fontWeight: node.isEndpoint ? '800' : '750',
                    color: '#0f172a',
                    lineHeight: 1,
                    letterSpacing: '0.5px'
                  }}>
                    {node.airportCode}
                  </span>
                </div>

                {/* LABEL BELOW NODE */}
                <div style={{ fontSize: node.isEndpoint ? '0.78rem' : '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px', ...node.labelStyle }}>
                  {node.label}
                </div>
                {node.cityName && (
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '1px' }}>
                    {node.cityName}
                  </div>
                )}
              </div>

              {/* CONNECTING ROUTE LINE WITH LEFT->RIGHT PLANE ICON */}
              {idx < nodes.length - 1 && (
                <div style={{ flex: 1, minWidth: '90px', margin: '0 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {/* FLIGHT NUMBER BADGE ABOVE LINE */}
                  <div className="flight-number-badge" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 10px', borderRadius: '999px', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                    ✈ {flightCode}
                  </div>

                  {/* DASHED LINE WITH PLANE FACING LEFT -> RIGHT */}
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <div style={{ flex: 1, borderTop: '2px dashed #94a3b8' }} />
                    <i
                      className="fas fa-plane"
                      aria-hidden="true"
                      style={{
                        color: '#8b1236',
                        fontSize: '0.9rem',
                        transform: 'rotate(90deg)', // Font Awesome plane naturally points UP; 90deg makes it point LEFT -> RIGHT
                        transformOrigin: 'center',
                        display: 'inline-block',
                        margin: '0 6px'
                      }}
                    />
                    <div style={{ flex: 1, borderTop: '2px dashed #94a3b8' }} />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
