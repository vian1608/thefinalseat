// Admin Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminDashboard();
});

// Initialize admin dashboard
function initializeAdminDashboard() {
    console.log('📊 Initializing admin dashboard...');
    
    // Check admin access
    if (!checkAdminAccess()) {
        return;
    }
    
    // Set admin welcome message
    const session = getCurrentAdminSession();
    if (session) {
        document.getElementById('adminWelcome').textContent = `Welcome, ${session.username}`;
    }
    
    // Load bookings data
    loadBookings();
    
    // Setup auto-refresh
    setupAutoRefresh();
    
    console.log('✅ Admin dashboard initialized');
}

// Load bookings from storage
function loadBookings() {
    console.log('📋 Loading bookings...');
    
    // Get bookings from localStorage
    const bookings = getAllBookings();
    
    // Update stats
    updateDashboardStats(bookings);
    
    // Display bookings
    displayBookings(bookings);
    
    console.log(`✅ Loaded ${bookings.length} bookings`);
}

// Get all bookings from storage
function getAllBookings() {
    const bookings = [];
    
    // Get bookings from localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('booking_')) {
            try {
                const bookingData = JSON.parse(localStorage.getItem(key));
                if (bookingData && bookingData.bookingReference) {
                    bookings.push(bookingData);
                }
            } catch (error) {
                console.error('Error parsing booking data:', error);
            }
        }
    }
    
    // Sort by date (newest first)
    bookings.sort((a, b) => new Date(b.bookingDate || b.timestamp) - new Date(a.bookingDate || a.timestamp));
    
    return bookings;
}

// Update dashboard statistics
function updateDashboardStats(bookings) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayBookings = bookings.filter(booking => {
        const bookingDate = new Date(booking.bookingDate || booking.timestamp);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() === today.getTime();
    });
    
    const pendingBookings = bookings.filter(booking => 
        booking.status === 'pending' || !booking.status
    );
    
    const totalRevenue = bookings.reduce((sum, booking) => {
        const amount = parseFloat(booking.total?.replace('$', '') || booking.flight?.price?.replace('$', '') || '0');
        return sum + amount;
    }, 0);
    
    // Update UI
    document.getElementById('totalBookings').textContent = bookings.length;
    document.getElementById('todayBookings').textContent = todayBookings.length;
    document.getElementById('pendingBookings').textContent = pendingBookings.length;
    document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
}

