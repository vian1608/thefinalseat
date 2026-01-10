// Booking Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeBookingPage();
    setupFormValidation();
    setupPaymentMethodToggle();
    initializeEmailSystem();
});

// Initialize booking page
function initializeBookingPage() {
    // Ensure loading overlay and modals are hidden
    hideLoadingOverlay();
    hideAllModals();
    
    // Initialize Razorpay
    if (typeof RazorpayPayment !== 'undefined') {
        RazorpayPayment.initialize();
    }
    
    // Get flight data from URL parameters or session storage
    const flightData = getFlightDataFromStorage();
    
    if (flightData) {
        displayFlightSummary(flightData);
        updateBookingSummary(flightData);
    } else {
        // Redirect to home if no flight data
        console.log('❌ No flight data found, redirecting to home');
        window.location.href = 'index.html';
    }
    
    // Set default values
    setDefaultValues();
    
    // Setup real-time validation
    setupRealTimeValidation();
}

// Get flight data from storage or URL
function getFlightDataFromStorage() {
    // Try to get from session storage first
    const storedData = sessionStorage.getItem('selectedFlight');
    console.log('🔍 Raw stored data:', storedData);
    
    if (storedData) {
        const parsedData = JSON.parse(storedData);
        console.log('🔍 Parsed flight data:', parsedData);
        return parsedData;
    }
    
    // Try to get from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const flightId = urlParams.get('flightId');
    
    if (flightId) {
        // In a real app, you'd fetch flight details by ID
        return getFlightById(flightId);
    }
    
    console.log('❌ No flight data found in storage');
    return null;
}

// Mock function to get flight by ID
function getFlightById(flightId) {
    // This would typically make an API call
    return {
        id: flightId,
        airline: 'American Airlines',
        flightNumber: 'AA1234',
        departure: {
            airport: 'New York (JFK)',
            time: '08:30',
            date: '2024-11-15'
        },
        arrival: {
            airport: 'Los Angeles (LAX)',
            time: '11:45',
            date: '2024-11-15'
        },
        duration: '5h 15m',
        price: '$299',
        originalPrice: '$399',
        discount: '25%',
        class: 'Economy',
        stops: 0,
        aircraft: 'Boeing 737',
        isUrgent: true
    };
}

