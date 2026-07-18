import dotenv from 'dotenv';
dotenv.config();

class SerpApiService {
  constructor() {
    this.apiKey = process.env.SERPAPI_API_KEY || '8df31a2da9a24a9565d2fa7d5dcd096a5f5542c1a42e42cf9f5d604e17871498';
  }

  // Helper to extract IATA code from "City Name (IATA)" format
  extractAirportCode(input) {
    if (!input) return '';
    const match = input.match(/\(([A-Z]{3,4})\)/i);
    return match ? match[1].toUpperCase() : input.trim().toUpperCase().substring(0, 3);
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

      if (!response.ok || !data.suggestions) {
        throw new Error(data.error || 'SerpAPI autocomplete request failed');
      }

      const formatted = [];
      data.suggestions.forEach(suggestion => {
        if (suggestion.type === 'airport' && suggestion.id) {
          formatted.push({
            code: suggestion.id,
            name: suggestion.name,
            city: suggestion.description || '',
            country: '',
            display: `${suggestion.name} (${suggestion.id})`
          });
        } else if (suggestion.type === 'city' && suggestion.airports) {
          suggestion.airports.forEach(airport => {
            if (airport.id) {
              formatted.push({
                code: airport.id,
                name: airport.name,
                city: suggestion.name.split(',')[0].trim(),
                country: suggestion.name.split(',')[1]?.trim() || '',
                display: `${airport.name} (${airport.id})`
              });
            }
          });
        }
      });

      // If no valid suggestions were parsed, fall back to mock data
      return formatted.length > 0 ? formatted : this.getMockAirportSuggestions(query);
    } catch (error) {
      console.warn('SerpAPI autocomplete failed, falling back to mock suggestions:', error.message);
      return this.getMockAirportSuggestions(query);
    }
  }

  // Search flights using SerpAPI google_flights engine
  async searchFlights(searchParams) {
    try {
      const fromCode = this.extractAirportCode(searchParams.from);
      const toCode = this.extractAirportCode(searchParams.to);
      const departureDate = searchParams.departure;
      const returnDate = searchParams.returnDate;
      const isRoundTrip = !!returnDate;
      
      const cabinClass = this.mapTravelClass(searchParams.travelClass);
      
      // Parse passenger counts
      const adults = parseInt(searchParams.adults || 1, 10);
      const children = parseInt(searchParams.children || 0, 10);
      const infants = parseInt(searchParams.infants || 0, 10);

      const params = new URLSearchParams({
        engine: 'google_flights',
        departure_id: fromCode,
        arrival_id: toCode,
        outbound_date: departureDate,
        type: isRoundTrip ? '1' : '2', // 1 = roundtrip, 2 = oneway
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
        // google_flights uses infants_on_lap by default
        params.append('infants_on_lap', infants.toString());
      }

      const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'SerpAPI flight search request failed');
      }

      return this.formatSerpFlightOffers(data, searchParams);
    } catch (error) {
      console.warn('SerpAPI search failed, falling back to mock flights:', error.message);
      return this.getMockFlightOffers(searchParams);
    }
  }

  // Format SerpAPI response to our frontend expected schema, applying the 0.90 discount rule
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
      
      // Calculatestops and layovers
      const stopsCount = segments.length - 1;
      const layovers = (itinerary.layovers || []).map(layover => ({
        airportCode: layover.id,
        airportName: layover.name,
        duration: layover.duration // in minutes
      }));

      // Price logic: Website Price = Original Price * 0.90
      const originalPrice = parseFloat(itinerary.price || 0);
      const websitePrice = Math.round(originalPrice * 0.90);

      // Extract duration in minutes and format to "Xh Ym"
      const totalDurationMin = itinerary.total_duration || segments.reduce((sum, s) => sum + (s.duration || 0), 0);
      const hours = Math.floor(totalDurationMin / 60);
      const minutes = totalDurationMin % 60;
      const durationStr = `${hours}h ${minutes}m`;

      // Extract airline details from first segment
      const airlineName = firstSeg.airline || 'Unknown Airline';
      const flightNumber = segments.map(s => s.flight_number || '').filter(Boolean).join(', ') || 'N/A';
      
      // Format dates & times
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

  // Fallback airport suggestions
  getMockAirportSuggestions(query) {
    const mockAirports = [
      { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'United States' },
      { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'United States' },
      { code: 'LHR', name: 'London Heathrow', city: 'London', country: 'United Kingdom' },
      { code: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France' },
      { code: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE' },
      { code: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore' },
      { code: 'NRT', name: 'Narita International', city: 'Tokyo', country: 'Japan' },
      { code: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia' }
    ];

    if (!query) {
      return mockAirports.map(airport => ({
        ...airport,
        display: `${airport.city} (${airport.code}) - ${airport.name}`
      }));
    }

    const q = query.toLowerCase();
    return mockAirports.filter(airport => 
      airport.code.toLowerCase().includes(q) ||
      airport.name.toLowerCase().includes(q) ||
      airport.city.toLowerCase().includes(q)
    ).map(airport => ({
      ...airport,
      display: `${airport.city} (${airport.code}) - ${airport.name}`
    }));
  }
}

export default new SerpApiService();
