# Flight API Integration Documentation

## Overview

This document provides instructions for integrating real flight data into the Urgent Travel website using the Amadeus API. The integration includes fallback mechanisms to ensure the website continues to function even if the API is unavailable.

## API Provider: Amadeus

**Amadeus** is one of the world's leading providers of travel technology solutions and offers comprehensive flight search APIs.

### Why Amadeus?
- ✅ Official airline data from major carriers
- ✅ Real-time pricing and availability
- ✅ Comprehensive global coverage
- ✅ Reliable and well-documented API
- ✅ Free tier available for testing
- ✅ Production-ready with enterprise support

## Setup Instructions

### Step 1: Create Amadeus Developer Account

1. Visit [Amadeus Developer Portal](https://developers.amadeus.com/)
2. Click "Sign Up" to create a free account
3. Verify your email address
4. Complete the registration process

### Step 2: Create a New Application

1. Log in to the Amadeus Developer Portal
2. Navigate to "My Self-Service Workspace"
3. Click "Create New App"
4. Fill in the application details:
   - **App Name**: Urgent Travel Flight Search
   - **Description**: Flight search integration for urgent travel website
   - **Category**: Travel
   - **Callback URL**: `http://localhost` (for testing)

### Step 3: Get API Credentials

After creating the app, you'll receive:
- **API Key** (Client ID)
- **API Secret** (Client Secret)

### Step 4: Configure the Application

1. Open `api-config.js` in your project
2. Replace the placeholder values:

```javascript
const API_CONFIG = {
    AMADEUS: {
        API_KEY: 'YOUR_ACTUAL_API_KEY_HERE',
        API_SECRET: 'YOUR_ACTUAL_API_SECRET_HERE',
        ENVIRONMENT: 'test', // Change to 'production' when ready
        // ... rest of config
    }
};
```

### Step 5: Test the Integration

1. Open `index.html` in your browser
2. Try searching for flights
3. Check the browser console for any errors
4. Verify that real flight data is being returned

## API Endpoints Used

### 1. Authentication Token
- **Endpoint**: `/v1/security/oauth2/token`
- **Method**: POST
- **Purpose**: Get access token for API requests
- **Rate Limit**: 100 requests per hour

### 2. Flight Offers Search
- **Endpoint**: `/v2/shopping/flight-offers`
- **Method**: GET
- **Purpose**: Search for available flights
- **Rate Limit**: 2000 requests per month (free tier)

### 3. Airport Search
- **Endpoint**: `/v1/reference-data/locations`
- **Method**: GET
- **Purpose**: Get airport suggestions
- **Rate Limit**: 2000 requests per month (free tier)

### 4. Flight Inspiration
- **Endpoint**: `/v1/shopping/flight-destinations`
- **Method**: GET
- **Purpose**: Get popular destinations from origin
- **Rate Limit**: 2000 requests per month (free tier)

## Rate Limits and Pricing

### Free Tier (Test Environment)
- **Flight Offers**: 2,000 requests/month
- **Airport Search**: 2,000 requests/month
- **Flight Inspiration**: 2,000 requests/month
- **Environment**: Test only (not production data)

### Paid Plans
- **Self-Service**: Starting at $0.10 per request
- **Enterprise**: Custom pricing for high volume
- **Production Environment**: Real-time data

## Error Handling

The integration includes comprehensive error handling:

### 1. API Authentication Errors
- Automatic token refresh
- Fallback to mock data if authentication fails

### 2. Network Errors
- Retry mechanism with exponential backoff
- Graceful degradation to mock data

### 3. Rate Limit Errors
- Automatic retry with delays
- User notification about temporary unavailability

### 4. Data Validation
- Input validation before API calls
- Response data validation
- Fallback to mock data for invalid responses

## Fallback System

The application includes a robust fallback system:

1. **Primary**: Real Amadeus API data
2. **Secondary**: Mock flight data (if API fails)
3. **Tertiary**: Error message with retry option

## Security Considerations

### 1. API Key Protection
- Never expose API keys in client-side code for production
- Use environment variables or server-side proxy
- Implement proper CORS policies

### 2. Data Privacy
- Amadeus API doesn't store personal information
- All searches are anonymous
- No user data is transmitted to Amadeus

### 3. HTTPS Requirements
- Always use HTTPS in production
- API calls require secure connections

## Production Deployment

### 1. Environment Configuration
```javascript
// Change to production environment
ENVIRONMENT: 'production',
BASE_URL: 'https://api.amadeus.com'
```

### 2. Server-Side Proxy (Recommended)
For production, implement a server-side proxy to:
- Hide API credentials
- Implement rate limiting
- Add caching
- Handle CORS

### 3. Caching Strategy
- Cache flight results for 5-10 minutes
- Cache airport data for 24 hours
- Implement cache invalidation

## Alternative APIs

If Amadeus doesn't meet your needs, consider these alternatives:

### 1. FlightsAPI.io
- **Pros**: Easy integration, good documentation
- **Cons**: Limited free tier, higher costs
- **Best for**: Small to medium applications

### 2. SerpApi (Google Flights Scraping)
- **Pros**: Access to Google Flights data
- **Cons**: Scraping-based, less reliable
- **Best for**: Prototyping and testing

### 3. Skyscanner API
- **Pros**: Good coverage, competitive pricing
- **Cons**: Limited availability in some regions
- **Best for**: European markets

## Testing

### 1. Unit Tests
Test individual API functions:
```javascript
// Test airport search
const airports = await flightAPI.getAirportSuggestions('JFK');
console.assert(airports.length > 0, 'Should return airport suggestions');

// Test flight search
const flights = await flightAPI.searchFlights({
    from: 'JFK',
    to: 'LAX',
    departure: '2024-12-01'
});
console.assert(flights.length >= 0, 'Should return flight results');
```

### 2. Integration Tests
Test the complete flow:
1. User enters search criteria
2. API returns flight data
3. Results are displayed correctly
4. Fallback works when API fails

### 3. Load Testing
Test with multiple concurrent requests:
- Verify rate limit handling
- Check error handling under load
- Ensure graceful degradation

## Troubleshooting

### Common Issues

#### 1. "Invalid API Key" Error
- Verify API key is correct
- Check if key is properly configured
- Ensure you're using the right environment

#### 2. "Rate Limit Exceeded" Error
- Check your monthly usage
- Implement request caching
- Consider upgrading to paid plan

#### 3. "No Flights Found" Error
- Verify airport codes are valid
- Check date format (YYYY-MM-DD)
- Ensure dates are not in the past

#### 4. CORS Errors
- Implement server-side proxy
- Check browser console for errors
- Verify API endpoint URLs

### Debug Mode

Enable debug logging:
```javascript
// Add to api-config.js
const API_CONFIG = {
    APP: {
        DEBUG: true, // Enable debug logging
        // ... other config
    }
};
```

## Support and Resources

### Documentation
- [Amadeus API Documentation](https://developers.amadeus.com/)
- [Amadeus API Reference](https://developers.amadeus.com/self-service)
- [Amadeus Community](https://developers.amadeus.com/support)

### Community
- [Amadeus Developer Forum](https://developers.amadeus.com/support)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/amadeus-api)
- [GitHub Issues](https://github.com/amadeus4dev/amadeus-javascript)

### Contact
- **Email**: developers@amadeus.com
- **Support Portal**: [Amadeus Support](https://developers.amadeus.com/support)

## Conclusion

The Amadeus API integration provides a robust, scalable solution for flight search functionality. With proper configuration and error handling, it can handle production traffic while maintaining excellent user experience through fallback mechanisms.

Remember to:
- Keep API credentials secure
- Monitor usage and costs
- Implement proper caching
- Test thoroughly before production deployment
- Have a fallback plan for API outages
