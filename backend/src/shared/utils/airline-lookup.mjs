/**
 * Canonical Airline Lookup Service & Itinerary Builder
 * Maps IATA Carrier Code -> Airline Name & Airline Logo URL
 * Provides unified canonical itinerary structure across emails, PDF evidence, and frontend UI.
 */

const AIRLINE_DICTIONARY = {
  UA: 'United Airlines',
  DL: 'Delta Air Lines',
  AA: 'American Airlines',
  LH: 'Lufthansa',
  AC: 'Air Canada',
  WN: 'Southwest Airlines',
  BA: 'British Airways',
  VS: 'Virgin Atlantic',
  AF: 'Air France',
  KL: 'KLM Royal Dutch Airlines',
  EK: 'Emirates',
  QR: 'Qatar Airways',
  SQ: 'Singapore Airlines',
  NH: 'ANA (All Nippon Airways)',
  JL: 'Japan Airlines',
  QF: 'Qantas',
  TK: 'Turkish Airlines',
  EY: 'Etihad Airways',
  CX: 'Cathay Pacific',
  AS: 'Alaska Airlines',
  B6: 'JetBlue Airways',
  NK: 'Spirit Airlines',
  F9: 'Frontier Airlines',
  AZ: 'ITA Airways',
  IB: 'Iberia',
  AY: 'Finnair',
  SK: 'SAS Scandinavian Airlines',
  LX: 'Swiss International Air Lines',
  OS: 'Austrian Airlines',
  SN: 'Brussels Airlines',
  TP: 'TAP Air Portugal',
  FI: 'Icelandair',
  AI: 'Air India',
  UK: 'Vistara',
  MH: 'Malaysia Airlines',
  AK: 'AirAsia'
};

export function getAirlineName(carrierCode) {
  if (!carrierCode) return null;
  const code = String(carrierCode).trim().toUpperCase();
  return AIRLINE_DICTIONARY[code] || null;
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
        if (candidate && (candidate.airline || candidate.carrier || candidate.departure?.airport || candidate.origin_airport)) {
          rawSegments.push(candidate);
        }
      }
    }
  }

  rawSegments = rawSegments.filter(s => {
    if (!s || typeof s !== 'object') return false;
    const hasOrigin = !!(s.origin_airport || s.origin_code || s.originCode || s.origin || s.departure?.airport);
    const hasDest = !!(s.destination_airport || s.destination_code || s.destinationCode || s.destination || s.arrival?.airport);
    const hasCarrier = !!(s.marketing_carrier_code || s.carrier_code || s.carrier || s.airline_code || s.airline);
    return hasOrigin || hasDest || hasCarrier;
  });


  const mapSegment = (s) => {
    const code = (s.marketing_carrier_code || s.carrier_code || s.carrier || s.airline_code || '').trim().toUpperCase();
    const name = resolveAirlineName(code, s.airline_name || s.carrier_name || s.airline);
    const originCode = (s.origin_airport || s.origin_code || s.originCode || s.origin || (s.departure?.airport) || '').trim().toUpperCase();
    const originName = s.origin_city || s.originCity || (s.departure?.city) || originCode;
    const destinationCode = (s.destination_airport || s.destination_code || s.destinationCode || s.destination || (s.arrival?.airport) || '').trim().toUpperCase();
    const destinationName = s.destination_city || s.destinationCity || (s.arrival?.city) || destinationCode;

    return {
      airlineName: name || (code ? `${code} Airlines` : ''),
      carrierCode: code,
      flightNumber: s.flight_number || s.flightNumber || s.number || '',
      originCode,
      originName,
      destinationCode,
      destinationName,
      departureDate: s.departure_date || (s.departure?.date) || '',
      departureTime: s.departure_time || (s.departure?.time) || '',
      arrivalDate: s.arrival_date || (s.arrival?.date) || '',
      arrivalTime: s.arrival_time || (s.arrival?.time) || '',
      cabinClass: s.cabin || s.cabin_class || s.class || 'Economy',
      stops: s.stops !== undefined ? s.stops : (s.stop_count !== undefined ? parseInt(s.stop_count, 10) : 0),
      logoUrl: getCarrierLogoUrl(code)
    };
  };

  const outboundSegs = rawSegments.filter(s => (s.journey_direction || s.direction) !== 'return');
  const returnSegs = rawSegments.filter(s => (s.journey_direction || s.direction) === 'return');
  if (outboundSegs.length === 0 && rawSegments.length > 0) {
    outboundSegs.push(...rawSegments);
  }

  return {
    outbound: outboundSegs.map(mapSegment),
    return: returnSegs.map(mapSegment)
  };
}
