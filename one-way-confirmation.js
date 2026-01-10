// One-Way Confirmation Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ One-Way Confirmation Page Loaded');
    
    // Load flight data and populate confirmation
    loadFlightData();
    
    // Setup page interactions
    setupConfirmationPage();
});

// Load flight data from session storage
function loadFlightData() {
    console.log('📋 Loading flight data for confirmation...');
    
    try {
        const flightData = JSON.parse(sessionStorage.getItem('selectedFlight'));
        
        if (!flightData) {
            console.error('❌ No flight data found');
            showNotification('No flight selected. Redirecting to search...', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
            return;
        }
        
        console.log('✅ Flight data loaded:', flightData);
        
        // Populate confirmation page
        populateConfirmationPage(flightData);
        
    } catch (error) {
        console.error('❌ Error loading flight data:', error);
        showNotification('Error loading flight data. Please try again.', 'error');
    }
}

// Populate confirmation page with flight data
function populateConfirmationPage(flightData) {
    console.log('📊 Populating confirmation page...');
    
    // Populate flight details
    populateFlightDetails(flightData);
    
    // Calculate and display total price
    calculateAndDisplayTotal(flightData);
    
    // Store booking data
    storeBookingData(flightData);
}

// Populate flight details
function populateFlightDetails(flightData) {
    // Airline information
    document.getElementById('flightAirline').textContent = flightData.airline || 'American Airlines';
    document.getElementById('flightNumber').textContent = flightData.flightNumber || 'AA1234';
    document.getElementById('aircraft').textContent = flightData.aircraft || 'Boeing 737';
    document.getElementById('flightClass').textContent = flightData.class || 'Economy';
    
    // Departure information
    document.getElementById('departureTime').textContent = flightData.departure?.time || flightData.departureTime || '08:30';
    document.getElementById('departureAirport').textContent = flightData.departure?.airport || 'JFK';
    document.getElementById('departureDate').textContent = formatDate(flightData.departure?.date || new Date());
    
    // Arrival information
    document.getElementById('arrivalTime').textContent = flightData.arrival?.time || flightData.arrivalTime || '12:45';
    document.getElementById('arrivalAirport').textContent = flightData.arrival?.airport || 'LAX';
    document.getElementById('arrivalDate').textContent = formatDate(flightData.arrival?.date || new Date());
    
    // Flight details
    document.getElementById('duration').textContent = flightData.duration || '4h 15m';
    document.getElementById('stops').textContent = flightData.stops === 0 ? 'Direct' : `${flightData.stops} stop${flightData.stops > 1 ? 's' : ''}`;
    
    // Price
    document.getElementById('flightPrice').textContent = flightData.price || '$299';
}

// Calculate and display total price
function calculateAndDisplayTotal(flightData) {
    const flightPrice = extractPriceFromData(flightData);
    const passengerCount = 1; // Default to 1 passenger
    const totalPrice = flightPrice * passengerCount;
    
    // Update price display
    document.getElementById('flightPriceTotal').textContent = `$${flightPrice}`;
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
function storeBookingData(flightData) {
    console.log('💾 Storing one-way booking data:', flightData);
    
    const bookingData = {
        tripType: 'oneway',
        ...flightData,
        totalPrice: extractPriceFromData(flightData),
        passengerCount: 1,
        bookingDate: new Date().toISOString()
    };
    
    sessionStorage.setItem('selectedFlight', JSON.stringify(bookingData));
    console.log('✅ One-way booking data stored:', bookingData);
}

// Setup confirmation page interactions
function setupConfirmationPage() {
    console.log('🎮 Setting up confirmation page interactions');
    
    // Add hover effects to flight card
    const flightCard = document.querySelector('.flight-summary-card');
    if (flightCard) {
        flightCard.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 15px 30px rgba(139, 21, 56, 0.2)';
        });
        
        flightCard.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '';
        });
    }
    
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

// Modify flight
function modifyFlight() {
    console.log('✏️ Modifying flight');
    
    // Clear current selections
    sessionStorage.removeItem('selectedFlight');
    
    showNotification('Returning to flight selection...', 'info');
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Go back to flight selection
function goBackToFlightSelection() {
    console.log('⬅️ Going back to flight selection');
    
    showNotification('Returning to flight search...', 'info');
    
    setTimeout(() => {
        window.location.href = 'index.html';
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
