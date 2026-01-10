import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import './Admin.css';

function AdminDashboard() {
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [bookingsRes, statsRes] = await Promise.all([
        adminAPI.getBookings(),
        adminAPI.getStats()
      ]);
      setBookings(bookingsRes.data || []);
      setStats(statsRes.data || {});
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="container">
        <h1>Admin Dashboard</h1>
        
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Bookings</h3>
              <p>{stats.totalBookings || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Confirmed</h3>
              <p>{stats.confirmedBookings || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Total Revenue</h3>
              <p>${stats.totalRevenue?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="stat-card">
              <h3>Urgent Bookings</h3>
              <p>{stats.urgentBookings || 0}</p>
            </div>
          </div>
        )}

        <div className="bookings-section">
          <h2>Recent Bookings</h2>
          <div className="bookings-table">
            {bookings.length === 0 ? (
              <p>No bookings yet</p>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="booking-row">
                  <div>{booking.bookingReference}</div>
                  <div>{booking.firstName} {booking.lastName}</div>
                  <div>{booking.email}</div>
                  <div>{booking.total}</div>
                  <div>{booking.status}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
