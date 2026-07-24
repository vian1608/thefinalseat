import env from '../../config/env.mjs';
import { calculateFlightDiscount } from '../../shared/utils/pricing.helper.mjs';

class SerpApiService {
  constructor() {
    this.apiKey = env.serpapiApiKey || '';
  }

  extractAirportCode(input) {
    if (!input) return '';
    if (typeof input === 'object') {
      if (input.code) return input.code.toUpperCase();
      if (input.id) return input.id.toUpperCase();
    }
    const inputStr = String(input);
    const match = inputStr.match(/\(([A-Z]{3,4})\)/i);
    return match ? match[1].toUpperCase() : inputStr.trim().toUpperCase().substring(0, 3);
  }

  // Maps UI Cabin Class to SerpAPI travel_class code
  mapTravelClass(cabin) {
    const c = (cabin || 'economy').toLowerCase();
    if (c.includes('premium')) return '2';
    if (c.includes('business')) return '3';
    if (c.includes('first')) return '4';
    return '1'; // Economy default
  }

  // Autocomplete airports using SerpAPI google_flights_autocomplete engine
  async autocompleteAirports(query) {
    if (!query || query.length < 2) {
      return this.getMockAirportSuggestions(query || '');
    }

    const localResults = searchLocalAirports(query);

    let apiResults = [];
    if (this.apiKey) {
      try {
        const params = new URLSearchParams({
          engine: 'google_flights_autocomplete',
          q: query,
          api_key: this.apiKey,
          exclude_regions: 'true',
          hl: 'en',
          gl: 'us'
        });

        const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
        const data = await response.json();

        if (response.ok && data.suggestions) {
          data.suggestions.forEach(suggestion => {
            if (suggestion.type === 'airport' && suggestion.id) {
              const descInfo = parseDescription(suggestion.description);
              apiResults.push({
                code: suggestion.id.toUpperCase(),
                name: suggestion.name,
                city: descInfo.city,
                state: descInfo.state,
                country: descInfo.country
              });
            } else if (suggestion.type === 'city' && suggestion.airports) {
              suggestion.airports.forEach(airport => {
                if (airport.id) {
                  const descInfo = parseDescription(suggestion.name);
                  apiResults.push({
                    code: airport.id.toUpperCase(),
                    name: airport.name,
                    city: descInfo.city,
                    state: descInfo.state,
                    country: descInfo.country
                  });
                }
              });
            }
          });
        }
      } catch (error) {
        console.warn('SerpAPI autocomplete failed:', error.message);
      }
    }

    // Merge lists to avoid duplicates
    const mergedMap = new Map();
    localResults.forEach(item => {
      mergedMap.set(item.code, item);
    });

    apiResults.forEach(item => {
      if (!mergedMap.has(item.code)) {
        const matchingLocal = LOCAL_AIRPORTS.find(la => la.code === item.code);
        if (matchingLocal) {
          mergedMap.set(item.code, matchingLocal);
        } else {
          mergedMap.set(item.code, item);
        }
      }
    });

    const finalResults = Array.from(mergedMap.values());
    return finalResults.length > 0 ? finalResults : this.getMockAirportSuggestions(query);
  }

  // Search flights using SerpAPI google_flights engine
  async searchFlights(searchParams) {
    if (!this.apiKey) {
      console.warn('[SerpAPI Warning] SERPAPI_API_KEY environment variable is not configured. Returning offline mock offers.');
      return this.getMockFlightOffers(searchParams);
    }

    try {
      const fromCode = this.extractAirportCode(searchParams.from);
      const toCode = this.extractAirportCode(searchParams.to);
      const departureDate = searchParams.departure;
      const returnDate = searchParams.returnDate;
      const isRoundTrip = !!returnDate;
      
      const cabinClass = this.mapTravelClass(searchParams.travelClass);
      
      const adults = parseInt(searchParams.adults || 1, 10);
      const children = parseInt(searchParams.children || 0, 10);
      const infants = parseInt(searchParams.infants || 0, 10);

      const params = new URLSearchParams({
        engine: 'google_flights',
        departure_id: fromCode,
        arrival_id: toCode,
        outbound_date: departureDate,
        type: isRoundTrip ? '1' : '2',
        travel_class: cabinClass,
        adults: adults.toString(),
        api_key: this.apiKey,
        hl: 'en',
        gl: 'us',
        currency: searchParams.currency || 'USD'
      });

      if (isRoundTrip) {
        params.append('return_date', returnDate);
      }
      if (children > 0) {
        params.append('children', children.toString());
      }
      if (infants > 0) {
        params.append('infants_on_lap', infants.toString());
      }

      const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'SerpAPI flight search request failed');
      }

