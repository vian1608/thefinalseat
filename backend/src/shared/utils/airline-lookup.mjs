/**
 * Canonical Airline Lookup Service & Itinerary Builder
 * Shared airline directory & normalized itinerary mapper across emails, PDF evidence, and UI.
 */

export const AIRLINE_DIRECTORY = [
  { name: 'United Airlines', iataCode: 'UA', icaoCode: 'UAL', logoUrl: '/airlines/ua.png' },
  { name: 'Delta Air Lines', iataCode: 'DL', icaoCode: 'DAL', logoUrl: '/airlines/dl.png' },
  { name: 'American Airlines', iataCode: 'AA', icaoCode: 'AAL', logoUrl: '/airlines/aa.png' },
  { name: 'Southwest Airlines', iataCode: 'WN', icaoCode: 'SWA', logoUrl: '/airlines/wn.png' },
  { name: 'Alaska Airlines', iataCode: 'AS', icaoCode: 'ASA', logoUrl: '/airlines/as.png' },
  { name: 'JetBlue', iataCode: 'B6', icaoCode: 'JBU', logoUrl: '/airlines/b6.png' },
  { name: 'Spirit Airlines', iataCode: 'NK', icaoCode: 'NKS', logoUrl: '/airlines/nk.png' },
  { name: 'Frontier Airlines', iataCode: 'F9', icaoCode: 'FFT', logoUrl: '/airlines/f9.png' },
  { name: 'Air Canada', iataCode: 'AC', icaoCode: 'ACA', logoUrl: '/airlines/ac.png' },
  { name: 'British Airways', iataCode: 'BA', icaoCode: 'BAW', logoUrl: '/airlines/ba.png' },
  { name: 'Virgin Atlantic', iataCode: 'VS', icaoCode: 'VIR', logoUrl: '/airlines/vs.png' },
  { name: 'Lufthansa', iataCode: 'LH', icaoCode: 'DLH', logoUrl: '/airlines/lh.png' },
  { name: 'Air France', iataCode: 'AF', icaoCode: 'AFR', logoUrl: '/airlines/af.png' },
  { name: 'KLM', iataCode: 'KL', icaoCode: 'KLM', logoUrl: '/airlines/kl.png' },
  { name: 'Emirates', iataCode: 'EK', icaoCode: 'UAE', logoUrl: '/airlines/ek.png' },
  { name: 'Qatar Airways', iataCode: 'QR', icaoCode: 'QTR', logoUrl: '/airlines/qr.png' },
  { name: 'Turkish Airlines', iataCode: 'TK', icaoCode: 'THY', logoUrl: '/airlines/tk.png' },
  { name: 'Singapore Airlines', iataCode: 'SQ', icaoCode: 'SIA', logoUrl: '/airlines/sq.png' },
  { name: 'Cathay Pacific', iataCode: 'CX', icaoCode: 'CPA', logoUrl: '/airlines/cx.png' },
  { name: 'Qantas', iataCode: 'QF', icaoCode: 'QFA', logoUrl: '/airlines/qf.png' },
  { name: 'ANA (All Nippon Airways)', iataCode: 'NH', icaoCode: 'ANA', logoUrl: '/airlines/nh.png' },
  { name: 'Japan Airlines', iataCode: 'JL', icaoCode: 'JAL', logoUrl: '/airlines/jl.png' },
  { name: 'Etihad Airways', iataCode: 'EY', icaoCode: 'ETD', logoUrl: '/airlines/ey.png' },
  { name: 'ITA Airways', iataCode: 'AZ', icaoCode: 'ITY', logoUrl: '/airlines/az.png' },
  { name: 'Iberia', iataCode: 'IB', icaoCode: 'IBE', logoUrl: '/airlines/ib.png' },
  { name: 'Finnair', iataCode: 'AY', icaoCode: 'FIN', logoUrl: '/airlines/ay.png' },
  { name: 'SAS Scandinavian Airlines', iataCode: 'SK', icaoCode: 'SAS', logoUrl: '/airlines/sk.png' },
  { name: 'Swiss International Air Lines', iataCode: 'LX', icaoCode: 'SWR', logoUrl: '/airlines/lx.png' },
  { name: 'Austrian Airlines', iataCode: 'OS', icaoCode: 'AUA', logoUrl: '/airlines/os.png' },
  { name: 'Brussels Airlines', iataCode: 'SN', icaoCode: 'BEL', logoUrl: '/airlines/sn.png' },
  { name: 'TAP Air Portugal', iataCode: 'TP', icaoCode: 'TAP', logoUrl: '/airlines/tp.png' },
  { name: 'Icelandair', iataCode: 'FI', icaoCode: 'ICE', logoUrl: '/airlines/fi.png' },
  { name: 'Air India', iataCode: 'AI', icaoCode: 'AIC', logoUrl: '/airlines/ai.png' },
  { name: 'Vistara', iataCode: 'UK', icaoCode: 'VTI', logoUrl: '/airlines/uk.png' },
  { name: 'Malaysia Airlines', iataCode: 'MH', icaoCode: 'MAS', logoUrl: '/airlines/mh.png' },
  { name: 'AirAsia', iataCode: 'AK', icaoCode: 'AXM', logoUrl: '/airlines/ak.png' }
];

