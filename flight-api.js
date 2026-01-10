// Flight API Integration using Amadeus API
// Note: You'll need to sign up at https://developers.amadeus.com/ to get API credentials

class FlightAPI {
    constructor() {
        // Get configuration from api-config.js
        const config = window.getAmadeusConfig ? window.getAmadeusConfig() : null;
        
        if (config) {
            this.apiKey = config.apiKey;
            this.apiSecret = config.apiSecret;
            this.baseURL = config.baseURL;
            this.environment = config.environment;
            this.endpoints = config.endpoints;
        } else {
            // Fallback if config not loaded
            this.apiKey = 'YOUR_AMADEUS_API_KEY';
            this.apiSecret = 'YOUR_AMADEUS_API_SECRET';
            this.baseURL = 'https://test.api.amadeus.com';
            this.endpoints = {
                TOKEN: '/v1/security/oauth2/token',
                FLIGHT_OFFERS: '/v2/shopping/flight-offers',
                AIRPORT_SEARCH: '/v1/reference-data/locations',
                FLIGHT_INSPIRATION: '/v1/shopping/flight-destinations'
            };
        }
        
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    // Get access token for API authentication
    async getAccessToken() {
        try {
            console.log('Attempting to get access token...');
            console.log('API Key:', this.apiKey ? 'Present' : 'Missing');
            console.log('API Secret:', this.apiSecret ? 'Present' : 'Missing');
            
            const tokenEndpoint = this.endpoints?.TOKEN || '/v1/security/oauth2/token';
            const response = await fetch(`${this.baseURL}${tokenEndpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: this.apiKey,
                    client_secret: this.apiSecret
                })
            });

            console.log('Token response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Token request failed:', response.status, errorText);
                throw new Error(`Token request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('Token received successfully');
            
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);
            
            return this.accessToken;
        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    }

    // Check if token is valid and refresh if needed
    async ensureValidToken() {
        if (!this.accessToken || Date.now() >= this.tokenExpiry) {
            await this.getAccessToken();
        }
        return this.accessToken;
    }

    // Search for flights
    async searchFlights(searchParams) {
        try {
            console.log('🔍 Starting flight search with params:', searchParams);
            await this.ensureValidToken();

            // Convert airport codes (remove city names if present)
            const fromCode = this.extractAirportCode(searchParams.from);
            const toCode = this.extractAirportCode(searchParams.to);
            
            console.log('✈️ Airport codes:', { from: fromCode, to: toCode });

            const params = new URLSearchParams({
                originLocationCode: fromCode,
                destinationLocationCode: toCode,
                departureDate: searchParams.departure,
                adults: searchParams.passengers || 1,
                max: searchParams.maxResults || 10
            });

            // Add return date for round trip
            if (searchParams.return) {
                params.append('returnDate', searchParams.return);
            }

            // Add travel class
            if (searchParams.class) {
                params.append('travelClass', searchParams.class.toUpperCase());
            }

            const flightOffersEndpoint = this.endpoints?.FLIGHT_OFFERS || '/v2/shopping/flight-offers';
            console.log('📡 Making API request to:', `${this.baseURL}${flightOffersEndpoint}?${params}`);

            const response = await fetch(`${this.baseURL}${flightOffersEndpoint}?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 API Response Status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Flight search failed:', response.status, errorText);
                throw new Error(`Flight search failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ API Response received:', data);
            
            const processedFlights = this.processFlightData(data);
            console.log('🛫 Processed flights:', processedFlights.length);
            
            return processedFlights;
        } catch (error) {
            console.error('❌ Error searching flights:', error);
            throw error;
        }
    }

    // Extract airport code from input (e.g., "IAD - Washington Dulles" -> "IAD")
    extractAirportCode(input) {
        if (!input) return '';
        
        // If it's already just a code (3 letters), return it
        if (/^[A-Z]{3}$/.test(input.trim())) {
            return input.trim();
        }
        
        // Extract code from format "CODE - Airport Name"
        const match = input.match(/^([A-Z]{3})\s*-/);
        if (match) {
            return match[1];
        }
        
        // If no pattern matches, return the input as-is
        return input.trim();
    }

    // Process flight data from API response
    processFlightData(apiData) {
        const flights = [];
        
        console.log('📊 Processing API data:', apiData);
        
        if (!apiData.data || !Array.isArray(apiData.data)) {
            console.warn('⚠️ No flight data found in API response');
            return flights;
        }

        if (apiData.data.length === 0) {
            console.warn('⚠️ API returned empty flight results');
            return flights;
        }

        apiData.data.forEach((offer, offerIndex) => {
            console.log(`🛫 Processing offer ${offerIndex + 1}:`, offer);
            
            if (!offer.itineraries || !Array.isArray(offer.itineraries)) {
                console.warn(`⚠️ No itineraries found in offer ${offerIndex + 1}`);
                return;
            }

            offer.itineraries.forEach((itinerary, itineraryIndex) => {
                console.log(`✈️ Processing itinerary ${itineraryIndex + 1}:`, itinerary);
                
                if (!itinerary.segments || !Array.isArray(itinerary.segments)) {
                    console.warn(`⚠️ No segments found in itinerary ${itineraryIndex + 1}`);
                    return;
                }

                // Format price in USD
                const formatPrice = (priceObj) => {
                    if (!priceObj || !priceObj.total) return { total: '$0.00', currency: 'USD', formatted: '$0.00' };
                    const total = parseFloat(priceObj.total);
                    const currency = priceObj.currency || 'USD';
                    
                    if (isNaN(total)) {
                        return { ...priceObj, formatted: 'N/A' };
                    }
                    
                    // Always format as USD
                    return {
                        total: total.toFixed(2),
                        currency: 'USD',
                        formatted: `$${total.toFixed(2)}`
                    };
                };
                
                const flight = {
                    id: offer.id || `flight-${offerIndex}-${itineraryIndex}`,
                    price: formatPrice(offer.price || { total: '0', currency: 'USD' }),
                    itineraries: itinerary.segments.map((segment, segmentIndex) => {
                        console.log(`🛬 Processing segment ${segmentIndex + 1}:`, segment);
                        
                        return {
                            departure: {
                                airport: segment.departure?.iataCode || 'N/A',
                                terminal: segment.departure?.terminal || '',
                                time: segment.departure?.at || 'N/A'
                            },
                            arrival: {
                                airport: segment.arrival?.iataCode || 'N/A',
                                terminal: segment.arrival?.terminal || '',
                                time: segment.arrival?.at || 'N/A'
                            },
                            duration: segment.duration || 'N/A',
                            carrier: segment.carrierCode || 'N/A',
                            flightNumber: segment.number || 'N/A',
                            aircraft: segment.aircraft?.code || 'N/A',
                            stops: segment.stops || 0
                        };
                    }),
                    totalDuration: itinerary.duration || 'N/A',
                    stops: itinerary.segments.length - 1,
                    urgent: this.isUrgentFlight(itinerary.segments[0])
                };
                
                console.log('✅ Created flight object:', flight);
                flights.push(flight);
            });
        });

        console.log(`🎉 Successfully processed ${flights.length} flights`);
        return flights;
    }

    // Check if flight is urgent (departing within 24 hours)
    isUrgentFlight(firstSegment) {
        const departureTime = new Date(firstSegment.departure.at);
        const now = new Date();
        const hoursUntilDeparture = (departureTime - now) / (1000 * 60 * 60);
        return hoursUntilDeparture <= 24 && hoursUntilDeparture > 0;
    }

    // Get airport suggestions
    async getAirportSuggestions(query) {
        try {
            await this.ensureValidToken();

            const params = new URLSearchParams({
                subType: 'AIRPORT',
                keyword: query,
                'page[limit]': 10
            });

            const airportEndpoint = this.endpoints?.AIRPORT_SEARCH || '/v1/reference-data/locations';
            const response = await fetch(`${this.baseURL}${airportEndpoint}?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Airport search failed: ${response.status}`);
            }

            const data = await response.json();
            return this.processAirportData(data);
        } catch (error) {
            console.error('Error getting airport suggestions:', error);
            throw error;
        }
    }

    // Process airport data
    processAirportData(apiData) {
        const airports = [];
        
        if (!apiData.data || !Array.isArray(apiData.data)) {
            return airports;
        }

        apiData.data.forEach(location => {
            airports.push({
                code: location.iataCode,
                name: location.name,
                city: location.address?.cityName,
                country: location.address?.countryName,
                displayName: `${location.iataCode} - ${location.name}`
            });
        });

        return airports;
    }

    // Get flight offers for inspiration (popular destinations)
    async getFlightInspiration(origin) {
        try {
            await this.ensureValidToken();

            const params = new URLSearchParams({
                origin: origin,
                maxPrice: 500, // Maximum price in USD
                viewBy: 'DURATION'
            });

            const inspirationEndpoint = this.endpoints?.FLIGHT_INSPIRATION || '/v1/shopping/flight-destinations';
            const response = await fetch(`${this.baseURL}${inspirationEndpoint}?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Flight inspiration failed: ${response.status}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('Error getting flight inspiration:', error);
            throw error;
        }
    }
}

// Initialize Flight API
const flightAPI = new FlightAPI();

// Make it globally available
window.flightAPI = flightAPI;

// Enhanced flight search functionality
class FlightSearchManager {
    constructor() {
        this.isSearching = false;
        this.currentSearchParams = null;
    }

    // Main search function
    async searchFlights(searchParams) {
        if (this.isSearching) {
            return;
        }

        this.isSearching = true;
        this.currentSearchParams = searchParams;

        try {
            // Validate search parameters
            this.validateSearchParams(searchParams);

            // Show loading state
            this.showLoadingState();

            // Search flights using API
            const flights = await flightAPI.searchFlights(searchParams);

            // Display results
            this.displayFlightResults(flights, searchParams);
            
            // Attach event listeners to book buttons in modal
            const modal = document.body.querySelector('.flight-results-modal');
            if (modal) {
                this.setupFlightModalButtons(modal);
            }

        } catch (error) {
            console.error('Flight search error:', error);
            this.handleSearchError(error);
        } finally {
            this.isSearching = false;
            this.hideLoadingState();
        }
    }

    // Validate search parameters
    validateSearchParams(params) {
        const required = ['from', 'to', 'departure'];
        const missing = required.filter(field => !params[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        // Validate dates
        const departureDate = new Date(params.departure);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (departureDate < today) {
            throw new Error('Departure date cannot be in the past');
        }

        if (params.return) {
            const returnDate = new Date(params.return);
            if (returnDate <= departureDate) {
                throw new Error('Return date must be after departure date');
            }
        }
    }

    // Display flight results
    displayFlightResults(flights, searchParams) {
        if (flights.length === 0) {
            this.showNoResultsMessage();
            return;
        }

        // Create results modal
        const modal = this.createResultsModal(flights, searchParams);
        document.body.appendChild(modal);

        // Add close functionality
        this.setupModalCloseHandlers(modal);
    }

    // Create results modal
    createResultsModal(flights, searchParams) {
        const modal = document.createElement('div');
        modal.className = 'flight-results-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                border-radius: 20px;
                padding: 2rem;
                max-width: 1000px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                animation: fadeIn 0.3s ease-out;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2 style="color: #1e293b; font-size: 1.8rem;">Flight Search Results</h2>
                    <button class="close-modal" style="
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        cursor: pointer;
                        color: #64748b;
                    ">&times;</button>
                </div>
                <div class="search-summary" style="
                    background: #f8fafc;
                    padding: 1.5rem;
                    border-radius: 12px;
                    margin-bottom: 2rem;
                ">
                    <h3 style="margin-bottom: 1rem; color: #374151;">Trip Details</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div><strong>From:</strong> ${searchParams.from}</div>
                        <div><strong>To:</strong> ${searchParams.to}</div>
                        <div><strong>Departure:</strong> ${this.formatDate(searchParams.departure)}</div>
                        ${searchParams.return ? `<div><strong>Return:</strong> ${this.formatDate(searchParams.return)}</div>` : ''}
                        <div><strong>Passengers:</strong> ${searchParams.passengers}</div>
                        <div><strong>Class:</strong> ${searchParams.class}</div>
                    </div>
                </div>
                <div class="flight-results">
                    ${this.generateFlightResultsHTML(flights)}
                </div>
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="close-modal-btn" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 1rem 2rem;
                        border-radius: 12px;
                        font-weight: 600;
                        cursor: pointer;
                    ">Close</button>
                </div>
            </div>
        `;

        return modal;
    }

    // Generate flight results HTML
    generateFlightResultsHTML(flights) {
        return flights.map(flight => `
            <div class="flight-result" style="
                border: 2px solid ${flight.urgent ? '#f59e0b' : '#e5e7eb'};
                border-radius: 12px;
                padding: 1.5rem;
                margin-bottom: 1rem;
                background: ${flight.urgent ? '#fef3c7' : 'white'};
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h4 style="color: #1e293b; margin-bottom: 0.5rem;">${this.getAirlineName(flight.itineraries[0].carrier)}</h4>
                        <p style="color: #64748b; font-size: 0.9rem;">${flight.itineraries[0].carrier} ${flight.itineraries[0].flightNumber}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #1e293b;">${flight.price.formatted || `$${parseFloat(flight.price.total || 0).toFixed(2)}`}</div>
                        ${flight.urgent ? '<div style="color: #f59e0b; font-weight: 600; font-size: 0.8rem;">URGENT</div>' : ''}
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <div style="font-weight: 600; color: #374151;">Departure</div>
                        <div style="color: #64748b;">${this.formatTime(flight.itineraries[0].departure.time)}</div>
                        <div style="color: #64748b; font-size: 0.8rem;">${flight.itineraries[0].departure.airport}</div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #374151;">Arrival</div>
                        <div style="color: #64748b;">${this.formatTime(flight.itineraries[flight.itineraries.length - 1].arrival.time)}</div>
                        <div style="color: #64748b; font-size: 0.8rem;">${flight.itineraries[flight.itineraries.length - 1].arrival.airport}</div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #374151;">Duration</div>
                        <div style="color: #64748b;">${this.formatDuration(flight.totalDuration)}</div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #374151;">Stops</div>
                        <div style="color: #64748b;">${flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}</div>
                    </div>
                </div>
                <div style="text-align: center;">
                    <button class="book-flight-btn" data-flight-id="${flight.id}" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        margin-right: 1rem;
                    ">Book Now</button>
                    <button class="view-flight-details-btn" data-flight-id="${flight.id}" style="
                        background: white;
                        color: #667eea;
                        border: 2px solid #667eea;
                        padding: 0.75rem 1.5rem;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                    ">View Details</button>
                </div>
            </div>
        `).join('');
    }

    // Utility functions
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    formatTime(timeString) {
        const date = new Date(timeString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    formatDuration(duration) {
        return duration.replace('PT', '').replace('H', 'h ').replace('M', 'm');
    }

    getAirlineName(carrierCode) {
        const airlines = {
            'AA': 'American Airlines',
            'DL': 'Delta Airlines',
            'UA': 'United Airlines',
            'WN': 'Southwest Airlines',
            'B6': 'JetBlue Airways',
            'NK': 'Spirit Airlines',
            'F9': 'Frontier Airlines',
            'AS': 'Alaska Airlines'
        };
        return airlines[carrierCode] || carrierCode;
    }

    // Error handling
    handleSearchError(error) {
        let message = 'An error occurred while searching for flights.';
        
        if (error.message.includes('Missing required fields')) {
            message = 'Please fill in all required fields.';
        } else if (error.message.includes('date')) {
            message = 'Please check your travel dates.';
        } else if (error.message.includes('Token')) {
            message = 'API authentication failed. Please try again later.';
        }

        showNotification(message, 'error');
    }

    showNoResultsMessage() {
        showNotification('No flights found for your search criteria. Please try different dates or destinations.', 'warning');
    }

    showLoadingState() {
        const searchBtn = document.querySelector('.search-btn');
        if (searchBtn) {
            searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching Flights...';
            searchBtn.disabled = true;
        }
    }

    hideLoadingState() {
        const searchBtn = document.querySelector('.search-btn');
        if (searchBtn) {
            searchBtn.innerHTML = '<i class="fas fa-search"></i> Search Emergency Flights';
            searchBtn.disabled = false;
        }
    }

    setupModalCloseHandlers(modal) {
        const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    setupFlightModalButtons(modal) {
        // Attach listeners to book buttons
        const bookButtons = modal.querySelectorAll('.book-flight-btn[data-flight-id]');
        bookButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const flightId = this.getAttribute('data-flight-id');
                if (window.bookFlight) {
                    window.bookFlight(flightId, 'outbound');
                }
                modal.remove();
            });
        });
        
        // Attach listeners to view details buttons
        const viewButtons = modal.querySelectorAll('.view-flight-details-btn[data-flight-id]');
        viewButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const flightId = this.getAttribute('data-flight-id');
                if (window.viewFlightDetails) {
                    window.viewFlightDetails(flightId);
                }
            });
        });
    }
}