// Display flight summary
function displayFlightSummary(flight) {
    console.log('🎫 Displaying flight summary for:', flight);
    
    const summaryCard = document.getElementById('flightSummaryCard');
    
    if (!flight) {
        console.error('❌ No flight data provided to displayFlightSummary');
        summaryCard.innerHTML = '<div class="error-message">No flight data available</div>';
        return;
    }
    
    // Ensure flight has required properties
    if (!flight.outbound && !flight.airline) {
        console.error('❌ Invalid flight data structure:', flight);
        summaryCard.innerHTML = '<div class="error-message">Invalid flight data</div>';
        return;
    }
    
    // Handle round trip flights
    if (flight.tripType === 'roundtrip') {
        summaryCard.innerHTML = `
            <div class="summary-header">
                <h3><i class="fas fa-exchange-alt"></i> Round Trip Flight Details</h3>
                <div class="flight-badges">
                    ${flight.outbound.isUrgent ? '<span class="urgent-badge">URGENT</span>' : ''}
                    ${flight.outbound.discount ? `<span class="discount-badge">${flight.outbound.discount} OFF</span>` : ''}
                </div>
            </div>
            
            <div class="round-trip-flights">
                <div class="flight-segment outbound">
                    <h4><i class="fas fa-plane-departure"></i> Outbound Flight</h4>
                    <div class="flight-info">
                        <div class="airline-info">
                            <h5>${flight.outbound.airline}</h5>
                            <span class="flight-number">${flight.outbound.flightNumber}</span>
                        </div>
                        
                        <div class="route-info">
                            <div class="departure">
                                <div class="time">${flight.outbound.departure?.time || flight.outbound.departureTime || '10:30'}</div>
                                <div class="airport">${flight.outbound.departure?.airport || 'NYC'}</div>
                            </div>
                            
                            <div class="flight-path">
                                <div class="duration">${flight.outbound.duration}</div>
                                <div class="stops">${flight.outbound.stops === 0 ? 'Direct' : `${flight.outbound.stops} stop${flight.outbound.stops > 1 ? 's' : ''}`}</div>
                            </div>
                            
                            <div class="arrival">
                                <div class="time">${flight.outbound.arrival?.time || flight.outbound.arrivalTime || '14:45'}</div>
                                <div class="airport">${flight.outbound.arrival?.airport || 'LAX'}</div>
                            </div>
                        </div>
                        
                        <div class="price-info">
                            <div class="current-price">${flight.outbound.price}</div>
                        </div>
                    </div>
                </div>
                
                <div class="flight-segment inbound">
                    <h4><i class="fas fa-plane-arrival"></i> Return Flight</h4>
                    <div class="flight-info">
                        <div class="airline-info">
                            <h5>${flight.inbound.airline}</h5>
                            <span class="flight-number">${flight.inbound.flightNumber}</span>
                        </div>
                        
                        <div class="route-info">
                            <div class="departure">
                                <div class="time">${flight.inbound.departure?.time || flight.inbound.departureTime || '16:30'}</div>
                                <div class="airport">${flight.inbound.departure?.airport || 'LAX'}</div>
                            </div>
                            
                            <div class="flight-path">
                                <div class="duration">${flight.inbound.duration}</div>
                                <div class="stops">${flight.inbound.stops === 0 ? 'Direct' : `${flight.inbound.stops} stop${flight.inbound.stops > 1 ? 's' : ''}`}</div>
                            </div>
                            
                            <div class="arrival">
                                <div class="time">${flight.inbound.arrival?.time || flight.inbound.arrivalTime || '20:45'}</div>
                                <div class="airport">${flight.inbound.arrival?.airport || 'NYC'}</div>
                            </div>
                        </div>
                        
                        <div class="price-info">
                            <div class="current-price">${flight.inbound.price}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="total-price">
                <h3>Total Price: <span class="total-amount">$${flight.totalPrice || '0.00'}</span></h3>
            </div>
        `;
    } else {
        // Handle single flight
        summaryCard.innerHTML = `
            <div class="summary-header">
                <h3><i class="fas fa-plane"></i> Flight Details</h3>
                <div class="flight-badges">
                    ${flight.isUrgent ? '<span class="urgent-badge">URGENT</span>' : ''}
                    ${flight.discount ? `<span class="discount-badge">${flight.discount} OFF</span>` : ''}
                </div>
            </div>
            
            <div class="flight-info">
                <div class="airline-info">
                    <h4>${flight.airline}</h4>
                    <span class="flight-number">${flight.flightNumber}</span>
                </div>
                
                <div class="route-info">
                    <div class="departure">
                        <div class="time">${flight.departure?.time || flight.departureTime || '10:30'}</div>
                        <div class="airport">${flight.departure?.airport || 'NYC'}</div>
                    </div>
                    
                    <div class="flight-path">
                        <div class="duration">${flight.duration}</div>
                        <div class="stops">${flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}</div>
                    </div>
                    
                    <div class="arrival">
                        <div class="time">${flight.arrival?.time || flight.arrivalTime || '14:45'}</div>
                        <div class="airport">${flight.arrival?.airport || 'LAX'}</div>
                    </div>
                </div>
                
                <div class="price-info">
                    <div class="current-price">${flight.price}</div>
                    ${flight.originalPrice ? `<div class="original-price">${flight.originalPrice}</div>` : ''}
                </div>
            </div>
        `;
    }
}

