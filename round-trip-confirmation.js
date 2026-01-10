// Round Trip Confirmation Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Round Trip Confirmation Page Loaded');
    
    // Load flight data and populate confirmation
    loadFlightData();
    
    // Setup page interactions
    setupConfirmationPage();
});

// Load flight data from session storage
function loadFlightData() {
    console.log('📋 Loading flight data for confirmation...');
    
    try {
        const flightSelection = JSON.parse(sessionStorage.getItem('flightSelection'));
        
        if (!flightSelection || !flightSelection.outbound || !flightSelection.inbound) {
            console.error('❌ Incomplete flight selection data');
            showNotification('Incomplete flight selection. Redirecting to search...', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }
        
        const outboundData = flightSelection.outbound.flightData || {};
        const inboundData = flightSelection.inbound.flightData || {};
        
        console.log('✅ Flight data loaded:', { outboundData, inboundData });
        
        // Populate confirmation page
        populateConfirmationPage(outboundData, inboundData);
        
    } catch (error) {
        console.error('❌ Error loading flight data:', error);
        showNotification('Error loading flight data. Please try again.', 'error');
    }
}

// Populate confirmation page with flight data
function populateConfirmationPage(outboundData, inboundData) {
    console.log('📊 Populating confirmation page...');
    
    // Populate outbound flight details
    populateFlightDetails('outbound', outboundData);
    
    // Populate inbound flight details
    populateFlightDetails('inbound', inboundData);
    
    // Calculate and display total price
    calculateAndDisplayTotal(outboundData, inboundData);
    
    // Store combined booking data
    storeBookingData(outboundData, inboundData);
}

// Populate flight details for a specific segment
function populateFlightDetails(segment, flightData) {
    const prefix = segment === 'outbound' ? 'outbound' : 'inbound';
    
    // Airline information
    document.getElementById(`${prefix}Airline`).textContent = flightData.airline || 'American Airlines';
    document.getElementById(`${prefix}FlightNumber`).textContent = flightData.flightNumber || 'AA1234';
    document.getElementById(`${prefix}Aircraft`).textContent = flightData.aircraft || 'Boeing 737';
    document.getElementById(`${prefix}Class`).textContent = flightData.class || 'Economy';
    
    // Departure information
    document.getElementById(`${prefix}DepartureTime`).textContent = flightData.departure?.time || flightData.departureTime || '08:30';
    document.getElementById(`${prefix}DepartureAirport`).textContent = flightData.departure?.airport || 'JFK';
    document.getElementById(`${prefix}DepartureDate`).textContent = formatDate(flightData.departure?.date || new Date());
    
    // Arrival information
    document.getElementById(`${prefix}ArrivalTime`).textContent = flightData.arrival?.time || flightData.arrivalTime || '12:45';
    document.getElementById(`${prefix}ArrivalAirport`).textContent = flightData.arrival?.airport || 'LAX';
    document.getElementById(`${prefix}ArrivalDate`).textContent = formatDate(flightData.arrival?.date || new Date());
    
    // Flight details
    document.getElementById(`${prefix}Duration`).textContent = flightData.duration || '4h 15m';
    document.getElementById(`${prefix}Stops`).textContent = flightData.stops === 0 ? 'Direct' : `${flightData.stops} stop${flightData.stops > 1 ? 's' : ''}`;
    
    // Price
    document.getElementById(`${prefix}Price`).textContent = flightData.price || '$299';
}

// Calculate and display total price
function calculateAndDisplayTotal(outboundData, inboundData) {
    const outboundPrice = extractPriceFromData(outboundData);
    const inboundPrice = extractPriceFromData(inboundData);
    const passengerCount = 1; // Default to 1 passenger
    const totalPrice = (outboundPrice + inboundPrice) * passengerCount;
    
    // Update price display
    document.getElementById('outboundPriceTotal').textContent = `$${outboundPrice}`;
    document.getElementById('inboundPriceTotal').textContent = `$${inboundPrice}`;
    document.getElementById('passengerCount').textContent = passengerCount;
    document.getElementById('totalPrice').textContent = `$${totalPrice}`;
    
    console.log('💰 Total price calculated:', totalPrice);
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

// Store booking data for the booking page
function storeBookingData(outboundData, inboundData) {
    console.log('💾 Storing booking data:', { outboundData, inboundData });
    
    const bookingData = {
        tripType: 'roundtrip',
        outbound: outboundData,
        inbound: inboundData,
        totalPrice: extractPriceFromData(outboundData) + extractPriceFromData(inboundData),
        passengerCount: 1,
        bookingDate: new Date().toISOString()
    };
    
    sessionStorage.setItem('selectedFlight', JSON.stringify(bookingData));
    console.log('✅ Booking data stored:', bookingData);
}

// Setup confirmation page interactions
function setupConfirmationPage() {
    console.log('🎮 Setting up confirmation page interactions');
    
    // Add hover effects to flight cards
    const flightCards = document.querySelectorAll('.flight-summary-card');
    flightCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 15px 30px rgba(139, 21, 56, 0.2)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '';
        });
    });
    
    // Add click animations to buttons
    const buttons = document.querySelectorAll('.modify-btn, .btn-primary, .btn-secondary');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
}

// Modify outbound flight
function modifyOutboundFlight() {
    console.log('✏️ Modifying outbound flight');
    
    // Clear current selections
    sessionStorage.removeItem('flightSelection');
    sessionStorage.removeItem('selectedFlight');
    
    showNotification('Returning to outbound flight selection...', 'info');
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Modify return flight
function modifyReturnFlight() {
    console.log('✏️ Modifying return flight');
    
    // Keep outbound selection, clear inbound
    const flightSelection = JSON.parse(sessionStorage.getItem('flightSelection')) || {};
    delete flightSelection.inbound;
    sessionStorage.setItem('flightSelection', JSON.stringify(flightSelection));
    
    showNotification('Returning to return flight selection...', 'info');
    
    setTimeout(() => {
        window.location.href = 'return-flight-selection.html';
    }, 1000);
}

// Go back to return flight selection
function goBackToReturnSelection() {
    console.log('⬅️ Going back to return flight selection');
    
    showNotification('Returning to return flight selection...', 'info');
    
    setTimeout(() => {
        window.location.href = 'return-flight-selection.html';
    }, 1000);
}

// Proceed to booking page
function proceedToBooking() {
    console.log('🎫 Proceeding to booking page');
    
    showLoadingOverlay();
    
    // Verify booking data exists
    const bookingData = JSON.parse(sessionStorage.getItem('selectedFlight'));
    if (!bookingData) {
        console.error('❌ No booking data found');
        hideLoadingOverlay();
        showNotification('Error: No booking data found. Please try again.', 'error');
        return;
    }
    
    console.log('✅ Proceeding to booking with data:', bookingData);
    
    showNotification('Redirecting to passenger details...', 'success');
    
    setTimeout(() => {
        window.location.href = 'booking.html';
    }, 2000);
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
