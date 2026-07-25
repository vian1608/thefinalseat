import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { bookingAPI } from '../../../shared/api/api';
import { SUPPORT_PHONE_DISPLAY } from '../../../shared/constants/supportContact';
import './MyBookingsPage.css';

function MyBookings() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [searched, setSearched] = useState(false);

  // Run initial search if user is logged in
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        if (userObj && userObj.email) {
          setSearchQuery(userObj.email);
          performSearch(userObj.email);
        }
      } catch (e) {
        console.error('Failed to parse logged in user details:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performSearch = async (queryToSearch) => {
    const q = queryToSearch || searchQuery;
    if (!q || !q.trim()) {
      setError('Please enter a confirmation code or email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const response = await bookingAPI.search(q.trim());
      if (response.success) {
        setBookings(response.data || []);
      } else {
        setError('Failed to fetch bookings. Please try again.');
      }
    } catch (err) {
      console.error('Search bookings failed:', err);
      setError(err.response?.data?.error || 'Unable to retrieve bookings. Check your connection or search reference.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    performSearch();
  };

  const getBookingStatusBadge = (status) => {
    const s = String(status || 'PENDING').toUpperCase();
    if (s === 'DONE' || s === 'CONFIRMED') {
      return <span className="status-badge status-badge--done">Confirmed</span>;
    }
    if (s === 'FAILED' || s === 'CANCELLED') {
      return <span className="status-badge status-badge--failed">Cancelled</span>;
    }
    return <span className="status-badge status-badge--pending">Pending</span>;
  };

  const getPaymentBadge = (payStatus) => {
    const ps = String(payStatus || 'PENDING').toUpperCase();
    if (ps === 'PAID') {
      return <span className="status-badge status-badge--done" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}><i className="fas fa-check-circle"></i> Paid</span>;
    }
    if (ps === 'FAILED') {
      return <span className="status-badge status-badge--failed" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}><i className="fas fa-exclamation-triangle"></i> Payment Failed</span>;
    }
    return <span className="status-badge status-badge--pending" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}><i className="fas fa-clock"></i> Payment Pending</span>;
  };

  const deriveRouteDisplay = (b) => {
    const origin = b.origin_code || b.flights?.[0]?.departure_airport || b.flight_details?.departure?.airport;
    const dest = b.destination_code || b.flights?.[0]?.arrival_airport || b.flight_details?.arrival?.airport;
    if (origin && dest) return `${origin} to ${dest}`;
    return 'Details unavailable';
  };

  const deriveCarrier = (b) => {
    return b.carrier || b.airline || b.flight_details?.airline || b.flights?.[0]?.airline || 'Details unavailable';
  };

  const deriveDepartureDate = (b) => {
    const rawDate = b.departure_date || b.flights?.[0]?.departure_time || b.flights?.[0]?.departure_date || b.flight_details?.departure?.date;
    if (!rawDate) return 'Details unavailable';
    try {
      return new Date(rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return rawDate;
    }
  };

  const derivePassengerName = (b) => {
    if (b.passenger_name && b.passenger_name !== 'Valued Customer') return b.passenger_name;
    const t0 = b.travellers?.[0];
    if (t0 && t0.first_name) {
      return [t0.first_name, t0.middle_name, t0.last_name].filter(Boolean).join(' ');
    }
    return 'Details unavailable';
  };

  return (
    <div className="my-bookings-page">
      <Helmet>
        <title>My Bookings | The Final Seat</title>
      </Helmet>

      <div className="bookings-container">
        <header className="bookings-header">
          <h1>Track Your Bookings</h1>
          <p>Retrieve, manage, and view confirmation details using your confirmation code or email address.</p>
        </header>

        <div className="bookings-layout">
          {/* Main Search Panel */}
          <div className="bookings-main-card">
            <form onSubmit={handleSearchSubmit} className="search-form-wrapper">
              <div className="search-input-group">
                <i className="fas fa-search search-icon"></i>
                <input
                  type="text"
                  placeholder="Enter confirmation code (e.g. TFS-2026-AB1234) or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input-field"
                />
                <button type="submit" className="search-submit-btn" disabled={loading}>
                  {loading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Retrieve'}
                </button>
              </div>
            </form>

            {error && (
              <div className="bookings-error-banner" role="alert">
                <i className="fas fa-exclamation-circle"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Results Section */}
            <div className="bookings-results-section">
              {loading ? (
                <div className="bookings-state-container">
                  <i className="fas fa-circle-notch fa-spin spinner-icon"></i>
                  <p>Searching reservation database...</p>
                </div>
              ) : bookings.length > 0 ? (
                <div className="bookings-list-wrapper">
                  <div className="bookings-list-title">
                    <h3>Matches Found ({bookings.length})</h3>
                  </div>

                  <div className="bookings-grid-list">
                    {bookings.map((booking) => {
                      const carrierStr = deriveCarrier(booking);
                      const isAmtrak = carrierStr.toLowerCase().includes('amtrak');
                      const payStatus = String(booking.payment_status || 'PENDING').toLowerCase();
                      const isPaid = payStatus === 'paid';
                      const isFailed = payStatus === 'failed';

                      return (
                        <div key={booking.id} className="booking-card-item">
                          <div className="booking-card-top">
                            <div className="card-ref-block">
                              <span className="ref-label">CONFIRMATION CODE</span>
                              <strong className="ref-value">{booking.confirmation_code || booking.confirmationCode}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              {getBookingStatusBadge(booking.status)}
                              {getPaymentBadge(booking.payment_status)}
                            </div>
                          </div>

                          <div className="booking-card-body">
                            <div className="booking-info-grid">
                              <div className="info-column">
                                <span className="info-label">Passenger Name</span>
                                <strong className="info-value">{derivePassengerName(booking)}</strong>
                              </div>
                              <div className="info-column">
                                <span className="info-label">Flight Route</span>
                                <strong className="info-value">
                                  <i className={`fas ${isAmtrak ? 'fa-train' : 'fa-plane'} route-symbol`}></i>
                                  {deriveRouteDisplay(booking)}
                                </strong>
                              </div>
                              <div className="info-column">
                                <span className="info-label">Airline / Transit</span>
                                <strong className="info-value">{carrierStr}</strong>
                              </div>
                              <div className="info-column">
                                <span className="info-label">Travel Date</span>
                                <strong className="info-value">{deriveDepartureDate(booking)}</strong>
                              </div>
                              <div className="info-column">
                                <span className="info-label">Total Amount</span>
                                <strong className="info-value">${parseFloat(booking.customer_price || booking.amount || booking.total_amount || 0).toFixed(2)} {booking.currency || 'USD'}</strong>
                              </div>
                              <div className="info-column">
                                <span className="info-label">Booking Date</span>
                                <strong className="info-value">{booking.created_at ? new Date(booking.created_at).toLocaleDateString() : 'N/A'}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="booking-card-actions">
                            {isPaid ? (
                              <Link 
                                to={`/confirmation/success?type=booking&booking_id=${booking.id}&code=${booking.confirmation_code || booking.confirmationCode}`} 
                                className="view-ticket-btn"
                              >
                                <i className="fas fa-ticket-alt"></i> View E-Ticket Confirmation
                              </Link>
                            ) : (
                              <Link 
                                to="/booking" 
                                className="view-ticket-btn"
                                style={{ backgroundColor: isFailed ? '#dc2626' : '#d97706', borderColor: isFailed ? '#b91c1c' : '#b45309' }}
                              >
                                <i className="fas fa-redo"></i> {isFailed ? 'Retry Payment (Card Failed)' : 'Retry Payment'}
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : searched ? (
                <div className="bookings-state-container">
                  <div className="empty-icon-circle">
                    <i className="fas fa-calendar-times"></i>
                  </div>
                  <h3>No Bookings Found</h3>
                  <p>We couldn't find any reservations matching <strong>"{searchQuery}"</strong>. Please verify your reference number and search again.</p>
                </div>
              ) : (
                <div className="bookings-state-container">
                  <div className="search-prompt-icon">
                    <i className="fas fa-passport"></i>
                  </div>
                  <h3>Retrieve Booking Information</h3>
                  <p>Enter your unique 12-character confirmation code (e.g. TFS-2026-AB1234) or your associated primary passenger email to search.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar widget */}
          <div className="bookings-sidebar-card">
            <h3>Need Assistance?</h3>
            <p>If you cannot locate your reservation or need to request immediate changes, flight swaps, or accessibility support, contact our helpdesk:</p>
            <div className="sidebar-phone-box">
              <i className="fas fa-phone-alt"></i>
              <div>
                <span>Call Priority Desk</span>
                <strong>{SUPPORT_PHONE_DISPLAY}</strong>
              </div>
            </div>
            <div className="sidebar-notice-box">
              <i className="fas fa-info-circle"></i>
              <p>Tickets labeled as "Pending" will be finalized by our logisticians within 2-4 hours. Check your inbox for updates.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyBookings;