// Update booking summary
function updateBookingSummary(flight) {
    console.log('💰 Updating booking summary for:', flight);
    
    const summaryDetails = document.getElementById('bookingSummaryDetails');
    const subtotal = document.getElementById('subtotal');
    const taxes = document.getElementById('taxes');
    const total = document.getElementById('total');
    
    if (!flight) {
        console.error('❌ No flight data provided to updateBookingSummary');
        return;
    }
    
    // Calculate prices with safe defaults
    const flightPrice = flight.price || flight.totalPrice || '$0';
    const basePrice = flightPrice ? parseFloat(flightPrice.toString().replace('$', '')) : 0;
    const taxAmount = basePrice * 0.12; // 12% tax
    const totalAmount = basePrice + taxAmount;
    
    summaryDetails.innerHTML = `
        <div class="summary-item">
            <span>Flight (${flight.class || 'Economy'})</span>
            <span>${flightPrice}</span>
        </div>
        <div class="summary-item">
            <span>Passenger</span>
            <span>1 Adult</span>
        </div>
        <div class="summary-item">
            <span>Booking Fee</span>
            <span>Free</span>
        </div>
    `;
    
    subtotal.textContent = `$${basePrice.toFixed(2)}`;
    taxes.textContent = `$${taxAmount.toFixed(2)}`;
    total.textContent = `$${totalAmount.toFixed(2)}`;
}

// Set default values
function setDefaultValues() {
    // Set today's date as minimum for date of birth
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    document.getElementById('dateOfBirth').max = maxDate.toISOString().split('T')[0];
    
    // Set passport expiry minimum to today
    document.getElementById('passportExpiry').min = today.toISOString().split('T')[0];
}

// Setup form validation
function setupFormValidation() {
    const form = document.getElementById('bookingForm');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validateForm()) {
            processBooking();
        }
    });
}

// Real-time validation
function setupRealTimeValidation() {
    // Email validation
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('blur', function() {
        validateEmail(this);
    });
    
    // Phone validation
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('blur', function() {
        validatePhone(this);
    });
    
    // Card number formatting
    const cardNumberInput = document.getElementById('cardNumber');
    cardNumberInput.addEventListener('input', function() {
        formatCardNumber(this);
    });
    
    // Card expiry formatting
    const cardExpiryInput = document.getElementById('cardExpiry');
    cardExpiryInput.addEventListener('input', function() {
        formatCardExpiry(this);
    });
    
    // CVV validation
    const cardCvvInput = document.getElementById('cardCvv');
    cardCvvInput.addEventListener('input', function() {
        validateCVV(this);
    });
}

// Validate email
function validateEmail(input) {
    const email = input.value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
        showFieldError(input, 'Please enter a valid email address');
        return false;
    } else {
        clearFieldError(input);
        return true;
    }
}

// Validate phone
function validatePhone(input) {
    const phone = input.value.replace(/\D/g, '');
    
    if (phone.length < 10) {
        showFieldError(input, 'Please enter a valid phone number');
        return false;
    } else {
        clearFieldError(input);
        return true;
    }
}

// Format card number
function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    input.value = value;
}

// Format card expiry
function formatCardExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    input.value = value;
}

// Validate CVV
function validateCVV(input) {
    const cvv = input.value.replace(/\D/g, '');
    
    if (cvv.length < 3) {
        showFieldError(input, 'CVV must be at least 3 digits');
        return false;
    } else {
        clearFieldError(input);
        return true;
    }
}

// Setup payment method toggle
function setupPaymentMethodToggle() {
    const creditCardRadio = document.getElementById('creditCard');
    const paypalRadio = document.getElementById('paypal');
    const creditCardDetails = document.getElementById('creditCardDetails');
    const paypalDetails = document.getElementById('paypalDetails');
    
    creditCardRadio.addEventListener('change', function() {
        if (this.checked) {
            creditCardDetails.style.display = 'block';
            paypalDetails.style.display = 'none';
        }
    });
    
    paypalRadio.addEventListener('change', function() {
        if (this.checked) {
            creditCardDetails.style.display = 'none';
            paypalDetails.style.display = 'block';
        }
    });
}