export function searchAirlines(query) {
  if (!query || typeof query !== 'string') return AIRLINE_DIRECTORY;
  const q = query.trim().toLowerCase();
  if (!q) return AIRLINE_DIRECTORY;

  return AIRLINE_DIRECTORY.filter(a => {
    const name = a.name.toLowerCase();
    const code = a.iataCode.toLowerCase();
    const icao = (a.icaoCode || '').toLowerCase();
    if (name.includes(q) || code.includes(q) || icao.includes(q)) return true;

    // Fuzzy matching for terms like 'unire' -> 'United Airlines'
    if (q.startsWith('un') && name.includes('united')) return true;
    return false;
  });
}

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

    // Priority 1: normalized itinerary_segments table (booking_itinerary_segments)
    rawSegments = b.itinerary_segments || [];

    // Priority 2: outbound + return already split (enrichBookingRecord output)
    if (rawSegments.length === 0) {
      const out = b.outbound_segments || [];
      const ret = b.return_segments || [];
      if (out.length > 0 || ret.length > 0) {
        rawSegments = [
          ...out.map(s => ({ ...s, journey_direction: s.journey_direction || s.direction || 'outbound' })),
          ...ret.map(s => ({ ...s, journey_direction: s.journey_direction || s.direction || 'return' }))
        ];
      }
    }

    // Priority 3: flights table rows (production legacy store)
    // Columns: leg, airline_name, carrier_code, flight_number, departure_airport, arrival_airport,
    //          departure_date, arrival_date, departure_time_str, arrival_time_str, cabin_class, stops
    if (rawSegments.length === 0 && Array.isArray(b.flights) && b.flights.length > 0) {
      rawSegments = b.flights.map(f => ({
        ...f,
        // Map flights table columns to canonical segment fields
        journey_direction: (f.leg === 'return' || f.leg === 'inbound') ? 'return' : 'outbound',
        direction: (f.leg === 'return' || f.leg === 'inbound') ? 'return' : 'outbound',
        origin_airport: f.departure_airport || f.origin_airport || f.origin || '',
        destination_airport: f.arrival_airport || f.destination_airport || f.destination || '',
        airline_name: f.airline_name || f.carrier_name || '',
        carrier_code: f.carrier_code || f.marketing_carrier_code || '',
        departure_time: f.departure_time_str || f.departure_time || '',
        arrival_time: f.arrival_time_str || f.arrival_time || '',
        cabin: f.cabin_class || f.cabin || 'Economy',
        stop_count: parseInt(f.stops || 0, 10)
      }));
    }

    // Priority 4: single flight_details object
    if (rawSegments.length === 0 && (b.flight_details || b.outbound_flight)) {
      const candidate = b.flight_details || b.outbound_flight;
      if (candidate && (candidate.airline || candidate.carrier || candidate.departure?.airport || candidate.origin_airport || candidate.origin_code)) {
        rawSegments.push(candidate);
      }
    }
  }

  // Filter out completely empty dummy objects
  rawSegments = rawSegments.filter(s => {
    if (!s || typeof s !== 'object') return false;
    const hasOrigin = !!(s.origin_airport || s.origin_code || s.originCode || s.origin || s.departure?.airport || s.departure_airport);
    const hasDest = !!(s.destination_airport || s.destination_code || s.destinationCode || s.destination || s.arrival?.airport || s.arrival_airport);
    const hasCarrier = !!(s.marketing_carrier_code || s.carrier_code || s.carrier || s.airline_code || s.airline || s.airline_name);
    return hasOrigin || hasDest || hasCarrier;
  });

  const mapSegment = (s, idx, totalInDir) => {
    const code = (s.marketing_carrier_code || s.carrier_code || s.carrier || s.airline_code || '').trim().toUpperCase();
    const name = resolveAirlineName(code, s.airline_name || s.carrier_name || s.airline);
    const originCode = (s.origin_airport || s.departure_airport || s.origin_code || s.originCode || s.origin || (s.departure?.airport) || '').trim().toUpperCase();
    const originName = s.origin_city || s.originCity || (s.departure?.city) || originCode;
    const destinationCode = (s.destination_airport || s.arrival_airport || s.destination_code || s.destinationCode || s.destination || (s.arrival?.airport) || '').trim().toUpperCase();
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
      departureAt: s.departure_date || s.departure_time || s.departure_time_str || (s.departure?.date) || '',
      arrivalAt: s.arrival_date || s.arrival_time || s.arrival_time_str || (s.arrival?.date) || '',
      departureDate: s.departure_date || (s.departure?.date) || '',
      departureTime: s.departure_time || s.departure_time_str || (s.departure?.time) || '',
      arrivalDate: s.arrival_date || (s.arrival?.date) || '',
      arrivalTime: s.arrival_time || s.arrival_time_str || (s.arrival?.time) || '',
      cabinClass: s.cabin || s.cabin_class || s.class || 'Economy',
      stops: s.stops !== undefined ? parseInt(s.stops, 10) : (s.stop_count !== undefined ? parseInt(s.stop_count, 10) : (totalInDir > 1 ? totalInDir - 1 : 0))
    };
  };

  const outboundSegs = rawSegments.filter(s => (s.journey_direction || s.direction || s.leg) !== 'return' && (s.journey_direction || s.direction || s.leg) !== 'inbound');
  const returnSegs = rawSegments.filter(s => (s.journey_direction || s.direction || s.leg) === 'return' || (s.journey_direction || s.direction || s.leg) === 'inbound');
  if (outboundSegs.length === 0 && rawSegments.length > 0) {
    outboundSegs.push(...rawSegments);
  }

  return {
    outbound: outboundSegs.map((s, i) => mapSegment(s, i, outboundSegs.length)),
    return: returnSegs.map((s, i) => mapSegment(s, i, returnSegs.length))
  };
}


