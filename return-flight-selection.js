// Return Flight Selection Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Return Flight Selection Page Loaded');
    
    // Load outbound flight data and display return flights
    loadOutboundFlightData();
    loadReturnFlights();
    
    // Setup page interactions
    setupReturnFlightSelection();
});

// Load outbound flight data from session storage
function loadOutboundFlightData() {
    console.log('📋 Loading outbound flight data...');
    
    try {
        const flightSelection = JSON.parse(sessionStorage.getItem('flightSelection'));
        
        if (!flightSelection || !flightSelection.outbound) {
            console.error('❌ No outbound flight data found');
            showNotification('No outbound flight selected. Redirecting to search...', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }
        
        const outboundFlight = flightSelection.outbound;
        const flightData = outboundFlight.flightData || {};
        
        console.log('✅ Outbound flight data loaded:', flightData);
        
        // Populate outbound flight summary
        populateOutboundSummary(flightData);
        
    } catch (error) {
        console.error('❌ Error loading outbound flight data:', error);
        showNotification('Error loading flight data. Please try again.', 'error');
    }
}

// Populate outbound flight summary
function populateOutboundSummary(flightData) {
    document.getElementById('outboundAirline').textContent = flightData.airline;
    document.getElementById('outboundFlightNumber').textContent = flightData.flightNumber;
    document.getElementById('outboundDepartureTime').textContent = flightData.departure?.time || flightData.departureTime || '08:30';
    document.getElementById('outboundDepartureAirport').textContent = flightData.departure?.airport || 'JFK';
    document.getElementById('outboundArrivalTime').textContent = flightData.arrival?.time || flightData.arrivalTime || '12:45';
    document.getElementById('outboundArrivalAirport').textContent = flightData.arrival?.airport || 'LAX';
    document.getElementById('outboundDuration').textContent = flightData.duration || '4h 15m';
    document.getElementById('outboundStops').textContent = flightData.stops === 0 ? 'Direct' : `${flightData.stops} stop${flightData.stops > 1 ? 's' : ''}`;
    document.getElementById('outboundPrice').textContent = flightData.price || '$299';
}

// Load return flights
async function loadReturnFlights() {
    console.log('🔄 Loading return flights...');
    
    showLoadingOverlay();
    
    try {
        // Get search data from session storage
        const searchData = JSON.parse(sessionStorage.getItem('searchData')) || getDefaultSearchData();
        
        // Modify search data for return flight (reverse the route)
        const returnSearchData = {
            ...searchData,
            from: searchData.to,
            to: searchData.from,
            departure: searchData.return || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Default to 7 days later
        };
        
        console.log('🔍 Searching return flights with data:', returnSearchData);
        
        // Search for return flights using Amadeus API
        if (window.flightSearchManager && window.validateAPIConfig && validateAPIConfig()) {
            try {
                console.log('🔍 Searching return flights with Amadeus API...');
                await flightSearchManager.searchFlights(returnSearchData);
            } catch (error) {
                console.error('Amadeus API search failed, using mock data:', error);
                const mockFlights = generateMockReturnFlights(returnSearchData);
                displayReturnFlights(mockFlights, returnSearchData);
            }
        } else {
            // Fallback to mock data
            const mockFlights = generateMockReturnFlights(returnSearchData);
            displayReturnFlights(mockFlights, returnSearchData);
        }
        
    } catch (error) {
        console.error('❌ Error loading return flights:', error);
        showNotification('Error loading return flights. Using sample data.', 'warning');
        
        // Fallback to mock data
        const mockFlights = generateMockReturnFlights();
        displayReturnFlights(mockFlights);
    } finally {
        hideLoadingOverlay();
    }
}

// Display return flights
function displayReturnFlights(flights, searchData) {
    console.log('🎯 Displaying return flights:', flights);
    
    if (!flights || flights.length === 0) {
        console.log('❌ No return flights found');
        showNotification('No return flights found for your search criteria.', 'warning');
        return;
    }
    
    console.log(`✅ Found ${flights.length} return flights`);
    
    const resultsContainer = document.getElementById('flightResults');
    
    let resultsHTML = `
        <div class="results-header">
            <h3><i class="fas fa-plane-arrival"></i> Return Flights (${flights.length})</h3>
            <div class="api-status">
                <span class="api-indicator">${getAPIStatusText()}</span>
            </div>
        </div>
        <div class="flights-list">
            ${flights.map((flight, index) => createReturnFlightCard(flight, index, searchData)).join('')}
        </div>
    `;
    
    resultsContainer.innerHTML = resultsHTML;
    
    showNotification(`Found ${flights.length} return flights!`, 'success');
}

// Create return flight card
function createReturnFlightCard(flight, index, searchData) {
    const urgentBadge = flight.isUrgent ? '<span class="urgent-badge">URGENT</span>' : '';
    const lastMinuteBadge = flight.lastMinuteDeal ? '<span class="deal-badge">LAST MINUTE DEAL</span>' : '';
    const discountBadge = flight.discount ? `<span class="discount-badge">${flight.discount} OFF</span>` : '';
    
    return `
        <div class="flight-card return-flight" data-segment="inbound">
            <div class="flight-header">
                <div class="airline-info">
                    <h4>${flight.airline}</h4>
                    <span class="flight-number">${flight.flightNumber}</span>
                </div>
                <div class="flight-badges">
                    ${urgentBadge}
                    ${lastMinuteBadge}
                    ${discountBadge}
                </div>
            </div>
            
            <div class="flight-route">
                <div class="departure">
                    <div class="time">${flight.departure?.time || flight.departureTime || '16:30'}</div>
                    <div class="airport">${searchData?.from || flight.departure?.airport || 'LAX'}</div>
                    <div class="date">${formatDate(searchData?.departure || flight.departure?.date || new Date())}</div>
                </div>
                
                <div class="flight-path">
                    <div class="duration">${flight.duration}</div>
                    <div class="stops">${flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}</div>
                    <div class="aircraft">${flight.aircraft}</div>
                </div>
                
                <div class="arrival">
                    <div class="time">${flight.arrival?.time || flight.arrivalTime || '20:45'}</div>
                    <div class="airport">${searchData?.to || flight.arrival?.airport || 'JFK'}</div>
                    <div class="date">${formatDate(searchData?.departure || flight.arrival?.date || new Date())}</div>
                </div>
            </div>
            
            <div class="flight-footer">
                <div class="price-info">
                    <div class="current-price">${flight.price}</div>
                    ${flight.originalPrice ? `<div class="original-price">${flight.originalPrice}</div>` : ''}
                </div>
                <button class="book-btn" onclick="selectReturnFlight('flight-${index}')">
                    <i class="fas fa-check"></i> Select Return Flight
                </button>
            </div>
        </div>
    `;
}

// Select return flight
function selectReturnFlight(flightId) {
    console.log('🎫 Selecting return flight:', flightId);
    
    try {
        const flightCard = document.querySelector(`[onclick="selectReturnFlight('${flightId}')"]`).closest('.flight-card');
        
        if (!flightCard) {
            console.error('❌ Flight card not found for ID:', flightId);
            showNotification('Error: Flight card not found', 'error');
            return;
        }
        
        console.log('✅ Found flight card:', flightCard);
        
        const flightData = extractFlightDataFromCard(flightCard);
        
        if (!flightData) {
            console.error('❌ Failed to extract flight data');
            showNotification('Error: Could not extract flight data', 'error');
            return;
        }
        
        // Get current flight selection
        let flightSelection = JSON.parse(sessionStorage.getItem('flightSelection')) || {};
        
        // Store the return flight
        flightSelection.inbound = {
            flightId: flightId,
            flightData: flightData,
            selectedAt: new Date().toISOString()
        };
        
        // Save selection state
        sessionStorage.setItem('flightSelection', JSON.stringify(flightSelection));
        
        // Get outbound flight data from stored selection
        const outboundData = flightSelection.outbound.flightData || {};
        const inboundData = flightData;
        
        const bookingData = {
            tripType: 'roundtrip',
            outbound: outboundData,
            inbound: inboundData,
            totalPrice: calculateTotalPriceFromData(outboundData, inboundData)
        };
        
        // Store combined booking data
        sessionStorage.setItem('selectedFlight', JSON.stringify(bookingData));
        
        console.log('✅ Return flight selected, proceeding to confirmation');
        
        // Show success notification
        showNotification('Return flight selected! Redirecting to confirmation...', 'success');
        
        // Redirect to round trip confirmation page
        setTimeout(() => {
            window.location.href = 'round-trip-confirmation.html';
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error selecting return flight:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// Go back to outbound selection
function goBackToOutboundSelection() {
    console.log('⬅️ Going back to outbound selection');
    
    // Clear current flight selection
    sessionStorage.removeItem('flightSelection');
    sessionStorage.removeItem('selectedFlight');
    
    showNotification('Returning to outbound flight selection...', 'info');
    
    // Redirect back to main page
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Setup return flight selection interactions
function setupReturnFlightSelection() {
    console.log('🎮 Setting up return flight selection interactions');
    
    // Add click animations to flight cards
    const flightCards = document.querySelectorAll('.flight-card');
    flightCards.forEach(card => {
        card.addEventListener('click', function() {
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
}

// Generate mock return flights
function generateMockReturnFlights(searchData) {
    const airlines = ['American Airlines', 'Delta Air Lines', 'United Airlines', 'Southwest Airlines', 'JetBlue Airways'];
    const aircraft = ['Boeing 737', 'Airbus A320', 'Boeing 787', 'Airbus A350'];
    
    const flights = [];
    
    for (let i = 0; i < 6; i++) {
        const airline = airlines[i % airlines.length];
        const departureTime = `${14 + i}:${30 + (i * 15) % 60}`.padStart(5, '0');
        const arrivalTime = `${18 + i}:${45 + (i * 15) % 60}`.padStart(5, '0');
        
        flights.push({
            airline: airline,
            flightNumber: `${airline.substring(0, 2).toUpperCase()}${1000 + i}`,
            departure: {
                time: departureTime,
                airport: searchData?.from || 'LAX',
                date: searchData?.departure || new Date().toISOString().split('T')[0]
            },
            arrival: {
                time: arrivalTime,
                airport: searchData?.to || 'JFK',
                date: searchData?.departure || new Date().toISOString().split('T')[0]
            },
            duration: `${3 + i}h ${15 + (i * 10) % 45}m`,
            stops: i % 3 === 0 ? 0 : 1,
            aircraft: aircraft[i % aircraft.length],
            price: `$${299 + (i * 50)}`,
            originalPrice: i % 2 === 0 ? `$${399 + (i * 50)}` : null,
            isUrgent: i % 4 === 0,
            lastMinuteDeal: i % 5 === 0,
            discount: i % 3 === 0 ? '15% OFF' : null
        });
    }
    
    return flights;
}

// Get default search data
function getDefaultSearchData() {
    return {
        from: 'LAX',
        to: 'JFK',
        departure: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        passengers: 1,
        class: 'economy'
    };
}

// Calculate total price from flight data
function calculateTotalPriceFromData(outboundData, inboundData) {
    const outboundPrice = extractPriceFromData(outboundData);
    const inboundPrice = extractPriceFromData(inboundData);
    return outboundPrice + inboundPrice;
}

// Extract price from flight data
function extractPriceFromData(flightData) {
    if (flightData.price) {
        const priceText = flightData.price.toString();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        return isNaN(price) ? 0 : price;
    }
    return 0;
}

// Calculate total price
function calculateTotalPrice(outboundCard, inboundCard) {
    const outboundPrice = extractPrice(outboundCard);
    const inboundPrice = extractPrice(inboundCard);
    return outboundPrice + inboundPrice;
}

// Extract price from flight card
function extractPrice(flightCard) {
    const priceElement = flightCard.querySelector('.current-price');
    if (priceElement) {
        const priceText = priceElement.textContent;
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        return isNaN(price) ? 0 : price;
    }
    return 0;
}

// Show loading overlay
function showLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

// Hide loading overlay
function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Format date helper
function formatDate(date) {
    if (!date) return 'N/A';
    
    let dateObj;
    if (typeof date === 'string') {
        dateObj = new Date(date);
    } else if (date instanceof Date) {
        dateObj = date;
    } else {
        dateObj = new Date();
    }
    
    if (isNaN(dateObj.getTime())) {
        return 'N/A';
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