// Validate entire form
function validateForm() {
    let isValid = true;
    const form = document.getElementById('bookingForm');
    const requiredFields = form.querySelectorAll('[required]');
    
    // Clear previous errors
    clearAllErrors();
    
    // Validate required fields
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            showFieldError(field, 'This field is required');
            isValid = false;
        }
    });
    
    // Validate specific fields
    if (!validateEmail(document.getElementById('email'))) {
        isValid = false;
    }
    
    if (!validatePhone(document.getElementById('phone'))) {
        isValid = false;
    }
    
    if (!validatePhone(document.getElementById('emergencyPhone'))) {
        isValid = false;
    }
    
    // Validate payment method selection
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
    if (!paymentMethod) {
        showFieldError(document.querySelector('input[name="paymentMethod"]'), 'Please select a payment method');
        isValid = false;
    } else if (paymentMethod.value === 'creditCard') {
        if (!validateCreditCard()) {
            isValid = false;
        }
    }
    
    // Validate date of birth (must be 18+)
    const dob = document.getElementById('dateOfBirth').value;
    if (dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        
        if (age < 18) {
            showFieldError(document.getElementById('dateOfBirth'), 'You must be at least 18 years old to book');
            isValid = false;
        }
    }
    
    return isValid;
}

// Validate credit card
function validateCreditCard() {
    let isValid = true;
    
    const cardNumber = document.getElementById('cardNumber').value.replace(/\D/g, '');
    const cardExpiry = document.getElementById('cardExpiry').value;
    const cardCvv = document.getElementById('cardCvv').value;
    
    // Validate card number (Luhn algorithm)
    if (!validateCardNumber(cardNumber)) {
        showFieldError(document.getElementById('cardNumber'), 'Invalid card number');
        isValid = false;
    }
    
    // Validate expiry date
    if (!validateExpiryDate(cardExpiry)) {
        showFieldError(document.getElementById('cardExpiry'), 'Invalid expiry date');
        isValid = false;
    }
    
    // Validate CVV
    if (!validateCVV(document.getElementById('cardCvv'))) {
        isValid = false;
    }
    
    return isValid;
}

// Luhn algorithm for card validation
function validateCardNumber(cardNumber) {
    if (cardNumber.length < 13 || cardNumber.length > 19) {
        return false;
    }
    
    let sum = 0;
    let isEven = false;
    
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber[i]);
        
        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        
        sum += digit;
        isEven = !isEven;
    }
    
    return sum % 10 === 0;
}

// Validate expiry date
function validateExpiryDate(expiry) {
    const [month, year] = expiry.split('/');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;
    
    const expMonth = parseInt(month);
    const expYear = parseInt(year);
    
    if (expMonth < 1 || expMonth > 12) {
        return false;
    }
    
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
        return false;
    }
    
    return true;
}

// Show field error
function showFieldError(field, message) {
    // Handle radio button groups differently
    if (field.type === 'radio') {
        const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
        paymentMethods.forEach(radio => {
            radio.classList.add('error');
            const label = radio.parentElement.querySelector('label');
            if (label) {
                label.classList.add('error');
            }
        });
        
        // Show error message near the payment methods
        const paymentMethodsContainer = document.querySelector('.payment-methods');
        if (paymentMethodsContainer) {
            let errorElement = paymentMethodsContainer.querySelector('.error-message');
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.className = 'error-message';
                paymentMethodsContainer.appendChild(errorElement);
            }
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    } else {
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        field.classList.add('error');
    }
}

// Clear field error
function clearFieldError(field) {
    // Handle radio button groups differently
    if (field.type === 'radio') {
        const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
        paymentMethods.forEach(radio => {
            radio.classList.remove('error');
            const label = radio.parentElement.querySelector('label');
            if (label) {
                label.classList.remove('error');
            }
        });
        
        // Clear error message near the payment methods
        const paymentMethodsContainer = document.querySelector('.payment-methods');
        if (paymentMethodsContainer) {
            const errorElement = paymentMethodsContainer.querySelector('.error-message');
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        }
    } else {
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        field.classList.remove('error');
    }
}

// Clear all errors
function clearAllErrors() {
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(error => {
        error.style.display = 'none';
    });
    
    const errorFields = document.querySelectorAll('.error');
    errorFields.forEach(field => {
        field.classList.remove('error');
    });
}

// Initialize email system
function initializeEmailSystem() {
    console.log('📧 Initializing email system...');
    
    // Load email configuration
    const script = document.createElement('script');
    script.src = 'email-config.js';
    script.onload = function() {
        console.log('✅ Email configuration loaded');
        // Don't initialize EmailJS here - let it happen when needed
        console.log('📧 Email system ready (will auto-detect EmailJS availability)');
    };
    script.onerror = function() {
        console.warn('⚠️ Email configuration failed to load - using fallback only');
    };
    document.head.appendChild(script);
}

