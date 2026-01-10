# Admin Panel Setup Guide

## 🛡️ Admin Panel Overview

The admin panel allows you to:
- View all customer bookings
- Search and filter bookings
- Export booking data
- Manage booking status
- View detailed booking information

## 🔐 Admin Login

### Access the Admin Panel:
1. **Visit**: `http://localhost:3000/admin-login.html`
2. **Or click**: "Admin" link in the main website header

### Login Credentials:
- **Username**: `admin`
- **Password**: `admin123`

## 📊 Dashboard Features

### Statistics Overview:
- **Total Bookings**: All bookings ever made
- **Today's Bookings**: Bookings made today
- **Pending Bookings**: Bookings awaiting confirmation
- **Total Revenue**: Sum of all booking amounts

### Booking Management:
- **View Details**: Click the eye icon to see full booking information
- **Edit Booking**: Click the edit icon to modify booking details
- **Delete Booking**: Click the trash icon to remove bookings
- **Search**: Search by booking ID, passenger name, or email
- **Filter**: Filter by status (confirmed, pending, cancelled)
- **Date Filter**: Filter by today, this week, or this month

### Export Functionality:
- **CSV Export**: Download all bookings as CSV file
- **Includes**: All booking details, passenger info, flight details, payment info

## 📋 Booking Data Storage

### How Bookings are Stored:
- **Location**: Browser localStorage
- **Key Format**: `booking_UT12345678`
- **Data Format**: JSON with all booking details
- **Auto-Storage**: Bookings are automatically stored when customers complete bookings

### Data Included:
- Passenger information (name, email, phone, passport)
- Emergency contact details
- Flight details (airline, route, times, class)
- Payment information (method, amounts)
- Booking reference and timestamps

## 🔄 Auto-Refresh

The dashboard automatically refreshes every 30 seconds to show new bookings.

## 🧪 Testing the Admin Panel

### Test the Complete Flow:
1. **Make a Booking**:
   - Visit `http://localhost:3000`
   - Search for flights
   - Complete a booking
   - Note the booking ID (UT...)

2. **View in Admin Panel**:
   - Go to `http://localhost:3000/admin-login.html`
   - Login with admin credentials
   - Find your test booking
   - View details, edit, or delete

### Sample Test Data:
If you want to add sample bookings for testing:

```javascript
// Run this in browser console on admin dashboard
const sampleBooking = {
    bookingReference: 'UT12345678',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@email.com',
    phone: '+1-555-123-4567',
    flight: {
        airline: 'American Airlines',
        flightNumber: 'AA1234',
        departure: {
            airport: 'New York (JFK)',
            time: '08:30',
            date: '2024-12-01'
        },
        arrival: {
            airport: 'Los Angeles (LAX)',
            time: '11:45',
            date: '2024-12-01'
        },
        price: '$299'
    },
    total: '$334.88',
    paymentMethod: 'creditCard',
    bookingDate: new Date().toISOString(),
    status: 'confirmed'
};

localStorage.setItem('booking_UT12345678', JSON.stringify(sampleBooking));
```

## 🔒 Security Notes

### Current Implementation:
- **Client-Side**: Admin panel runs in browser
- **Local Storage**: Data stored locally
- **Demo Credentials**: Hardcoded for demonstration

### Production Considerations:
- **Server-Side**: Move to secure server
- **Database**: Use proper database instead of localStorage
- **Authentication**: Implement proper user management
- **HTTPS**: Use secure connections
- **Access Control**: Implement role-based permissions

## 📱 Mobile Responsive

The admin panel is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## 🚨 Troubleshooting

### Common Issues:

#### Admin Login Not Working:
- Check credentials: `admin` / `admin123`
- Clear browser cache
- Check console for errors

#### No Bookings Showing:
- Make sure customers have completed bookings
- Check localStorage in browser dev tools
- Look for `booking_` keys

#### Export Not Working:
- Check browser download settings
- Ensure pop-ups are allowed
- Try different browser

### Debug Commands:
```javascript
// Check if admin is logged in
console.log(localStorage.getItem('adminSession'));

// View all bookings
Object.keys(localStorage).filter(key => key.startsWith('booking_'));

// Clear all bookings (for testing)
Object.keys(localStorage).filter(key => key.startsWith('booking_')).forEach(key => localStorage.removeItem(key));
```

## 📞 Support

For admin panel issues:
1. Check browser console for errors
2. Verify localStorage has booking data
3. Test with sample data
4. Check network connectivity

The admin panel provides a complete booking management system for monitoring and managing customer bookings!
