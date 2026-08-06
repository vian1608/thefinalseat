import React from 'react';
import { getArrivalDayShiftLabel, calculateLayoverDuration } from '../utils/gdsItineraryHelper';

export default function ItineraryTimeline({ segments = [], title = '' }) {
  if (!Array.isArray(segments) || segments.length === 0) return null;

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];

  const overallDepDate = firstSeg.departure_date || firstSeg.departureDate || firstSeg.departureAt || '';
  const overallArrDate = lastSeg.arrival_date || lastSeg.arrivalDate || lastSeg.arrivalAt || '';
  const arrivalLabel = getArrivalDayShiftLabel(overallDepDate, overallArrDate);

  // Build nodes: 0 = origin of seg[0], 1..N-1 = dest of seg[i-1] (connections), N = dest of seg[last]
  const nodes = [];

  // Origin node
  nodes.push({
    type: 'origin',
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
      airportCode: segArr.destination_airport || segArr.destination_code || segArr.destinationCode || segArr.arrivalAirport || 'CONN',
      cityName: segArr.destination_city || segArr.destinationCity || '',
      arrTime: arrTime,
      depTime: depTime,
      label: layoverText,
      labelStyle: { color: '#0369a1', fontWeight: '700' }
    });
  }

  // Final destination node
  nodes.push({
    type: 'destination',
    airportCode: lastSeg.destination_airport || lastSeg.destination_code || lastSeg.destinationCode || lastSeg.arrivalAirport || 'DEST',
    cityName: lastSeg.destination_city || lastSeg.destinationCity || '',
    time: lastSeg.arrival_time || lastSeg.arrivalTime || '',
    date: overallArrDate,
    label: arrivalLabel, // 'ARRIVAL', 'ARRIVAL +1', 'ARRIVAL +2', etc.
    labelStyle: {
      color: arrivalLabel.includes('+') ? '#d97706' : '#15803d',
      fontWeight: '800'
    }
  });

  return (
    <div className="itinerary-timeline-container" style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {title && (
        <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#8b1236', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
          <i className="fas fa-plane-flight" style={{ marginRight: '6px' }}></i> {title}
        </div>
      )}

      {/* TIMELINE HORIZONTAL ROUTE CONTAINER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
        {nodes.map((node, idx) => {
          const segForLeg = segments[idx]; // Leg line between node[idx] and node[idx+1]
          const carrier = segForLeg ? (segForLeg.carrier_code || segForLeg.marketing_carrier_code || '') : '';
          const flightNum = segForLeg ? (segForLeg.flight_number || segForLeg.flightNumber || '') : '';
          const flightCode = carrier && flightNum ? `${carrier} ${flightNum}` : (carrier || flightNum || '');

          return (
            <React.Fragment key={idx}>
              {/* NODE ITEM */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: '90px' }}>
                {/* TIME ABOVE NODE */}
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', height: '20px', display: 'flex', alignItems: 'center' }}>
                  {node.time || (node.arrTime ? `${node.arrTime}` : '')}
                </div>

                {/* AIRPORT NODE DOT & CODE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: node.type === 'origin' ? '#8b1236' : (node.type === 'destination' ? '#15803d' : '#0284c7'), border: '2px solid #ffffff', boxShadow: '0 0 0 2px rgba(0,0,0,0.1)' }} />
                  <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', letterSpacing: '0.5px' }}>{node.airportCode}</span>
                </div>

                {/* LABEL BELOW NODE */}
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px', ...node.labelStyle }}>
                  {node.label}
                </div>
                {node.cityName && (
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                    {node.cityName}
                  </div>
                )}
              </div>

              {/* CONNECTING ROUTE LINE WITH FLIGHT NUMBER */}
              {idx < nodes.length - 1 && (
                <div style={{ flex: 1, minWidth: '100px', margin: '0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  {/* FLIGHT NUMBER ABOVE LINE */}
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '2px', background: '#f8fafc', padding: '2px 8px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    ✈ {flightCode}
                  </div>

                  {/* VISUAL DASHED LINE WITH PLANE */}
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <div style={{ flex: 1, borderTop: '2px dashed #94a3b8' }} />
                    <i className="fas fa-plane" style={{ color: '#8b1236', fontSize: '0.85rem', transform: 'rotate(90deg)', margin: '0 4px' }}></i>
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