// Mask card number for security
function maskCardNumber(cardNumber) {
    if (!cardNumber) return '';
    const cleaned = cardNumber.replace(/\s/g, '');
    if (cleaned.length < 8) return cleaned;
    return cleaned.substring(0, 4) + ' **** **** ' + cleaned.substring(cleaned.length - 4);
}

// Get card type from card number
function getCardType(cardNumber) {
    if (!cardNumber) return 'Unknown';
    const cleaned = cardNumber.replace(/\s/g, '');
    
    if (/^4/.test(cleaned)) return 'Visa';
    if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
    if (/^3[47]/.test(cleaned)) return 'American Express';
    if (/^6/.test(cleaned)) return 'Discover';
    if (/^3[0689]/.test(cleaned)) return 'Diners Club';
    if (/^35/.test(cleaned)) return 'JCB';
    
    return 'Unknown';
}

// Process booking
function processBooking() {
    const form = document.getElementById('bookingForm');
    const formData = new FormData(form);
    const bookingData = Object.fromEntries(formData.entries());
    
    // Add flight data
    const flightData = getFlightDataFromStorage();
    bookingData.flight = flightData;
    
    // Add pricing data
    bookingData.subtotal = document.getElementById('subtotal').textContent;
    bookingData.taxes = document.getElementById('taxes').textContent;
    bookingData.total = document.getElementById('total').textContent;
    
    // Get payment method
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
    
    if (paymentMethod && paymentMethod.value === 'creditCard') {
        // Process with Razorpay
        processRazorpayPayment(bookingData);
    } else if (paymentMethod && paymentMethod.value === 'paypal') {
        // Process with PayPal (existing logic)
        processPayPalPayment(bookingData);
    } else {
        showNotification('Please select a payment method', 'error');
    }
}

// Process Razorpay payment
function processRazorpayPayment(bookingData) {
    console.log('💳 Processing Razorpay payment for booking:', bookingData);
    
    // Calculate total amount
    const totalAmount = parseFloat(bookingData.total.replace('$', ''));
    
    // Prepare payment data
    const paymentData = {
        amount: totalAmount,
        currency: 'USD', // or get from config
        customerName: `${bookingData.firstName} ${bookingData.lastName}`,
        customerEmail: bookingData.email,
        customerPhone: bookingData.phone,
        flightDetails: `${bookingData.flight.airline} ${bookingData.flight.flightNumber}`,
        bookingData: bookingData
    };
    
    console.log('💳 Payment data prepared:', paymentData);
    
    // Process payment with Razorpay
    if (typeof RazorpayPayment !== 'undefined') {
        RazorpayPayment.processPayment(paymentData);
    } else {
        console.error('❌ Razorpay not initialized');
        showNotification('Payment system not available. Please try again.', 'error');
    }
}

// Process PayPal payment (existing logic)
function processPayPalPayment(bookingData) {
    console.log('🅿️ Processing PayPal payment for booking:', bookingData);
    
    // Capture card details if credit card payment is selected
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
    if (paymentMethod && paymentMethod.value === 'paypal') {
        bookingData.paymentDetails = {
            method: 'paypal',
            email: bookingData.email, // PayPal email
            status: 'pending'
        };
    }
    
    // Generate booking reference
    bookingData.bookingReference = 'UT' + Math.random().toString(36).substr(2, 8).toUpperCase();
    bookingData.bookingDate = new Date().toISOString();
    bookingData.status = 'confirmed';
    
    console.log('📝 Processing booking:', bookingData);
    
    // Store booking data for admin panel
    storeBookingForAdmin(bookingData);
    
    // Show loading overlay
    showLoadingOverlay();
    
    // Process booking and send email
    processBookingWithEmail(bookingData);
}

