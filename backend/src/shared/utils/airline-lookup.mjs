/**
 * Canonical Airline Lookup Service & Itinerary Builder
 * Shared airline directory & normalized itinerary mapper across emails, PDF evidence, and UI.
 */

export const AIRLINE_DIRECTORY = [
  { name: 'United Airlines', iataCode: 'UA', icaoCode: 'UAL', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/UA.png' },
  { name: 'Delta Air Lines', iataCode: 'DL', icaoCode: 'DAL', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/DL.png' },
  { name: 'American Airlines', iataCode: 'AA', icaoCode: 'AAL', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/AA.png' },
  { name: 'Southwest Airlines', iataCode: 'WN', icaoCode: 'SWA', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/WN.png' },
  { name: 'Alaska Airlines', iataCode: 'AS', icaoCode: 'ASA', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/AS.png' },
  { name: 'JetBlue Airways', iataCode: 'B6', icaoCode: 'JBU', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/B6.png' },
  { name: 'Spirit Airlines', iataCode: 'NK', icaoCode: 'NKS', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/NK.png' },
  { name: 'Frontier Airlines', iataCode: 'F9', icaoCode: 'FFT', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/F9.png' },
  { name: 'Air Canada', iataCode: 'AC', icaoCode: 'ACA', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/AC.png' },
  { name: 'British Airways', iataCode: 'BA', icaoCode: 'BAW', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/BA.png' },
  { name: 'Virgin Atlantic', iataCode: 'VS', icaoCode: 'VIR', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/VS.png' },
  { name: 'Lufthansa', iataCode: 'LH', icaoCode: 'DLH', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/LH.png' },
  { name: 'Emirates', iataCode: 'EK', icaoCode: 'UAE', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/EK.png' },
  { name: 'Qatar Airways', iataCode: 'QR', icaoCode: 'QTR', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/QR.png' },
  { name: 'Turkish Airlines', iataCode: 'TK', icaoCode: 'THY', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/TK.png' },
  { name: 'Air France', iataCode: 'AF', icaoCode: 'AFR', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/AF.png' },
  { name: 'KLM Royal Dutch Airlines', iataCode: 'KL', icaoCode: 'KLM', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/KL.png' },
  { name: 'Singapore Airlines', iataCode: 'SQ', icaoCode: 'SIA', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/SQ.png' },
  { name: 'Cathay Pacific', iataCode: 'CX', icaoCode: 'CPA', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/CX.png' },
  { name: 'Qantas', iataCode: 'QF', icaoCode: 'QFA', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/QF.png' },
  { name: 'ANA (All Nippon Airways)', iataCode: 'NH', icaoCode: 'ANA', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/NH.png' },
  { name: 'Japan Airlines', iataCode: 'JL', icaoCode: 'JAL', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/JL.png' },
  { name: 'Etihad Airways', iataCode: 'EY', icaoCode: 'ETD', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/EY.png' },
  { name: 'ITA Airways', iataCode: 'AZ', icaoCode: 'ITY', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/AZ.png' },
  { name: 'Iberia', iataCode: 'IB', icaoCode: 'IBE', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/IB.png' },
  { name: 'Finnair', iataCode: 'AY', icaoCode: 'FIN', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/AY.png' },
  { name: 'SAS Scandinavian Airlines', iataCode: 'SK', icaoCode: 'SAS', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/SK.png' },
  { name: 'Swiss International Air Lines', iataCode: 'LX', icaoCode: 'SWR', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/LX.png' },
  { name: 'Austrian Airlines', iataCode: 'OS', icaoCode: 'AUA', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/OS.png' },
  { name: 'Brussels Airlines', iataCode: 'SN', icaoCode: 'BEL', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/SN.png' },
  { name: 'TAP Air Portugal', iataCode: 'TP', icaoCode: 'TAP', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/TP.png' },
  { name: 'Icelandair', iataCode: 'FI', icaoCode: 'ICE', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/FI.png' },
  { name: 'Air India', iataCode: 'AI', icaoCode: 'AIC', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/AI.png' },
  { name: 'Vistara', iataCode: 'UK', icaoCode: 'VTI', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/UK.png' },
  { name: 'Malaysia Airlines', iataCode: 'MH', icaoCode: 'MAS', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/MH.png' },
  { name: 'AirAsia', iataCode: 'AK', icaoCode: 'AXM', logoUrl: 'https://assets.duffel.com/img/airlines/for-floor/sq/AK.png' }
];

const AIRLINE_MAP = new Map(AIRLINE_DIRECTORY.map(a => [a.iataCode, a.name]));

export function getAirlineName(carrierCode) {
  if (!carrierCode) return null;
  const code = String(carrierCode).trim().toUpperCase();
  return AIRLINE_MAP.get(code) || null;
}

export function resolveAirlineName(carrierCode, providedName) {
  if (providedName && typeof providedName === 'string' && providedName.trim()) {
    const p = providedName.trim();
    if (!p.toLowerCase().includes('commercial airline') && !p.toLowerCase().includes('airline information unavailable')) {
      return p;
    }
  }
  const found = getAirlineName(carrierCode);
  if (found) return found;
  if (carrierCode && typeof carrierCode === 'string' && carrierCode.trim()) {
    return `${carrierCode.trim().toUpperCase()} Airlines`;
  }
  return '';
}

export function getCarrierLogoUrl(carrierCode) {
  const code = (carrierCode || '').trim().toUpperCase();
  if (!code) return '';
  const match = AIRLINE_DIRECTORY.find(a => a.iataCode === code);
  if (match) return match.logoUrl;
  return `https://assets.duffel.com/img/airlines/for-floor/sq/${code}.png`;
}

export function buildCanonicalItinerary(bookingOrSegments) {
  let rawSegments = [];
  if (Array.isArray(bookingOrSegments)) {
    rawSegments = bookingOrSegments;
  } else if (bookingOrSegments && typeof bookingOrSegments === 'object') {
    const b = bookingOrSegments;
    rawSegments = b.itinerary_segments || b.outbound_segments || b.segments || [];
    if (rawSegments.length === 0) {
      if (Array.isArray(b.flights) && b.flights.length > 0) {
        rawSegments = b.flights;
      } else if (b.flight_details || b.outbound_flight) {
        const candidate = b.flight_details || b.outbound_flight;
        if (candidate && (candidate.airline || candidate.carrier || candidate.departure?.airport || candidate.origin_airport || candidate.origin_code)) {
          rawSegments.push(candidate);
        }
      }
    }
  }

  // Filter out completely empty dummy objects
  rawSegments = rawSegments.filter(s => {
    if (!s || typeof s !== 'object') return false;
    const hasOrigin = !!(s.origin_airport || s.origin_code || s.originCode || s.origin || s.departure?.airport);
    const hasDest = !!(s.destination_airport || s.destination_code || s.destinationCode || s.destination || s.arrival?.airport);
    const hasCarrier = !!(s.marketing_carrier_code || s.carrier_code || s.carrier || s.airline_code || s.airline);
    return hasOrigin || hasDest || hasCarrier;
  });

  const mapSegment = (s, idx, totalInDir) => {
    const code = (s.marketing_carrier_code || s.carrier_code || s.carrier || s.airline_code || '').trim().toUpperCase();
    const name = resolveAirlineName(code, s.airline_name || s.carrier_name || s.airline);
    const originCode = (s.origin_airport || s.origin_code || s.originCode || s.origin || (s.departure?.airport) || '').trim().toUpperCase();
    const originName = s.origin_city || s.originCity || (s.departure?.city) || originCode;
    const destinationCode = (s.destination_airport || s.destination_code || s.destinationCode || s.destination || (s.arrival?.airport) || '').trim().toUpperCase();
    const destinationName = s.destination_city || s.destinationCity || (s.arrival?.city) || destinationCode;

    return {
      id: s.id || `seg_${idx}_${Date.now()}`,
      sequence: s.segment_sequence !== undefined ? parseInt(s.segment_sequence, 10) : idx + 1,
      airlineName: name || (code ? `${code} Airlines` : ''),
      carrierCode: code,
      operatingCarrier: s.operating_carrier || s.operatingCarrier || '',
      flightNumber: s.flight_number || s.flightNumber || s.number || '',
      airlineLogoUrl: getCarrierLogoUrl(code),
      originCode,
      originName,
      destinationCode,
      destinationName,
      departureAt: s.departure_date || s.departure_time || (s.departure?.date) || '',
      arrivalAt: s.arrival_date || s.arrival_time || (s.arrival?.date) || '',
      departureDate: s.departure_date || (s.departure?.date) || '',
      departureTime: s.departure_time || (s.departure?.time) || '',
      arrivalDate: s.arrival_date || (s.arrival?.date) || '',
      arrivalTime: s.arrival_time || (s.arrival?.time) || '',
      cabinClass: s.cabin || s.cabin_class || s.class || 'Economy',
      stops: s.stops !== undefined ? parseInt(s.stops, 10) : (s.stop_count !== undefined ? parseInt(s.stop_count, 10) : (totalInDir > 1 ? totalInDir - 1 : 0))
    };
  };

  const outboundSegs = rawSegments.filter(s => (s.journey_direction || s.direction) !== 'return');
  const returnSegs = rawSegments.filter(s => (s.journey_direction || s.direction) === 'return');
  if (outboundSegs.length === 0 && rawSegments.length > 0) {
    outboundSegs.push(...rawSegments);
  }

  return {
    outbound: outboundSegs.map((s, i) => mapSegment(s, i, outboundSegs.length)),
    return: returnSegs.map((s, i) => mapSegment(s, i, returnSegs.length))
  };
}