// Initialize flight search manager
const flightSearchManager = new FlightSearchManager();

// Global functions for flight actions
window.bookFlight = function(flightId) {
    showNotification('Redirecting to booking page...', 'info');
    // In a real application, redirect to booking page with flight ID
    setTimeout(() => {
        window.location.href = `booking.html?flightId=${flightId}`;
    }, 1500);
};

window.viewFlightDetails = function(flightId) {
    showNotification('Loading flight details...', 'info');
    // In a real application, show detailed flight information
};

// Enhanced airport suggestions with API
async function getAirportSuggestionsFromAPI(query) {
    try {
        const airports = await flightAPI.getAirportSuggestions(query);
        return airports;
    } catch (error) {
        console.error('Error getting airport suggestions:', error);
        // Fallback to mock data
        return getMockAirportSuggestions(query);
    }
}

// Mock airport data as fallback
function getMockAirportSuggestions(query) {
    const airports = [
        { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York' },
        { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles' },
        { code: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago' },
        { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas' },
        { code: 'DEN', name: 'Denver International Airport', city: 'Denver' },
        { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco' },
        { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle' },
        { code: 'MIA', name: 'Miami International Airport', city: 'Miami' },
        { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta' },
        { code: 'LAS', name: 'McCarran International Airport', city: 'Las Vegas' }
    ];
    
    return airports.filter(airport => 
        airport.code.toLowerCase().includes(query.toLowerCase()) ||
        airport.city.toLowerCase().includes(query.toLowerCase()) ||
        airport.name.toLowerCase().includes(query.toLowerCase())
    );
}

// Export for use in main script
window.FlightAPI = FlightAPI;
window.FlightSearchManager = FlightSearchManager;
window.flightSearchManager = flightSearchManager;
