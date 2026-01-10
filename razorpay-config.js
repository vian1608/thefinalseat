// Razorpay Configuration
const RAZORPAY_CONFIG = {
    // Your Razorpay Key ID (from Razorpay Dashboard)
    // TODO: Replace with your actual Razorpay Key ID (starts with rzp_test_ or rzp_live_)
    keyId: 'rzp_test_1234567890', // Replace with your actual Razorpay Key ID
    
    // Currency for international payments
    currency: 'USD', // or 'EUR', 'GBP', etc. based on your target market
    
    // Your company name
    companyName: 'Urgent Travel',
    
    // Payment options
    options: {
        // Enable international cards
        international: true,
        
        // Payment methods to show
        method: {
            netbanking: true,
            wallet: true,
            emi: true,
            upi: true,
            card: true
        },
        
        // Theme
        theme: {
            color: '#8B1538' // Your brand color
        }
    }
};

// Initialize Razorpay
function initializeRazorpay() {
    console.log('💳 Initializing Razorpay...');
    
    // Check if Razorpay is loaded
    if (typeof Razorpay === 'undefined') {
        console.error('❌ Razorpay SDK not loaded');
        return false;
    }
    
    console.log('✅ Razorpay SDK loaded successfully');
    return true;
}

// Create Razorpay order
async function createRazorpayOrder(amount, currency = 'USD') {
    console.log('🔄 Creating Razorpay order for amount:', amount, currency);
    
    try {
        // In a real implementation, you would call your backend API
        // to create an order on Razorpay servers
        const orderData = {
            amount: Math.round(amount * 100), // Convert to paise/cents
            currency: currency,
            receipt: 'UT_' + Date.now(),
            notes: {
                booking_type: 'flight_booking',
                source: 'urgent_travel_website'
            }
        };
        
        console.log('📋 Order data:', orderData);
        
        // For demo purposes, we'll create a mock order
        // In production, replace this with actual API call to your backend
        const mockOrder = {
            id: 'order_' + Date.now(),
            amount: orderData.amount,
            currency: orderData.currency,
            receipt: orderData.receipt
        };
        
        console.log('✅ Razorpay order created:', mockOrder);
        return mockOrder;
        
    } catch (error) {
        console.error('❌ Error creating Razorpay order:', error);
        throw error;
    }
}

// Process payment with Razorpay
async function processRazorpayPayment(paymentData) {
    console.log('💳 Processing Razorpay payment:', paymentData);
    
    try {
        // Create order first
        const order = await createRazorpayOrder(paymentData.amount, paymentData.currency);
        
        // Razorpay options
        const options = {
            key: RAZORPAY_CONFIG.keyId,
            amount: order.amount,
            currency: order.currency,
            name: RAZORPAY_CONFIG.companyName,
            description: `Flight Booking - ${paymentData.flightDetails}`,
            order_id: order.id,
            receipt: order.receipt,
            
            // Customer details
            prefill: {
                name: paymentData.customerName,
                email: paymentData.customerEmail,
                contact: paymentData.customerPhone
            },
            
            // Payment method options
            method: {
                netbanking: RAZORPAY_CONFIG.options.method.netbanking,
                wallet: RAZORPAY_CONFIG.options.method.wallet,
                emi: RAZORPAY_CONFIG.options.method.emi,
                upi: RAZORPAY_CONFIG.options.method.upi,
                card: RAZORPAY_CONFIG.options.method.card
            },
            
            // Theme
            theme: RAZORPAY_CONFIG.options.theme,
            
            // International payments
            international: RAZORPAY_CONFIG.options.international,
            
            // Callbacks
            handler: function (response) {
                console.log('✅ Payment successful:', response);
                handlePaymentSuccess(response, paymentData);
            },
            
            modal: {
                ondismiss: function() {
                    console.log('❌ Payment cancelled by user');
                    handlePaymentCancellation(paymentData);
                }
            }
        };
        
        // Open Razorpay checkout
        const razorpay = new Razorpay(options);
        razorpay.open();
        
        console.log('🎯 Razorpay checkout opened');
        
    } catch (error) {
        console.error('❌ Error processing Razorpay payment:', error);
        handlePaymentError(error, paymentData);
    }
}

// Handle successful payment
function handlePaymentSuccess(response, paymentData) {
    console.log('🎉 Payment successful!', response);
    
    // Update payment data with Razorpay response
    paymentData.paymentDetails = {
        method: 'razorpay',
        razorpayPaymentId: response.razorpay_payment_id,
        razorpayOrderId: response.razorpay_order_id,
        razorpaySignature: response.razorpay_signature,
        status: 'success',
        amount: paymentData.amount,
        currency: paymentData.currency,
        timestamp: new Date().toISOString()
    };
    
    // Complete the booking
    completeBookingWithPayment(paymentData);
}

// Handle payment cancellation
function handlePaymentCancellation(paymentData) {
    console.log('❌ Payment cancelled by user');
    
    // Update payment data
    paymentData.paymentDetails = {
        method: 'razorpay',
        status: 'cancelled',
        timestamp: new Date().toISOString()
    };
    
    // Show cancellation message
    showNotification('Payment was cancelled. You can try again.', 'warning');
}

// Handle payment error
function handlePaymentError(error, paymentData) {
    console.error('❌ Payment error:', error);
    
    // Update payment data
    paymentData.paymentDetails = {
        method: 'razorpay',
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
    };
    
    // Show error message
    showNotification('Payment failed. Please try again.', 'error');
}

// Complete booking after successful payment
function completeBookingWithPayment(paymentData) {
    console.log('✅ Completing booking with payment:', paymentData);
    
    // Show success message
    showNotification('Payment successful! Processing your booking...', 'success');
    
    // Process the booking with payment confirmation
    processBookingWithPayment(paymentData);
}

// Process booking with payment confirmation
function processBookingWithPayment(paymentData) {
    console.log('📝 Processing booking with payment confirmation');
    
    // Get the booking form data
    const form = document.getElementById('bookingForm');
    const formData = new FormData(form);
    const bookingData = Object.fromEntries(formData.entries());
    
    // Add flight data
    const flightData = getFlightDataFromStorage();
    bookingData.flight = flightData;
    
    // Add payment data
    bookingData.paymentDetails = paymentData.paymentDetails;
    bookingData.paymentStatus = 'completed';
    
    // Add pricing data
    bookingData.subtotal = document.getElementById('subtotal').textContent;
    bookingData.taxes = document.getElementById('taxes').textContent;
    bookingData.total = document.getElementById('total').textContent;
    
    // Generate booking reference
    bookingData.bookingReference = 'UT' + Math.random().toString(36).substr(2, 8).toUpperCase();
    bookingData.bookingDate = new Date().toISOString();
    bookingData.status = 'confirmed';
    
    console.log('📋 Complete booking data:', bookingData);
    
    // Store booking data for admin panel
    storeBookingForAdmin(bookingData);
    
    // Show loading overlay
    showLoadingOverlay();
    
    // Process booking and send email
    processBookingWithEmail(bookingData);
}

// Verify payment signature (for backend verification)
function verifyPaymentSignature(response, secret) {
    // This should be done on your backend for security
    // Never expose your secret key in frontend code
    console.log('🔐 Payment signature verification should be done on backend');
    return true; // Mock verification
}

// Export functions for use in other files
window.RazorpayPayment = {
    initialize: initializeRazorpay,
    processPayment: processRazorpayPayment,
    createOrder: createRazorpayOrder,
    verifySignature: verifyPaymentSignature
};