// Process booking with email notification
async function processBookingWithEmail(bookingData) {
    try {
        console.log('📧 Sending booking email...');
        
        // Try to send email
        let emailResult;
        if (typeof sendBookingEmail === 'function') {
            emailResult = await sendBookingEmail(bookingData);
        } else {
            console.log('📧 EmailJS not available, using fallback...');
            if (typeof sendFallbackEmail === 'function') {
                emailResult = sendFallbackEmail(bookingData);
            } else {
                emailResult = { success: false, message: 'Email system not configured' };
            }
        }
        
        console.log('📧 Email result:', emailResult);
        
        // Hide loading overlay
        hideLoadingOverlay();
        
        // Show booking confirmation with email status
        showBookingConfirmation(bookingData, emailResult);
        
    } catch (error) {
        console.error('❌ Booking process failed:', error);
        hideLoadingOverlay();
        
        // Show error message
        showNotification('Booking failed: ' + error.message, 'error');
    }
}

// Show loading overlay
function showLoadingOverlay() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

// Hide all modals
function hideAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// Hide loading overlay
function hideLoadingOverlay() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Show booking confirmation
function showBookingConfirmation(bookingData, emailResult = null) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    // Email status message
    let emailStatusHtml = '';
    if (emailResult) {
        if (emailResult.success) {
            emailStatusHtml = `
                <div class="email-status success">
                    <i class="fas fa-check-circle"></i>
                    <span>Booking details sent to admin email</span>
                </div>
            `;
        } else {
            emailStatusHtml = `
                <div class="email-status warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Email notification failed: ${emailResult.message}</span>
                </div>
            `;
        }
    }
    
    modal.innerHTML = `
        <div class="modal-content confirmation-modal">
            <div class="confirmation-header">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h2>Booking Confirmed!</h2>
                <p>Your flight has been successfully booked</p>
                ${emailStatusHtml}
            </div>
            
            <div class="confirmation-details">
                <div class="booking-reference">
                    <h3>Booking Reference</h3>
                    <div class="reference-number">${bookingData.bookingReference}</div>
                </div>
                
                <div class="passenger-info">
                    <h3>Passenger</h3>
                    <p>${bookingData.firstName} ${bookingData.middleName ? bookingData.middleName + ' ' : ''}${bookingData.lastName}</p>
                    <p>${bookingData.email}</p>
                    <p>${bookingData.phone}</p>
                </div>
                
                <div class="flight-info">
                    <h3>Flight Details</h3>
                    <p><strong>${bookingData.flight.airline} ${bookingData.flight.flightNumber}</strong></p>
                    <p>${bookingData.flight.departure.airport} → ${bookingData.flight.arrival.airport}</p>
                    <p>Departure: ${bookingData.flight.departure.time} on ${formatDate(bookingData.flight.departure.date)}</p>
                </div>
                
                <div class="payment-info">
                    <h3>Payment</h3>
                    <p>Payment Method: ${bookingData.paymentMethod === 'creditCard' ? 'Credit Card' : 'PayPal'}</p>
                    <p>Total Amount: ${bookingData.total}</p>
                </div>
            </div>
            
            <div class="confirmation-actions">
                <button class="btn-primary" onclick="window.location.href='index.html'">
                    <i class="fas fa-home"></i> Back to Home
                </button>
                <button class="btn-secondary" onclick="printConfirmation()">
                    <i class="fas fa-print"></i> Print Confirmation
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Print confirmation
function printConfirmation() {
    window.print();
}

// Show terms modal
function showTermsModal() {
    document.getElementById('termsModal').style.display = 'flex';
}

// Show privacy modal
function showPrivacyModal() {
    document.getElementById('privacyModal').style.display = 'flex';
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Go back to search
function goBack() {
    window.history.back();
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Store booking data for admin panel
function storeBookingForAdmin(bookingData) {
    try {
        const bookingId = bookingData.bookingReference;
        if (bookingId) {
            // Store in localStorage for admin panel
            localStorage.setItem(`booking_${bookingId}`, JSON.stringify(bookingData));
            console.log('✅ Booking stored for admin panel:', bookingId);
        }
    } catch (error) {
        console.error('❌ Error storing booking for admin:', error);
    }
}