export function calculateTripSummary(bookingOrItinerary) {
  const itinerary = buildCanonicalItinerary(bookingOrItinerary);
  const outbound = itinerary.outbound || [];
  const returnSegs = itinerary.return || [];

  let tripType = 'One Way';
  let isRoundTrip = false;
  let isOpenJaw = false;

  if (outbound.length > 0 && returnSegs.length > 0) {
    const firstOutboundOrigin = outbound[0].originCode;
    const lastReturnDest = returnSegs[returnSegs.length - 1].destinationCode;
    if (firstOutboundOrigin && lastReturnDest && firstOutboundOrigin !== lastReturnDest) {
      tripType = 'Open Jaw';
      isOpenJaw = true;
    } else {
      tripType = 'Round Trip';
      isRoundTrip = true;
    }
  }

  // Compute stops
  let stopsSummary = '';
  if (isRoundTrip || isOpenJaw) {
    const outboundStops = Math.max(0, outbound.length - 1);
    const returnStops = Math.max(0, returnSegs.length - 1);

    const outboundText = outboundStops === 0 ? 'Nonstop outbound' : (outboundStops === 1 ? '1 stop outbound' : `${outboundStops} stops outbound`);
    const returnText = returnStops === 0 ? 'Nonstop return' : (returnStops === 1 ? '1 stop return' : `${returnStops} stops return`);

    if (outboundStops === 0 && returnStops === 0) {
      stopsSummary = 'Nonstop both ways';
    } else {
      stopsSummary = `${outboundText} · ${returnText}`;
    }
  } else {
    const outboundStops = Math.max(0, outbound.length - 1);
    if (outboundStops === 0) {
      stopsSummary = 'Nonstop';
    } else if (outboundStops === 1) {
      stopsSummary = `${outbound.length} flights · 1 connection`;
    } else {
      stopsSummary = `${outbound.length} flights · ${outboundStops} connections`;
    }
  }

  // Compute route string
  let routeSummary = '';
  if (outbound.length > 0) {
    const outAirports = [outbound[0].originCode, ...outbound.map(s => s.destinationCode)].filter(Boolean);
    const uniqueOutRoute = outAirports.join(' → ');
    if (isRoundTrip || isOpenJaw) {
      const retAirports = returnSegs.map(s => s.destinationCode).filter(Boolean);
      routeSummary = `${uniqueOutRoute} → ${retAirports.join(' → ')}`;
    } else {
      routeSummary = uniqueOutRoute;
    }
  }

  // Compute passenger count
  let passengerCount = 1;
  if (bookingOrItinerary && typeof bookingOrItinerary === 'object') {
    const b = bookingOrItinerary;
    if (Array.isArray(b.travellers) && b.travellers.length > 0) {
      passengerCount = b.travellers.length;
    } else if (b.passenger_count || b.passengerCount) {
      passengerCount = parseInt(b.passenger_count || b.passengerCount, 10) || 1;
    }
  }

  // PNR status
  const pnr = (bookingOrItinerary.airline_confirmation_number || bookingOrItinerary.airlineConfirmationNumber || bookingOrItinerary.airline_pnr || bookingOrItinerary.pnr || '').trim().toUpperCase();
  const isTicketed = /^[A-Z0-9]{6}$/.test(pnr);

  return {
    tripType,
    routeSummary,
    stopsSummary,
    bannerText: `${tripType} · ${stopsSummary}`,
    passengerCount,
    passengerText: `${passengerCount} Passenger${passengerCount > 1 ? 's' : ''}`,
    isTicketed,
    pnr: isTicketed ? pnr : null
  };
}

