// Email Configuration
const EMAIL_CONFIG = {
    // EmailJS Configuration
    SERVICE_ID: 'service_urgent_travel', // Replace with your EmailJS service ID
    TEMPLATE_ID: 'template_booking_confirmation', // Replace with your EmailJS template ID
    PUBLIC_KEY: 'your_emailjs_public_key', // Replace with your EmailJS public key
    
    // Your email address to receive booking notifications
    ADMIN_EMAIL: 'your-email@example.com', // Replace with your actual email
    
    // Email template settings
    TEMPLATE: {
        SUBJECT: 'New Flight Booking - Urgent Travel',
        FROM_NAME: 'Urgent Travel Booking System',
        REPLY_TO: 'noreply@urgenttravel.com'
    }
};

// Initialize EmailJS
function initializeEmailJS() {
    // Check if EmailJS is loaded
    if (typeof emailjs !== 'undefined' && emailjs.init) {
        try {
            emailjs.init(EMAIL_CONFIG.PUBLIC_KEY);
            console.log('✅ EmailJS initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ EmailJS initialization failed:', error);
            return false;
        }
    } else {
        console.log('📧 EmailJS not loaded - will use fallback method');
        return false;
    }
}

// Wait for EmailJS to load
function waitForEmailJS() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkEmailJS = () => {
            attempts++;
            if (typeof emailjs !== 'undefined' && emailjs.init) {
                console.log('✅ EmailJS loaded after', attempts, 'attempts');
                resolve(true);
            } else if (attempts < maxAttempts) {
                console.log('⏳ Waiting for EmailJS... attempt', attempts);
                setTimeout(checkEmailJS, 500);
            } else {
                console.log('📧 EmailJS not available - using fallback');
                resolve(false);
            }
        };
        
        checkEmailJS();
    });
}

// Send booking confirmation email
async function sendBookingEmail(bookingData) {
    console.log('📧 Preparing to send booking email...');
    
    try {
        // Wait for EmailJS to load
        const emailjsAvailable = await waitForEmailJS();
        
        if (!emailjsAvailable) {
            console.log('📧 EmailJS not available, using fallback method');
            return sendFallbackEmail(bookingData);
        }
        
        // Initialize EmailJS
        if (!initializeEmailJS()) {
            throw new Error('EmailJS initialization failed');
        }
        
        // Format the email data
        const emailData = formatBookingEmailData(bookingData);
        
        console.log('📧 Sending email with data:', emailData);
        
        // Send email using EmailJS
        const response = await emailjs.send(
            EMAIL_CONFIG.SERVICE_ID,
            EMAIL_CONFIG.TEMPLATE_ID,
            emailData
        );
        
        console.log('✅ Email sent successfully:', response);
        return { success: true, message: 'Booking confirmation sent successfully!' };
        
    } catch (error) {
        console.error('❌ Failed to send email:', error);
        console.log('📧 Falling back to email client method');
        return sendFallbackEmail(bookingData);
    }
}