// Display bookings in table
function displayBookings(bookings) {
    const tableBody = document.getElementById('bookingsTableBody');
    const noBookings = document.getElementById('noBookings');
    
    if (bookings.length === 0) {
        tableBody.innerHTML = '';
        noBookings.style.display = 'block';
        return;
    }
    
    noBookings.style.display = 'none';
    
    tableBody.innerHTML = bookings.map(booking => {
        const bookingDate = new Date(booking.bookingDate || booking.timestamp);
        const flight = booking.flight || {};
        const passengerName = `${booking.firstName || ''} ${booking.lastName || ''}`.trim();
        const status = booking.status || 'confirmed';
        const amount = booking.total || flight.price || '$0';
        
        return `
            <tr>
                <td class="booking-id">${booking.bookingReference || 'N/A'}</td>
                <td>
                    <div class="passenger-name">${passengerName || 'N/A'}</div>
                    <div style="font-size: 0.8rem; color: #666;">${booking.email || 'N/A'}</div>
                </td>
                <td>
                    <div style="font-weight: 500;">${flight.airline || 'N/A'} ${flight.flightNumber || ''}</div>
                    <div class="flight-route">${flight.departure?.airport || 'N/A'} → ${flight.arrival?.airport || 'N/A'}</div>
                </td>
                <td>
                    <div style="font-weight: 500;">
                        ${booking.paymentMethod === 'creditCard' ? '💳 Credit Card' : '🅿️ PayPal'}
                        ${booking.paymentDetails ? ' ✅' : ' ⚠️'}
                    </div>
                    <div style="font-size: 0.8rem; color: #666;">
                        ${booking.paymentDetails ? 'Details Available' : 'No Details'}
                    </div>
                </td>
                <td>${bookingDate.toLocaleDateString()}</td>
                <td>
                    <span class="status-badge ${status}">${status}</span>
                </td>
                <td class="price">${amount}</td>
                <td>
                    <div class="booking-actions">
                        <button class="action-btn view" onclick="viewBooking('${booking.bookingReference}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn edit" onclick="editBooking('${booking.bookingReference}')" title="Edit Booking">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteBooking('${booking.bookingReference}')" title="Delete Booking">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter bookings
function filterBookings() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    const allBookings = getAllBookings();
    let filteredBookings = allBookings;
    
    // Search filter
    if (searchTerm) {
        filteredBookings = filteredBookings.filter(booking => {
            const passengerName = `${booking.firstName || ''} ${booking.lastName || ''}`.toLowerCase();
            const email = (booking.email || '').toLowerCase();
            const bookingId = (booking.bookingReference || '').toLowerCase();
            
            return passengerName.includes(searchTerm) || 
                   email.includes(searchTerm) || 
                   bookingId.includes(searchTerm);
        });
    }
    
    // Status filter
    if (statusFilter) {
        filteredBookings = filteredBookings.filter(booking => {
            const status = booking.status || 'confirmed';
            return status === statusFilter;
        });
    }
    
    // Date filter
    if (dateFilter) {
        const now = new Date();
        filteredBookings = filteredBookings.filter(booking => {
            const bookingDate = new Date(booking.bookingDate || booking.timestamp);
            
            switch (dateFilter) {
                case 'today':
                    return bookingDate.toDateString() === now.toDateString();
                case 'week':
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return bookingDate >= weekAgo;
                case 'month':
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return bookingDate >= monthAgo;
                default:
                    return true;
            }
        });
    }
    
    // Update stats for filtered data
    updateDashboardStats(filteredBookings);
    
    // Display filtered bookings
    displayBookings(filteredBookings);
}

// View booking details
function viewBooking(bookingId) {
    console.log('👁️ Viewing booking:', bookingId);
    
    const booking = getBookingById(bookingId);
    if (!booking) {
        alert('Booking not found');
        return;
    }
    
    // Create modal with booking details
    showBookingModal(booking, 'view');
}

// Edit booking
function editBooking(bookingId) {
    console.log('✏️ Editing booking:', bookingId);
    
    const booking = getBookingById(bookingId);
    if (!booking) {
        alert('Booking not found');
        return;
    }
    
    // Create modal with booking details for editing
    showBookingModal(booking, 'edit');
}

// Delete booking
function deleteBooking(bookingId) {
    console.log('🗑️ Deleting booking:', bookingId);
    
    if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
        return;
    }
    
    // Remove from localStorage
    localStorage.removeItem(`booking_${bookingId}`);
    
    // Refresh the dashboard
    loadBookings();
    
    alert('Booking deleted successfully');
}

// Get booking by ID
function getBookingById(bookingId) {
    const bookingData = localStorage.getItem(`booking_${bookingId}`);
    if (bookingData) {
        try {
            return JSON.parse(bookingData);
        } catch (error) {
            console.error('Error parsing booking data:', error);
        }
    }
    return null;
}

// Show booking modal
function showBookingModal(booking, mode) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    const flight = booking.flight || {};
    const passengerName = `${booking.firstName || ''} ${booking.middleName || ''} ${booking.lastName || ''}`.trim();
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #f1f3f4;">
                <h2><i class="fas fa-plane"></i> Booking Details - ${booking.bookingReference}</h2>
                <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">&times;</button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <h3><i class="fas fa-user"></i> Passenger Information</h3>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <p><strong>Name:</strong> ${passengerName}</p>
                        <p><strong>Email:</strong> ${booking.email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${booking.phone || 'N/A'}</p>
                        <p><strong>Date of Birth:</strong> ${booking.dateOfBirth || 'N/A'}</p>
                        <p><strong>Gender:</strong> ${booking.gender || 'N/A'}</p>
                        <p><strong>Nationality:</strong> ${booking.nationality || 'N/A'}</p>
                        <p><strong>Passport:</strong> ${booking.passportNumber || 'N/A'}</p>
                        <p><strong>Passport Expiry:</strong> ${booking.passportExpiry || 'N/A'}</p>
                    </div>
                    
                    <h3><i class="fas fa-phone"></i> Emergency Contact</h3>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px;">
                        <p><strong>Name:</strong> ${booking.emergencyName || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${booking.emergencyPhone || 'N/A'}</p>
                        <p><strong>Relationship:</strong> ${booking.emergencyRelationship || 'N/A'}</p>
                    </div>
                </div>
                
                <div>
                    <h3><i class="fas fa-plane"></i> Flight Information</h3>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <p><strong>Airline:</strong> ${flight.airline || 'N/A'}</p>
                        <p><strong>Flight Number:</strong> ${flight.flightNumber || 'N/A'}</p>
                        <p><strong>Route:</strong> ${flight.departure?.airport || 'N/A'} → ${flight.arrival?.airport || 'N/A'}</p>
                        <p><strong>Departure:</strong> ${flight.departure?.time || 'N/A'} on ${flight.departure?.date || 'N/A'}</p>
                        <p><strong>Arrival:</strong> ${flight.arrival?.time || 'N/A'} on ${flight.arrival?.date || 'N/A'}</p>
                        <p><strong>Duration:</strong> ${flight.duration || 'N/A'}</p>
                        <p><strong>Class:</strong> ${flight.class || 'N/A'}</p>
                        <p><strong>Stops:</strong> ${flight.stops === 0 ? 'Direct' : `${flight.stops} stops`}</p>
                        <p><strong>Aircraft:</strong> ${flight.aircraft || 'N/A'}</p>
                    </div>
                    
                    <h3><i class="fas fa-credit-card"></i> Payment Information</h3>
                    <div class="payment-details-section">
                        <p><strong>Method:</strong> ${booking.paymentMethod === 'creditCard' ? 'Credit Card' : 'PayPal'}</p>
                        ${booking.paymentDetails ? `
                            ${booking.paymentDetails.method === 'creditCard' ? `
                                <div class="card-info">
                                    <div class="card-info-item">
                                        <strong>Card Type</strong>
                                        ${booking.paymentDetails.cardType || 'N/A'}
                                    </div>
                                    <div class="card-info-item">
                                        <strong>Card Number</strong>
                                        <span class="card-number">${booking.paymentDetails.cardNumber || 'N/A'}</span>
                                    </div>
                                    <div class="card-info-item">
                                        <strong>Cardholder Name</strong>
                                        ${booking.paymentDetails.cardHolderName || 'N/A'}
                                    </div>
                                    <div class="card-info-item">
                                        <strong>Expiry Date</strong>
                                        ${booking.paymentDetails.cardExpiry || 'N/A'}
                                    </div>
                                </div>
                                <div class="billing-info">
                                    <h4><i class="fas fa-map-marker-alt"></i> Billing Address</h4>
                                    <p><strong>Address:</strong> ${booking.paymentDetails.billingAddress || 'N/A'}</p>
                                    <p><strong>City:</strong> ${booking.paymentDetails.billingCity || 'N/A'}</p>
                                    <p><strong>State:</strong> ${booking.paymentDetails.billingState || 'N/A'}</p>
                                    <p><strong>ZIP:</strong> ${booking.paymentDetails.billingZip || 'N/A'}</p>
                                </div>
                            ` : `
                                <div class="paypal-info">
                                    <i class="fab fa-paypal"></i>
                                    <h4>PayPal Payment</h4>
                                    <p><strong>Email:</strong> ${booking.paymentDetails.email || 'N/A'}</p>
                                    <p><strong>Status:</strong> ${booking.paymentDetails.status || 'N/A'}</p>
                                </div>
                            `}
                        ` : ''}
                        <hr style="margin: 1rem 0; border: 1px solid #dee2e6;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <p><strong>Flight Price:</strong> ${flight.price || 'N/A'}</p>
                            <p><strong>Subtotal:</strong> ${booking.subtotal || 'N/A'}</p>
                            <p><strong>Taxes:</strong> ${booking.taxes || 'N/A'}</p>
                            <p><strong>Total:</strong> <span style="font-size: 1.2rem; font-weight: 700; color: var(--qa-gold);">${booking.total || 'N/A'}</span></p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 2px solid #f1f3f4; text-align: center;">
                <p><strong>Booking Date:</strong> ${new Date(booking.bookingDate || booking.timestamp).toLocaleString()}</p>
                <p><strong>Status:</strong> <span class="status-badge ${booking.status || 'confirmed'}">${booking.status || 'confirmed'}</span></p>
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

// Refresh bookings
function refreshBookings() {
    console.log('🔄 Refreshing bookings...');
    loadBookings();
}

// Export bookings
function exportBookings() {
    console.log('📤 Exporting bookings...');
    
    const bookings = getAllBookings();
    if (bookings.length === 0) {
        alert('No bookings to export');
        return;
    }
    
    // Create CSV content
    const csvContent = createCSVContent(bookings);
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log('✅ Bookings exported successfully');
}

// Create CSV content
function createCSVContent(bookings) {
    const headers = [
        'Booking ID', 'Passenger Name', 'Email', 'Phone', 'Flight', 'Route', 
        'Departure Date', 'Departure Time', 'Arrival Time', 'Class', 'Price', 
        'Payment Method', 'Card Type', 'Card Number', 'Cardholder Name', 'Expiry Date',
        'Billing Address', 'Billing City', 'Billing State', 'Billing ZIP',
        'Total Amount', 'Booking Date', 'Status'
    ];
    
    const rows = bookings.map(booking => {
        const flight = booking.flight || {};
        const passengerName = `${booking.firstName || ''} ${booking.lastName || ''}`.trim();
        const paymentDetails = booking.paymentDetails || {};
        
        return [
            booking.bookingReference || '',
            passengerName,
            booking.email || '',
            booking.phone || '',
            `${flight.airline || ''} ${flight.flightNumber || ''}`,
            `${flight.departure?.airport || ''} → ${flight.arrival?.airport || ''}`,
            flight.departure?.date || '',
            flight.departure?.time || '',
            flight.arrival?.time || '',
            flight.class || '',
            booking.total || flight.price || '',
            booking.paymentMethod === 'creditCard' ? 'Credit Card' : 'PayPal',
            paymentDetails.cardType || '',
            paymentDetails.cardNumber || '',
            paymentDetails.cardHolderName || '',
            paymentDetails.cardExpiry || '',
            paymentDetails.billingAddress || '',
            paymentDetails.billingCity || '',
            paymentDetails.billingState || '',
            paymentDetails.billingZip || '',
            booking.total || '',
            new Date(booking.bookingDate || booking.timestamp).toLocaleDateString(),
            booking.status || 'confirmed'
        ];
    });
    
    return [headers, ...rows].map(row => 
        row.map(field => `"${field}"`).join(',')
    ).join('\n');
}

// Setup auto-refresh
function setupAutoRefresh() {
    // Refresh every 30 seconds
    setInterval(() => {
        loadBookings();
    }, 30000);
}

// Store booking data (called from booking process)
function storeBookingData(bookingData) {
    const bookingId = bookingData.bookingReference;
    if (bookingId) {
        bookingData.timestamp = new Date().toISOString();
        localStorage.setItem(`booking_${bookingId}`, JSON.stringify(bookingData));
        console.log('✅ Booking stored in admin system:', bookingId);
    }
}
