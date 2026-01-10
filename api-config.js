// API Configuration File
// Replace these values with your actual API credentials

const API_CONFIG = {
    // Amadeus API Configuration
    AMADEUS: {
        // Get these from https://developers.amadeus.com/
        API_KEY: 'xlSfGy4IHAM8w9wUcNIGWMyXOMoyA1bm',
        API_SECRET: 'L9bOsMiRwTlzN3yX',
        
        // Environment URLs
        BASE_URL_TEST: 'https://test.api.amadeus.com',
        BASE_URL_PROD: 'https://api.amadeus.com',
        
        // Current environment (change to 'production' when ready)
        ENVIRONMENT: 'test', // 'test' or 'production'
        
        // API Endpoints
        ENDPOINTS: {
            TOKEN: '/v1/security/oauth2/token',
            FLIGHT_OFFERS: '/v2/shopping/flight-offers',
            AIRPORT_SEARCH: '/v1/reference-data/locations',
            FLIGHT_INSPIRATION: '/v1/shopping/flight-destinations'
        }
    },

    // Application Settings
    APP: {
        // Default search parameters
        DEFAULT_PASSENGERS: 1,
        DEFAULT_CLASS: 'ECONOMY',
        MAX_RESULTS: 10,
        
        // Cache settings
        TOKEN_CACHE_DURATION: 3600000, // 1 hour in milliseconds
        
        // Request timeouts
        REQUEST_TIMEOUT: 30000, // 30 seconds
        
        // Retry settings
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000 // 1 second
    }
};

// Environment-specific configuration
const getAmadeusConfig = () => {
    const config = API_CONFIG.AMADEUS;
    return {
        apiKey: config.API_KEY,
        apiSecret: config.API_SECRET,
        baseURL: config.ENVIRONMENT === 'production' 
            ? config.BASE_URL_PROD 
            : config.BASE_URL_TEST,
        environment: config.ENVIRONMENT,
        endpoints: config.ENDPOINTS
    };
};

// Validation function
const validateAPIConfig = () => {
    const config = getAmadeusConfig();
    const errors = [];

    if (!config.apiKey || config.apiKey === 'YOUR_AMADEUS_API_KEY') {
        errors.push('Amadeus API Key is not configured');
    }

    if (!config.apiSecret || config.apiSecret === 'YOUR_AMADEUS_API_SECRET') {
        errors.push('Amadeus API Secret is not configured');
    }

    if (errors.length > 0) {
        console.warn('API Configuration Issues:', errors);
        return false;
    }

    return true;
};

// Export configuration
window.API_CONFIG = API_CONFIG;
window.getAmadeusConfig = getAmadeusConfig;
window.validateAPIConfig = validateAPIConfig;
