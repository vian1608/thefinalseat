// API Configuration
export default {
  AMADEUS: {
    API_KEY: process.env.AMADEUS_API_KEY,
    API_SECRET: process.env.AMADEUS_API_SECRET,
    BASE_URL_TEST: 'https://test.api.amadeus.com',
    BASE_URL_PROD: 'https://api.amadeus.com',
    ENVIRONMENT: process.env.AMADEUS_ENVIRONMENT || 'test',
    ENDPOINTS: {
      TOKEN: '/v1/security/oauth2/token',
      FLIGHT_OFFERS: '/v2/shopping/flight-offers',
      AIRPORT_SEARCH: '/v1/reference-data/locations',
      FLIGHT_INSPIRATION: '/v1/shopping/flight-destinations'
    }
  },
  APP: {
    DEFAULT_PASSENGERS: 1,
    DEFAULT_CLASS: 'ECONOMY',
    MAX_RESULTS: 10,
    TOKEN_CACHE_DURATION: 3600000,
    REQUEST_TIMEOUT: 30000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
  }
};