      return this.formatSerpFlightOffers(data, searchParams);
    } catch (error) {
      console.warn('[SerpAPI Notice] Live flight search notice:', error.message);
      return this.getMockFlightOffers(searchParams);
    }
  }

  formatSerpFlightOffers(data, searchParams) {
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

      // Calculate 10% discount using pricing helper
      const rawOriginalPrice = parseFloat(itinerary.price || 0);
      const priceCalc = calculateFlightDiscount({
        originalPrice: rawOriginalPrice,
        isMock: false,
        currency: searchParams.currency || 'USD'
      });

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
        isMock: false,
        price: {
          total: priceCalc.finalPrice,
          originalApiPrice: priceCalc.originalPrice,
          discountPercent: priceCalc.discountPercent,
          discountAmount: priceCalc.discountAmount,
          finalPrice: priceCalc.finalPrice,
          currency: priceCalc.currency,
          formatted: priceCalc.formattedFinal,
          formattedOriginal: priceCalc.formattedOriginal,
          formattedDiscount: priceCalc.formattedDiscount
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

  // Mock Flight offers fallback generator
  getMockFlightOffers(searchParams) {
    const fromCode = this.extractAirportCode(searchParams.from);
    const toCode = this.extractAirportCode(searchParams.to);
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

      const rawPrice = (airline.basePrice + (idx * 30)) * multiplier * passengers;
      const priceCalc = calculateFlightDiscount({
        originalPrice: rawPrice,
        isMock: true,
        currency: 'USD'
      });

      const depTimes = ['06:00', '08:45', '13:15', '17:30'];
      const arrTimes = ['09:15', '12:00', '16:30', '20:45'];
      const durations = ['3h 15m', '3h 15m', '3h 15m', '3h 15m'];
      const stops = idx === 0 ? 0 : 1;

      return {
        id: `mock-flight-${airline.code}-${idx}`,
        isMock: true,
        price: {
          total: priceCalc.finalPrice,
          originalApiPrice: priceCalc.originalPrice,
          discountPercent: 0,
          discountAmount: '0.00',
          finalPrice: priceCalc.finalPrice,
          currency: priceCalc.currency,
          formatted: priceCalc.formattedFinal,
          formattedOriginal: priceCalc.formattedOriginal,
          formattedDiscount: '$0.00'
        },
        airline: airline.name,
        airline_logo: airline.logo,
        flightNumber: `${airline.code}${100 + Math.floor(Math.random() * 899)}`,
        departure: {
          airport: fromCode,
          city: (searchParams.from || 'Origin').split('(')[0].trim(),
          time: depTimes[idx % depTimes.length],
          date: departureDate
        },
        arrival: {
          airport: toCode,
          city: (searchParams.to || 'Destination').split('(')[0].trim(),
          time: arrTimes[idx % arrTimes.length],
          date: departureDate
        },
        duration: durations[idx % durations.length],
        stops: stops,
        layovers: stops > 0 ? [{ airportCode: 'ORD', airportName: 'Chicago O\'Hare International', duration: 45 }] : [],
        class: travelClass,
        aircraft: idx % 2 === 0 ? 'Boeing 737-800' : 'Airbus A320',
        fareType: 'Standard Cabin',
        refundableStatus: 'Unavailable Online / Call Desk',
        baggageAllowance: '1 Carry-on Included'
      };
    });

    return {
      flights,
      meta: { count: flights.length, isMock: true }
    };
  }

  getMockAirportSuggestions(query) {
    const q = (query || '').toLowerCase();
    return LOCAL_AIRPORTS.filter(
      item =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q)
    );
  }
}

// Local airports dictionary helper
const LOCAL_AIRPORTS = [
  { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', state: 'NY', country: 'United States' },
  { code: 'LGA', name: 'LaGuardia Airport', city: 'New York', state: 'NY', country: 'United States' },
  { code: 'EWR', name: 'Newark Liberty International', city: 'Newark', state: 'NJ', country: 'United States' },
  { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', state: 'CA', country: 'United States' },
  { code: 'SFO', name: 'San Francisco International', city: 'San Francisco', state: 'CA', country: 'United States' },
  { code: 'MIA', name: 'Miami International', city: 'Miami', state: 'FL', country: 'United States' },
  { code: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', state: 'WA', country: 'United States' },
  { code: 'ORD', name: 'Chicago O\'Hare International', city: 'Chicago', state: 'IL', country: 'United States' },
  { code: 'BOS', name: 'Boston Logan International', city: 'Boston', state: 'MA', country: 'United States' },
  { code: 'IAD', name: 'Washington Dulles International', city: 'Washington', state: 'DC', country: 'United States' },
  { code: 'DCA', name: 'Ronald Reagan Washington National', city: 'Washington', state: 'DC', country: 'United States' },
  { code: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', state: 'TX', country: 'United States' },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', state: 'GA', country: 'United States' }
];

function searchLocalAirports(query) {
  const q = query.toLowerCase().trim();
  return LOCAL_AIRPORTS.filter(
    item =>
      item.code.toLowerCase() === q ||
      item.code.toLowerCase().startsWith(q) ||
      item.city.toLowerCase().startsWith(q) ||
      item.name.toLowerCase().includes(q)
  );
}

function parseDescription(desc) {
  if (!desc) return { city: '', state: '', country: 'United States' };
  const parts = desc.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1], country: parts[2] || 'United States' };
  }
  return { city: desc, state: '', country: 'United States' };
}

export const serpapiService = new SerpApiService();
export default serpapiService;
