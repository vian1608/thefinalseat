# Email Notification Setup Guide

This guide will help you set up email notifications for flight bookings.

## 📧 Email Service Setup (EmailJS)

### Step 1: Create EmailJS Account
1. Go to [EmailJS.com](https://www.emailjs.com/)
2. Sign up for a free account
3. Verify your email address

### Step 2: Create Email Service
1. In EmailJS dashboard, go to "Email Services"
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions for your provider
5. Note down your **Service ID**

### Step 3: Create Email Template
1. Go to "Email Templates"
2. Click "Create New Template"
3. Use this template:

**Subject:** `New Flight Booking - Urgent Travel`

**Template Content:**
```html
<h2>New Flight Booking - Urgent Travel</h2>

<h3>Booking Reference: {{booking_reference}}</h3>
<p><strong>Booking Date:</strong> {{booking_date}}</p>

<h3>Passenger Details:</h3>
<ul>
    <li><strong>Name:</strong> {{passenger_name}}</li>
    <li><strong>Email:</strong> {{passenger_email}}</li>
    <li><strong>Phone:</strong> {{passenger_phone}}</li>
    <li><strong>Date of Birth:</strong> {{passenger_dob}}</li>
    <li><strong>Gender:</strong> {{passenger_gender}}</li>
    <li><strong>Nationality:</strong> {{passenger_nationality}}</li>
    <li><strong>Passport Number:</strong> {{passport_number}}</li>
    <li><strong>Passport Expiry:</strong> {{passport_expiry}}</li>
</ul>

<h3>Emergency Contact:</h3>
<ul>
    <li><strong>Name:</strong> {{emergency_name}}</li>
    <li><strong>Phone:</strong> {{emergency_phone}}</li>
    <li><strong>Relationship:</strong> {{emergency_relationship}}</li>
</ul>

<h3>Flight Details:</h3>
<ul>
    <li><strong>Airline:</strong> {{airline}}</li>
    <li><strong>Flight Number:</strong> {{flight_number}}</li>
    <li><strong>Route:</strong> {{departure_airport}} → {{arrival_airport}}</li>
    <li><strong>Departure:</strong> {{departure_time}} on {{departure_date}}</li>
    <li><strong>Arrival:</strong> {{arrival_time}} on {{arrival_date}}</li>
    <li><strong>Duration:</strong> {{duration}}</li>
    <li><strong>Class:</strong> {{class}}</li>
    <li><strong>Stops:</strong> {{stops}}</li>
    <li><strong>Aircraft:</strong> {{aircraft}}</li>
</ul>

<h3>Pricing:</h3>
<ul>
    <li><strong>Flight Price:</strong> {{flight_price}}</li>
    <li><strong>Original Price:</strong> {{original_price}}</li>
    <li><strong>Discount:</strong> {{discount}}</li>
    <li><strong>Subtotal:</strong> ${{subtotal}}</li>
    <li><strong>Taxes:</strong> ${{taxes}}</li>
    <li><strong>Total:</strong> ${{total}}</li>
</ul>

<h3>Payment:</h3>
<ul>
    <li><strong>Method:</strong> {{payment_method}}</li>
</ul>

<h3>Special Notes:</h3>
<ul>
    <li><strong>Urgent Booking:</strong> {{is_urgent}}</li>
    <li><strong>Source:</strong> {{booking_source}}</li>
</ul>

<hr>
<p><em>This booking was made through the Urgent Travel website.</em></p>
<p><em>Please contact the passenger directly for any queries.</em></p>
```

4. Note down your **Template ID**

### Step 4: Get Public Key
1. Go to "Account" → "General"
2. Copy your **Public Key**

### Step 5: Update Configuration
1. Open `email-config.js`
2. Replace these values:

```javascript
const EMAIL_CONFIG = {
    SERVICE_ID: 'your_service_id_here',        // From Step 2
    TEMPLATE_ID: 'your_template_id_here',      // From Step 3
    PUBLIC_KEY: 'your_public_key_here',        // From Step 4
    ADMIN_EMAIL: 'your-email@example.com',     // Your email address
    // ... rest of config
};
```

## 🔧 Alternative Setup (Fallback Method)

If you don't want to use EmailJS, the system will automatically fall back to opening your email client with pre-filled booking details.

### To use fallback method:
1. Keep the current `email-config.js` as is
2. The system will automatically use `mailto:` links
3. When someone books, it will open your email client with all booking details

## 🧪 Testing the Email System

### Test EmailJS Setup:
1. Complete a test booking
2. Check your email for the notification
3. Check browser console for any errors

### Test Fallback Method:
1. Complete a test booking
2. Your email client should open with pre-filled details
3. Send the email manually

## 📋 Email Template Variables

The system sends these variables to your email template:

| Variable | Description |
|----------|-------------|
| `booking_reference` | Unique booking reference |
| `passenger_name` | Full passenger name |
| `passenger_email` | Passenger email |
| `passenger_phone` | Passenger phone |
| `airline` | Airline name |
| `flight_number` | Flight number |
| `departure_airport` | Departure airport |
| `arrival_airport` | Arrival airport |
| `departure_time` | Departure time |
| `departure_date` | Departure date |
| `total` | Total booking amount |
| `payment_method` | Payment method used |

## 🚨 Troubleshooting

### Email not sending:
1. Check EmailJS configuration
2. Verify service is active
3. Check template variables match
4. Look at browser console for errors

### Fallback not working:
1. Check if email client is configured
2. Verify `ADMIN_EMAIL` is set correctly

### Template variables not showing:
1. Ensure variable names match exactly
2. Check template syntax
3. Test with simple template first

## 📞 Support

If you need help setting up the email system:
1. Check EmailJS documentation
2. Test with simple template first
3. Use browser console to debug issues