export function getArrivalDayShiftLabel(depDateStr, arrDateStr) {
  if (!depDateStr || !arrDateStr) return 'ARRIVAL';

  const parseToIso = (dStr) => {
    if (!dStr) return null;
    const clean = String(dStr).split('T')[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      const p = clean.split('/');
      return `${p[2]}-${p[0]}-${p[1]}`;
    }
    return null;
  };

  const isoDep = parseToIso(depDateStr);
  const isoArr = parseToIso(arrDateStr);

  if (!isoDep || !isoArr) return 'ARRIVAL';

  const dDep = new Date(isoDep);
  const dArr = new Date(isoArr);

  const diffTime = dArr.getTime() - dDep.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (diffDays <= 0) return 'ARRIVAL';
  return `ARRIVAL +${diffDays}`;
}

export function calculateLayoverDuration(arrDateStr, arrTimeStr, depDateStr, depTimeStr) {
  if (!arrDateStr || !depDateStr || !arrTimeStr || !depTimeStr) return 'Connection';

  try {
    const parseToIso = (dStr) => {
      const clean = String(dStr).split('T')[0].trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
        const p = clean.split('/');
        return `${p[2]}-${p[0]}-${p[1]}`;
      }
      return clean;
    };

    const isoArr = parseToIso(arrDateStr);
    const isoDep = parseToIso(depDateStr);

    const [arrH, arrM] = (arrTimeStr || '00:00').split(':').map(Number);
    const [depH, depM] = (depTimeStr || '00:00').split(':').map(Number);

    const dateArr = new Date(`${isoArr}T${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}:00`);
    const dateDep = new Date(`${isoDep}T${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}:00`);

    const diffMinutes = Math.round((dateDep.getTime() - dateArr.getTime()) / (1000 * 60));
    if (diffMinutes <= 0 || isNaN(diffMinutes)) return 'Connection';

    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;

    if (hours > 0 && mins > 0) return `Layover ${hours}h ${mins}m`;
    if (hours > 0) return `Layover ${hours}h`;
    return `Layover ${mins}m`;
  } catch (e) {
    return 'Connection';
  }
}