// Format booking data for email template
function formatBookingEmailData(bookingData) {
    const flight = bookingData.flight;
    
    return {
        // Email settings
        to_email: EMAIL_CONFIG.ADMIN_EMAIL,
        from_name: EMAIL_CONFIG.TEMPLATE.FROM_NAME,
        reply_to: EMAIL_CONFIG.TEMPLATE.REPLY_TO,
        subject: EMAIL_CONFIG.TEMPLATE.SUBJECT,
        
        // Booking reference
        booking_reference: bookingData.bookingReference || 'UT' + Math.random().toString(36).substr(2, 8).toUpperCase(),
        
        // Passenger details
        passenger_name: `${bookingData.firstName} ${bookingData.middleName || ''} ${bookingData.lastName}`.trim(),
        passenger_email: bookingData.email,
        passenger_phone: bookingData.phone,
        passenger_dob: bookingData.dateOfBirth,
        passenger_gender: bookingData.gender,
        passenger_nationality: bookingData.nationality,
        passport_number: bookingData.passportNumber,
        passport_expiry: bookingData.passportExpiry,
        
        // Emergency contact
        emergency_name: bookingData.emergencyName,
        emergency_phone: bookingData.emergencyPhone,
        emergency_relationship: bookingData.emergencyRelationship,
        
        // Flight details
        airline: flight.airline,
        flight_number: flight.flightNumber,
        departure_airport: flight.departure.airport,
        departure_time: flight.departure.time,
        departure_date: flight.departure.date,
        arrival_airport: flight.arrival.airport,
        arrival_time: flight.arrival.time,
        arrival_date: flight.arrival.date,
        duration: flight.duration,
        class: flight.class,
        stops: flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`,
        aircraft: flight.aircraft,
        
        // Pricing
        flight_price: flight.price,
        original_price: flight.originalPrice || 'N/A',
        discount: flight.discount || 'N/A',
        subtotal: bookingData.subtotal || flight.price,
        taxes: bookingData.taxes || '0.00',
        total: bookingData.total || flight.price,
        
        // Payment method
        payment_method: bookingData.paymentMethod === 'creditCard' ? 'Credit Card' : 'PayPal',
        
        // Booking timestamp
        booking_date: new Date().toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        
        // Special flags
        is_urgent: flight.isUrgent ? 'Yes' : 'No',
        booking_source: 'Urgent Travel Website'
    };
}

// Fallback email function (if EmailJS fails)
function sendFallbackEmail(bookingData) {
    console.log('📧 Using fallback email method...');
    
    // Create a mailto link with formatted data
    const emailData = formatBookingEmailData(bookingData);
    const subject = encodeURIComponent(emailData.subject);
    const body = createEmailBody(emailData);
    const encodedBody = encodeURIComponent(body);
    
    const mailtoLink = `mailto:${EMAIL_CONFIG.ADMIN_EMAIL}?subject=${subject}&body=${encodedBody}`;
    
    // Open email client
    window.open(mailtoLink);
    
    return { success: true, message: 'Email client opened with booking details' };
}

// Create formatted email body for fallback
function createEmailBody(data) {
    return `
NEW FLIGHT BOOKING - URGENT TRAVEL

Booking Reference: ${data.booking_reference}
Booking Date: ${data.booking_date}

PASSENGER DETAILS:
==================
Name: ${data.passenger_name}
Email: ${data.passenger_email}
Phone: ${data.passenger_phone}
Date of Birth: ${data.passenger_dob}
Gender: ${data.passenger_gender}
Nationality: ${data.passenger_nationality}
Passport Number: ${data.passport_number}
Passport Expiry: ${data.passport_expiry}

EMERGENCY CONTACT:
==================
Name: ${data.emergency_name}
Phone: ${data.emergency_phone}
Relationship: ${data.emergency_relationship}

FLIGHT DETAILS:
===============
Airline: ${data.airline}
Flight Number: ${data.flight_number}
Route: ${data.departure_airport} → ${data.arrival_airport}
Departure: ${data.departure_time} on ${data.departure_date}
Arrival: ${data.arrival_time} on ${data.arrival_date}
Duration: ${data.duration}
Class: ${data.class}
Stops: ${data.stops}
Aircraft: ${data.aircraft}

PRICING:
========
Flight Price: ${data.flight_price}
Original Price: ${data.original_price}
Discount: ${data.discount}
Subtotal: $${data.subtotal}
Taxes: $${data.taxes}
Total: $${data.total}

PAYMENT:
========
Method: ${data.payment_method}

SPECIAL NOTES:
==============
Urgent Booking: ${data.is_urgent}
Source: ${data.booking_source}

---
This booking was made through the Urgent Travel website.
Please contact the passenger directly for any queries.
    `.trim();
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EMAIL_CONFIG,
        initializeEmailJS,
        sendBookingEmail,
        sendFallbackEmail,
        formatBookingEmailData,
        createEmailBody
    };
}
