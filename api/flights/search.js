const LOCAL_AIRPORTS = [
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', state: 'GA', country: 'United States' },
  { code: 'AUS', name: 'Austin-Bergstrom International Airport', city: 'Austin', state: 'TX', country: 'United States' },
  { code: 'BWI', name: 'Baltimore/Washington International Airport', city: 'Baltimore', state: 'MD', country: 'United States' },
  { code: 'BOS', name: 'Logan International Airport', city: 'Boston', state: 'MA', country: 'United States' },
  { code: 'CLT', name: 'Charlotte Douglas International Airport', city: 'Charlotte', state: 'NC', country: 'United States' },
  { code: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago', state: 'IL', country: 'United States' },
  { code: 'MDW', name: 'Midway International Airport', city: 'Chicago', state: 'IL', country: 'United States' },
  { code: 'CVG', name: 'Cincinnati/Northern Kentucky International Airport', city: 'Cincinnati', state: 'OH', country: 'United States' },
  { code: 'CLE', name: 'Cleveland Hopkins International Airport', city: 'Cleveland', state: 'OH', country: 'United States' },
  { code: 'CMH', name: 'John Glenn Columbus International Airport', city: 'Columbus', state: 'OH', country: 'United States' },
  { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas/Fort Worth', state: 'TX', country: 'United States' },
  { code: 'DAL', name: 'Dallas Love Field', city: 'Dallas', state: 'TX', country: 'United States' },
  { code: 'DEN', name: 'Denver International Airport', city: 'Denver', state: 'CO', country: 'United States' },
  { code: 'DTW', name: 'Detroit Metro Wayne County Airport', city: 'Detroit', state: 'MI', country: 'United States' },
  { code: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', state: 'FL', country: 'United States' },
  { code: 'RSW', name: 'Southwest Florida International Airport', city: 'Fort Myers', state: 'FL', country: 'United States' },
  { code: 'HNL', name: 'Daniel K. Inouye International Airport', city: 'Honolulu', state: 'HI', country: 'United States' },
  { code: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', state: 'TX', country: 'United States' },
  { code: 'HOU', name: 'William P. Hobby Airport', city: 'Houston', state: 'TX', country: 'United States' },
  { code: 'IND', name: 'Indianapolis International Airport', city: 'Indianapolis', state: 'IN', country: 'United States' },
  { code: 'JAX', name: 'Jacksonville International Airport', city: 'Jacksonville', state: 'FL', country: 'United States' },
  { code: 'MCI', name: 'Kansas City International Airport', city: 'Kansas City', state: 'MO', country: 'United States' },
  { code: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', state: 'NV', country: 'United States' },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA', country: 'United States' },
  { code: 'SNA', name: 'John Wayne Airport', city: 'Orange County', state: 'CA', country: 'United States' },
  { code: 'SDF', name: 'Louisville Muhammad Ali International Airport', city: 'Louisville', state: 'KY', country: 'United States' },
  { code: 'MEM', name: 'Memphis International Airport', city: 'Memphis', state: 'TN', country: 'United States' },
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL', country: 'United States' },
  { code: 'MKE', name: 'Milwaukee Mitchell International Airport', city: 'Milwaukee', state: 'WI', country: 'United States' },
  { code: 'MSP', name: 'Minneapolis-Saint Paul International Airport', city: 'Minneapolis/St. Paul', state: 'MN', country: 'United States' },
  { code: 'BNA', name: 'Nashville International Airport', city: 'Nashville', state: 'TN', country: 'United States' },
  { code: 'MSY', name: 'Louis Armstrong New Orleans International Airport', city: 'New Orleans', state: 'LA', country: 'United States' },
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', state: 'NY', country: 'United States' },
  { code: 'LGA', name: 'LaGuardia Airport', city: 'New York', state: 'NY', country: 'United States' },
  { code: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', state: 'NJ', country: 'United States' },
  { code: 'OAK', name: 'San Francisco Bay Oakland International Airport', city: 'Oakland', state: 'CA', country: 'United States' },
  { code: 'MCO', name: 'Orlando International Airport', city: 'Orlando', state: 'FL', country: 'United States' },
  { code: 'PHL', name: 'Philadelphia International Airport', city: 'Philadelphia', state: 'PA', country: 'United States' },
  { code: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', state: 'AZ', country: 'United States' },
  { code: 'PIT', name: 'Pittsburgh International Airport', city: 'Pittsburgh', state: 'PA', country: 'United States' },
  { code: 'PDX', name: 'Portland International Airport', city: 'Portland', state: 'OR', country: 'United States' },
  { code: 'RDU', name: 'Raleigh-Durham International Airport', city: 'Raleigh/Durham', state: 'NC', country: 'United States' },
  { code: 'RIC', name: 'Richmond International Airport', city: 'Richmond', state: 'VA', country: 'United States' },
  { code: 'SMF', name: 'Sacramento International Airport', city: 'Sacramento', state: 'CA', country: 'United States' },
  { code: 'SLC', name: 'Salt Lake City International Airport', city: 'Salt Lake City', state: 'UT', country: 'United States' },
  { code: 'SAN', name: 'San Diego International Airport', city: 'San Diego', state: 'CA', country: 'United States' },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', state: 'CA', country: 'United States' },
  { code: 'SJC', name: 'San Jose Mineta International Airport', city: 'San Jose', state: 'CA', country: 'United States' },
  { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', state: 'WA', country: 'United States' },
  { code: 'STL', name: 'St. Louis Lambert International Airport', city: 'St. Louis', state: 'MO', country: 'United States' },
  { code: 'TPA', name: 'Tampa International Airport', city: 'Tampa', state: 'FL', country: 'United States' },
  { code: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington', state: 'DC', country: 'United States' },
  { code: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', state: 'DC', country: 'United States' }
];

function extractAirportCode(input) {
  if (!input) return '';
  const match = input.match(/\(([A-Z]{3,4})\)/i);
  return match ? match[1].toUpperCase() : input.trim().toUpperCase().substring(0, 3);
}

function mapTravelClass(cabin) {
  const c = (cabin || 'economy').toLowerCase();
  if (c.includes('premium')) return '2';
  if (c.includes('business')) return '3';
  if (c.includes('first')) return '4';
  return '1';
}

function formatSerpFlightOffers(data, searchParams) {
  const bestFlights = data.best_flights || [];
  const otherFlights = data.other_flights || [];
  const allItineraries = [...bestFlights, ...otherFlights];

  if (allItineraries.length === 0) {
    return { flights: [], meta: { isMock: false } };
  }

  const formattedFlights = allItineraries.map((itinerary, index) => {
    const segments = itinerary.flights || [];
    if (segments.length === 0) return null;

    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];
    
    const stopsCount = segments.length - 1;
    const layovers = (itinerary.layovers || []).map(layover => ({
      airportCode: layover.id,
      airportName: layover.name,
      duration: layover.duration
    }));

    const originalPrice = parseFloat(itinerary.price || 0);
    const websitePrice = Math.round(originalPrice * 0.90);

    const totalDurationMin = itinerary.total_duration || segments.reduce((sum, s) => sum + (s.duration || 0), 0);
    const hours = Math.floor(totalDurationMin / 60);
    const minutes = totalDurationMin % 60;
    const durationStr = `${hours}h ${minutes}m`;

    const airlineName = firstSeg.airline || 'Unknown Airline';
    const flightNumber = segments.map(s => s.flight_number || '').filter(Boolean).join(', ') || 'N/A';
    
    const depDate = firstSeg.departure_airport?.time?.split(' ')[0] || searchParams.departure;
    const depTime = firstSeg.departure_airport?.time?.split(' ')[1] || 'N/A';
    const arrDate = lastSeg.arrival_airport?.time?.split(' ')[0] || searchParams.departure;
    const arrTime = lastSeg.arrival_airport?.time?.split(' ')[1] || 'N/A';

    return {
      id: itinerary.booking_token || `serp-flight-${index}`,
      price: {
        total: websitePrice.toFixed(2),
        originalApiPrice: originalPrice.toFixed(2),
        currency: searchParams.currency || 'USD',
        formatted: `$${websitePrice.toFixed(2)}`
      },
      airline: airlineName,
      airline_logo: firstSeg.airline_logo || 'https://www.gstatic.com/flights/airline_logos/70px/airline.png',
      flightNumber: flightNumber,
      departure: {
        airport: firstSeg.departure_airport?.id || 'Origin',
        city: firstSeg.departure_airport?.name || 'Origin City',
        time: depTime,
        date: depDate
      },
      arrival: {
        airport: lastSeg.arrival_airport?.id || 'Destination',
        city: lastSeg.arrival_airport?.name || 'Destination City',
        time: arrTime,
        date: arrDate
      },
      duration: durationStr,
      stops: stopsCount,
      layovers: layovers,
      class: firstSeg.travel_class || searchParams.travelClass || 'Economy',
      aircraft: firstSeg.airplane || 'Boeing / Airbus',
      fareType: 'Standard Cabin Select',
      refundableStatus: itinerary.extensions?.join(', ').toLowerCase().includes('refundable') ? 'Refundable (Fees Apply)' : 'Non-Refundable',
      baggageAllowance: itinerary.extensions?.join(', ').toLowerCase().includes('carry-on') ? 'Carry-on Included' : 'Standard Baggage Rules Apply'
    };
  }).filter(Boolean);

  return {
    flights: formattedFlights,
    meta: { count: formattedFlights.length, isMock: false }
  };
}

function getMockFlightOffers(searchParams) {
  const fromCode = extractAirportCode(searchParams.from);
  const toCode = extractAirportCode(searchParams.to);
  const departureDate = searchParams.departure || new Date().toISOString().split('T')[0];
  const travelClass = searchParams.travelClass || 'Economy';
  const passengers = parseInt(searchParams.adults || 1, 10) + parseInt(searchParams.children || 0, 10);

  const baseAirlines = [
    { name: 'Delta Air Lines', code: 'DL', basePrice: 280, logo: 'https://www.gstatic.com/flights/airline_logos/70px/DL.png' },
    { name: 'United Airlines', code: 'UA', basePrice: 250, logo: 'https://www.gstatic.com/flights/airline_logos/70px/UA.png' },
    { name: 'American Airlines', code: 'AA', basePrice: 260, logo: 'https://www.gstatic.com/flights/airline_logos/70px/AA.png' },
    { name: 'JetBlue Airways', code: 'B6', basePrice: 220, logo: 'https://www.gstatic.com/flights/airline_logos/70px/B6.png' }
  ];

  const flights = baseAirlines.map((airline, idx) => {
    let multiplier = 1.0;
    const c = travelClass.toLowerCase();
    if (c.includes('business')) multiplier = 3.5;
    else if (c.includes('premium')) multiplier = 1.8;
    else if (c.includes('first')) multiplier = 8.0;

    const originalPrice = (airline.basePrice + (idx * 30)) * multiplier * passengers;
    const websitePrice = Math.round(originalPrice * 0.90);

    const depTimes = ['06:00', '08:45', '13:15', '17:30'];
    const arrTimes = ['09:15', '12:00', '16:30', '20:45'];
    const durations = ['3h 15m', '3h 15m', '3h 15m', '3h 15m'];
    const stops = idx === 0 ? 0 : 1;

    return {
      id: `mock-flight-${airline.code}-${idx}`,
      price: {
        total: websitePrice.toFixed(2),
        originalApiPrice: originalPrice.toFixed(2),
        currency: 'USD',
        formatted: `$${websitePrice.toFixed(2)}`
      },
      airline: airline.name,
      airline_logo: airline.logo,
      flightNumber: `${airline.code}${100 + Math.floor(Math.random() * 899)}`,
      departure: {
        airport: fromCode,
        city: searchParams.from.split('(')[0].trim(),
        time: depTimes[idx % depTimes.length],
        date: departureDate
      },
      arrival: {
        airport: toCode,
        city: searchParams.to.split('(')[0].trim(),
        time: arrTimes[idx % arrTimes.length],
        date: departureDate
      },
      duration: durations[idx % durations.length],
      stops: stops,
      layovers: stops > 0 ? [{ airportCode: 'ORD', airportName: 'Chicago O\'Hare International', duration: 45 }] : [],
      class: travelClass,
      aircraft: 'Boeing 737-800',
      fareType: 'Standard Cabin Select',
      refundableStatus: 'Non-Refundable',
      baggageAllowance: '1 Carry-on bag included'
    };
  });

  return {
    flights,
    meta: { count: flights.length, isMock: true }
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { from, to, departure, returnDate, adults, children, infants, travelClass, currency } = req.body || {};

    if (!from || !to || !departure) {
      return res.status(400).json({ error: 'Missing required parameters: from, to, departure' });
    }

    const searchParams = {
      from,
      to,
      departure,
      returnDate,
      adults: parseInt(adults || 1, 10),
      children: parseInt(children || 0, 10),
      infants: parseInt(infants || 0, 10),
      travelClass: travelClass || 'economy',
      currency: currency || 'USD'
    };

    const fromCode = extractAirportCode(searchParams.from);
    const toCode = extractAirportCode(searchParams.to);
    const cabinClass = mapTravelClass(searchParams.travelClass);
    const apiKey = process.env.SERPAPI_API_KEY || '8df31a2da9a24a9565d2fa7d5dcd096a5f5542c1a42e42cf9f5d604e17871498';

    const params = new URLSearchParams({
      engine: 'google_flights',
      departure_id: fromCode,
      arrival_id: toCode,
      outbound_date: searchParams.departure,
      type: searchParams.returnDate ? '1' : '2',
      travel_class: cabinClass,
      adults: searchParams.adults.toString(),
      api_key: apiKey,
      hl: 'en',
      gl: 'us',
      currency: searchParams.currency
    });

    if (searchParams.returnDate) {
      params.append('return_date', searchParams.returnDate);
    }
    if (searchParams.children > 0) {
      params.append('children', searchParams.children.toString());
    }
    if (searchParams.infants > 0) {
      params.append('infants_on_lap', searchParams.infants.toString());
    }

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'SerpAPI search request failed');
    }

    const formatted = formatSerpFlightOffers(data, searchParams);
    return res.status(200).json({
      success: true,
      data: formatted
    });

  } catch (error) {
    console.warn('Vercel serverless flight search failed, falling back to mock:', error.message);
    const mock = getMockFlightOffers(req.body || {});
    return res.status(200).json({
      success: true,
      data: mock
    });
  }
};
