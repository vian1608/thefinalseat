const axios = require('axios');
const config = require('../config/api-config');

class AmadeusService {
  constructor() {
    this.apiKey = config.AMADEUS.API_KEY;
    this.apiSecret = config.AMADEUS.API_SECRET;
    this.baseURL = config.AMADEUS.ENVIRONMENT === 'production' 
      ? config.AMADEUS.BASE_URL_PROD 
      : config.AMADEUS.BASE_URL_TEST;
    this.endpoints = config.AMADEUS.ENDPOINTS;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get access token for API authentication
  async getAccessToken() {
    try {
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const response = await axios.post(
        `${this.baseURL}${this.endpoints.TOKEN}`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.apiKey,
          client_secret: this.apiSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Amadeus API');
    }
  }

  // Extract airport code from input (handles "City (CODE)" format)
  extractAirportCode(input) {
    if (!input) return '';
    const match = input.match(/\(([A-Z]{3})\)/);
    return match ? match[1] : input.trim().toUpperCase().substring(0, 3);
  }

  // Search for flights
  async searchFlights(searchParams) {
    try {
      const token = await this.getAccessToken();
      
      const fromCode = this.extractAirportCode(searchParams.from);
      const toCode = this.extractAirportCode(searchParams.to);

      const params = {
        originLocationCode: fromCode,
        destinationLocationCode: toCode,
        departureDate: searchParams.departure,
        adults: searchParams.passengers || 1,
        max: searchParams.maxResults || 10
      };

      if (searchParams.returnDate) {
        params.returnDate = searchParams.returnDate;
      }

      if (searchParams.travelClass) {
        params.travelClass = searchParams.travelClass;
      }

      const response = await axios.get(
        `${this.baseURL}${this.endpoints.FLIGHT_OFFERS}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          params
        }
      );

      return this.formatFlightOffers(response.data);
    } catch (error) {
      console.error('Error searching flights:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to search flights');
    }
  }

  // Format flight offers from Amadeus API
  formatFlightOffers(data) {
    if (!data || !data.data) {
      return { flights: [], meta: {} };
    }

    const flights = data.data.map((offer, offerIndex) => {
      const itineraries = offer.itineraries || [];
      
      return itineraries.map((itinerary, itineraryIndex) => {
        const segments = itinerary.segments || [];
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];

        // Format price in USD
        const formatPrice = (priceObj) => {
          if (!priceObj || !priceObj.total) {
            return { total: '0.00', currency: 'USD', formatted: '$0.00' };
          }
          const total = parseFloat(priceObj.total);
          if (isNaN(total)) {
            return { ...priceObj, formatted: 'N/A' };
          }
          return {
            total: total.toFixed(2),
            currency: 'USD',
            formatted: `$${total.toFixed(2)}`
          };
        };

        return {
          id: offer.id || `flight-${offerIndex}-${itineraryIndex}`,
          price: formatPrice(offer.price),
          airline: firstSegment?.carrierCode || 'Unknown',
          flightNumber: segments.map(s => `${s.carrierCode}${s.number}`).join(', '),
          departure: {
            airport: firstSegment?.departure?.iataCode || '',
            city: firstSegment?.departure?.iataCode || '',
            time: firstSegment?.departure?.at?.split('T')[1]?.substring(0, 5) || '',
            date: firstSegment?.departure?.at?.split('T')[0] || ''
          },
          arrival: {
            airport: lastSegment?.arrival?.iataCode || '',
            city: lastSegment?.arrival?.iataCode || '',
            time: lastSegment?.arrival?.at?.split('T')[1]?.substring(0, 5) || '',
            date: lastSegment?.arrival?.at?.split('T')[0] || ''
          },
          duration: itinerary.duration || '',
          stops: segments.length - 1,
          class: offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || 'ECONOMY',
          aircraft: segments[0]?.aircraft?.code || 'Unknown',
          segments: segments.map(segment => ({
            departure: {
              airport: segment.departure?.iataCode,
              time: segment.departure?.at
            },
            arrival: {
              airport: segment.arrival?.iataCode,
              time: segment.arrival?.at
            },
            carrier: segment.carrierCode,
            number: segment.number,
            duration: segment.duration
          }))
        };
      });
    }).flat();

    return {
      flights,
      meta: data.meta || {}
    };
  }

  // Search for airports
  async searchAirports(query) {
    try {
      const token = await this.getAccessToken();
      
      const params = {
        subType: 'AIRPORT',
        keyword: query,
        'page[limit]': 10
      };

      const response = await axios.get(
        `${this.baseURL}${this.endpoints.AIRPORT_SEARCH}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          params
        }
      );

      return this.formatAirportSuggestions(response.data);
    } catch (error) {
      console.error('Error searching airports:', error.response?.data || error.message);
      // Return mock data as fallback
      return this.getMockAirportSuggestions(query);
    }
  }

  // Format airport suggestions
  formatAirportSuggestions(data) {
    if (!data || !data.data) {
      return this.getMockAirportSuggestions('');
    }

    return data.data.map(airport => ({
      code: airport.iataCode,
      name: airport.name,
      city: airport.address?.cityName || '',
      country: airport.address?.countryName || '',
      display: `${airport.name} (${airport.iataCode})`
    }));
  }

  // Mock airport suggestions (fallback)
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

    if (!query) return mockAirports;

    const queryLower = query.toLowerCase();
    return mockAirports.filter(airport => 
      airport.code.toLowerCase().includes(queryLower) ||
      airport.name.toLowerCase().includes(queryLower) ||
      airport.city.toLowerCase().includes(queryLower)
    ).map(airport => ({
      ...airport,
      display: `${airport.name} (${airport.code})`
    }));
  }
}

module.exports = new AmadeusService();
