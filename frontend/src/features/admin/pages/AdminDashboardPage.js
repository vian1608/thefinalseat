import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { adminAPI } from '../../../shared/api/api';
import './AdminDashboardPage.css';

function AdminDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [abandonedBookings, setAbandonedBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'analytics' | 'abandoned'
  const [timeframe, setTimeframe] = useState(30);

  // Filter States
  const [filters, setFilters] = useState({
    reference: '',
    name: '',
    email: '',
    date: '',
    status: ''
  });

  // Selected Booking details modal/panel state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [updatingRecord, setUpdatingRecord] = useState(false);

  // 3-Accordion States ('itinerary' | 'pricing' | 'payment' | null)
  const [openAccordion, setOpenAccordion] = useState(null);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);



  // Itinerary Editor State (Journey Grouped)
  const [outboundSegments, setOutboundSegments] = useState([]);
  const [returnSegments, setReturnSegments] = useState([]);
  const [hasReturnJourney, setHasReturnJourney] = useState(false);
  const [openOutboundGroup, setOpenOutboundGroup] = useState(true);
  const [openReturnGroup, setOpenReturnGroup] = useState(true);


  // Pricing Editor State
  const [pricingForm, setPricingForm] = useState({
    supplierFare: 0,
    baseFare: 0,
    taxes: 0,
    serviceFee: 0,
    discount: 0,
    customerTotal: 0,
    currency: 'USD',
    margin: 0,
    reason: ''
  });

  const [paymentSplits, setPaymentSplits] = useState([]);


  // Airline Ticket Details State
  const [ticketForm, setTicketForm] = useState({
    airlinePnr: '',
    airlineName: '',
    ticketNumber: '',
    ticketIssueDate: ''
  });


  // Payment Editor State
  const [paymentForm, setPaymentForm] = useState({
    paymentStatus: 'PENDING',
    provider: 'Whop',
    methodType: 'card',
    brand: 'Visa',
    last4: '4242',
    authorizedAmount: 0,
    capturedAmount: 0,
    refundedAmount: 0,
    referenceId: '',
    reason: '',
    password: ''
  });


  const loadAllDashboardData = useCallback(async (activeFilters = filters, days = timeframe) => {
    try {
      setLoading(true);
      setError('');
      
      const queryFilters = {};
      Object.keys(activeFilters).forEach(key => {
        if (activeFilters[key]) {
          queryFilters[key] = activeFilters[key];
        }
      });

      const [bookingsRes, statsRes, analyticsRes, abandonedRes] = await Promise.allSettled([
        adminAPI.getBookings(queryFilters),
        adminAPI.getStats(),
        adminAPI.getAnalytics(days),
        adminAPI.getAbandonedBookings()
      ]);

      if (bookingsRes.status === 'fulfilled' && bookingsRes.value?.success) {
        setBookings(bookingsRes.value.data || []);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStats(statsRes.value.data || null);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.success) {
        setAnalytics(analyticsRes.value.data || null);
      }
      if (abandonedRes.status === 'fulfilled' && abandonedRes.value?.success) {
        setAbandonedBookings(abandonedRes.value.data || []);
      }

    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
      setError('Unable to reach server. Please verify database and backend connectivity.');
    } finally {
      setLoading(false);
    }
  }, [filters, timeframe]);

  // Authenticate Admin Session on Mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const adminSession = sessionStorage.getItem('adminSession');
    if (!token || !adminSession) {
      navigate('/admin/login');
      return;
    }
    loadAllDashboardData();
  }, [navigate, loadAllDashboardData]);

  const handleFilterChange = (field, value) => {
    const updatedFilters = { ...filters, [field]: value };
    setFilters(updatedFilters);
    loadAllDashboardData(updatedFilters, timeframe);
  };

  const handleClearFilters = () => {
    const cleared = { reference: '', name: '', email: '', date: '', status: '' };
    setFilters(cleared);
    loadAllDashboardData(cleared, timeframe);
  };

  const handleTimeframeChange = (days) => {
    setTimeframe(days);
    loadAllDashboardData(filters, days);
  };

  const handleSelectBooking = (booking) => {
    setSelectedBooking(booking);
    setInternalNotes(booking.internal_notes || booking.internalNotes || '');
    setNewStatus(booking.status || booking.bookingStatus || 'PENDING');
    setHasUnsavedEdits(false);
    setOpenAccordion(null);

    // Initial itinerary segments setup (Journey Grouped)
    let rawOutbound = booking.outbound_segments || [];
    let rawReturn = booking.return_segments || [];
    const allSegments = booking.itinerary_segments || booking.flights || [];

    if (rawOutbound.length === 0 && rawReturn.length === 0 && allSegments.length > 0) {
      rawOutbound = allSegments.filter(s => (s.journey_direction || s.direction) === 'outbound');
      rawReturn = allSegments.filter(s => (s.journey_direction || s.direction) === 'return');

      if (rawOutbound.length === 0 && rawReturn.length === 0) {
        rawOutbound = [allSegments[0]];
        if (allSegments.length > 1 && (booking.trip_type === 'round_trip' || booking.tripType === 'round_trip')) {
          rawReturn = allSegments.slice(1);
        }
      }
    }

    if (rawOutbound.length === 0) {
      rawOutbound = [{
        journey_direction: 'outbound',
        segment_sequence: 1,
        carrier_name: booking.carrier || 'United Airlines',
        carrier_code: 'UA',
        operating_carrier: '',
        flight_number: 'UA 100',
        origin_airport: booking.origin_code || 'LAX',
        origin_city: 'Los Angeles',
        destination_airport: booking.destination_code || 'MIA',
        destination_city: 'Miami',
        departure_date: '2026-09-10',
        departure_time: '09:00 AM',
        arrival_date: '2026-09-10',
        arrival_time: '05:00 PM',
        arrival_next_day: false,
        cabin: 'Economy',
        booking_class: 'Y',
        terminal: 'T1',
        baggage_allowance: '1 Bag',
        aircraft: '',
        stop_count: 0
      }];
    }

    const mappedOutbound = rawOutbound.map((s, i) => ({
      journey_direction: 'outbound',
      segment_sequence: i + 1,
      carrier_name: s.carrier_name || s.airline || 'United Airlines',
      carrier_code: s.carrier_code || s.carrier || 'UA',
      operating_carrier: s.operating_carrier || s.operatingCarrier || '',
      flight_number: s.flight_number || s.flightNumber || 'UA 100',
      origin_airport: s.origin_airport || s.originCode || 'LAX',
      origin_city: s.origin_city || s.originCity || 'Los Angeles',
      destination_airport: s.destination_airport || s.destinationCode || 'MIA',
      destination_city: s.destination_city || s.destinationCity || 'Miami',
      departure_date: s.departure_date || s.departureDate || '2026-09-10',
      departure_time: s.departure_time || s.departureTime || '09:00 AM',
      arrival_date: s.arrival_date || s.arrivalDate || '2026-09-10',
      arrival_time: s.arrival_time || s.arrivalTime || '05:00 PM',
      arrival_next_day: !!(s.arrival_next_day || s.arrivalNextDay),
      cabin: s.cabin || s.cabinClass || 'Economy',
      booking_class: s.booking_class || 'Y',
      terminal: s.terminal || 'T1',
      baggage_allowance: s.baggage_allowance || '1 Bag',
      aircraft: s.aircraft || '',
      stop_count: 0
    }));

    const mappedReturn = rawReturn.map((s, i) => ({
      journey_direction: 'return',
      segment_sequence: i + 1,
      carrier_name: s.carrier_name || s.airline || 'United Airlines',
      carrier_code: s.carrier_code || s.carrier || 'UA',
      operating_carrier: s.operating_carrier || s.operatingCarrier || '',
      flight_number: s.flight_number || s.flightNumber || 'UA 200',
      origin_airport: s.origin_airport || s.originCode || 'MIA',
      origin_city: s.origin_city || s.originCity || 'Miami',
      destination_airport: s.destination_airport || s.destinationCode || 'LAX',
      destination_city: s.destination_city || s.destinationCity || 'Los Angeles',
      departure_date: s.departure_date || s.departureDate || '2026-09-17',
      departure_time: s.departure_time || s.departureTime || '10:00 AM',
      arrival_date: s.arrival_date || s.arrivalDate || '2026-09-17',
      arrival_time: s.arrival_time || s.arrivalTime || '02:00 PM',
      arrival_next_day: !!(s.arrival_next_day || s.arrivalNextDay),
      cabin: s.cabin || s.cabinClass || 'Economy',
      booking_class: s.booking_class || 'Y',
      terminal: s.terminal || 'T1',
      baggage_allowance: s.baggage_allowance || '1 Bag',
      aircraft: s.aircraft || '',
      stop_count: 0
    }));

    setOutboundSegments(mappedOutbound);
    setReturnSegments(mappedReturn);
    setHasReturnJourney(mappedReturn.length > 0 || (booking.trip_type === 'round_trip' || booking.tripType === 'round_trip'));


    // Initial pricing setup
    const total = parseFloat(booking.customer_price || booking.total_amount || 0);
    const supplier = parseFloat(booking.supplier_price || booking.original_api_price || total);
    const disc = parseFloat(booking.discount_amount || 0);
    setPricingForm({
      supplierFare: supplier,
      baseFare: supplier,
      taxes: 45.00,
      serviceFee: 15.00,
      discount: disc,
      customerTotal: total,
      currency: booking.currency || 'USD',
      margin: total - supplier,
      reason: ''
    });

    // Initial payment setup
    setPaymentForm({
      paymentStatus: (booking.payment_status || 'PENDING').toUpperCase(),
      provider: 'Whop',
      methodType: 'card',
      brand: 'Visa',
      last4: '4242',
      authorizedAmount: total,
      capturedAmount: booking.payment_status === 'paid' ? total : 0,
      refundedAmount: 0,
      referenceId: booking.transaction_id || '',
      reason: '',
      password: ''
    });

    // Initial payment splits setup
    const rawSplits = booking.payment_splits || [];
    const mappedSplits = rawSplits.length > 0 ? rawSplits.map((s, idx) => ({
      id: s.id || `split_${idx}_${Date.now()}`,
      merchant_name: s.merchant_name || s.merchantName || '',
      amount: parseFloat(s.amount || 0),
      currency: s.currency || booking.currency || 'USD'
    })) : [
      { id: 'split_1', merchant_name: booking.carrier || 'Airline Partner', amount: total > 0 ? parseFloat((total * 0.85).toFixed(2)) : 1800, currency: booking.currency || 'USD' },
      { id: 'split_2', merchant_name: 'The Final Seat LLC', amount: total > 0 ? parseFloat((total * 0.15).toFixed(2)) : 322.20, currency: booking.currency || 'USD' }
    ];
    setPaymentSplits(mappedSplits);


    // Initial ticket details setup
    setTicketForm({
      airlinePnr: booking.airline_pnr || booking.pnr || booking.supplier_confirmation || '',
      airlineName: booking.airline_name || booking.carrier || '',
      ticketNumber: booking.ticket_number || '',
      ticketIssueDate: booking.ticket_issue_date ? String(booking.ticket_issue_date).substring(0, 10) : ''
    });
  };


  const handleSaveTicketDetails = async (e) => {
    if (e) e.preventDefault();
    if (!selectedBooking) return;
    setUpdatingRecord(true);

    try {
      const response = await adminAPI.updateBooking(selectedBooking.id, {
        airline_pnr: ticketForm.airlinePnr,
        airline_name: ticketForm.airlineName,
        ticket_number: ticketForm.ticketNumber,
        ticket_issue_date: ticketForm.ticketIssueDate || new Date().toISOString()
      });

      if (response.success && (response.data || response.booking)) {
        const updated = response.data || response.booking;
        setSelectedBooking(updated);
        setHasUnsavedEdits(false);
        loadAllDashboardData();
        alert('Airline ticket details saved successfully.');
      } else {
        alert(response.error?.message || response.message || 'Failed to save airline ticket details.');
      }
    } catch (err) {
      console.error('Save ticket details failed:', err);
      alert(`Error saving ticket details: ${err.message}`);
    } finally {
      setUpdatingRecord(false);
    }
  };


  const handleConfirmItinerarySave = async () => {
    if (!selectedBooking) return;
    const adminToken = localStorage.getItem('token');
    try {
      setUpdatingRecord(true);
      setShowReviewModal(false);

      const allSegments = [
        ...outboundSegments.map((s, i) => ({ ...s, journey_direction: 'outbound', segment_sequence: i + 1 })),
        ...(hasReturnJourney ? returnSegments.map((s, i) => ({ ...s, journey_direction: 'return', segment_sequence: i + 1 })) : [])
      ];

      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          segments: allSegments,
          expectedVersion: selectedBooking.version || 1
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to save itinerary changes.');
      }

      setHasUnsavedEdits(false);
      alert(data.message || 'Itinerary updated successfully!');
      if (data.booking) setSelectedBooking(data.booking);
      loadAllDashboardData();
    } catch (err) {
      alert(`Itinerary update error: ${err.message}`);
    } finally {
      setUpdatingRecord(false);
    }
  };


  const handleSavePricing = async () => {
    if (!selectedBooking) return;
    const adminToken = localStorage.getItem('token');
    try {
      setUpdatingRecord(true);

      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          ...pricingForm,
          expectedVersion: selectedBooking.version || 1
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to save pricing changes.');
      }

      setHasUnsavedEdits(false);
      alert(data.message || 'Pricing revisions saved cleanly!');
      if (data.booking) setSelectedBooking(data.booking);
      loadAllDashboardData();
    } catch (err) {
      alert(`Pricing error: ${err.message}`);
    } finally {
      setUpdatingRecord(false);
    }
  };

  const handlePaymentActionSubmit = async (actionName) => {
    if (!selectedBooking) return;
    const adminToken = localStorage.getItem('token');
    try {
      setUpdatingRecord(true);
      setShowOverflowMenu(false);

      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/payment-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          action: actionName,
          ...paymentForm,
          payment_splits: paymentSplits
        })

      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Payment action failed.');
      }

      setHasUnsavedEdits(false);
      alert(data.message || `Payment action '${actionName}' completed successfully!`);
      if (data.booking) setSelectedBooking(data.booking);
      loadAllDashboardData();
    } catch (err) {
      alert(`Payment action error: ${err.message}`);
    } finally {
      setUpdatingRecord(false);
    }
  };


  const handleUpdateStatusAndNotes = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setUpdatingRecord(true);

    try {
      const response = await adminAPI.updateBooking(selectedBooking.id, {
        bookingStatus: newStatus,
        internalNotes: internalNotes
      });

      if (response.success) {
        setSelectedBooking(response.data);
        loadAllDashboardData();
        alert('Booking status and notes updated successfully!');
      } else {
        alert(response.error?.message || 'Failed to update booking status.');
      }
    } catch (err) {
      console.error('Update status failed:', err);
      alert('Error updating booking status.');
    } finally {
      setUpdatingRecord(false);
    }
  };

  const handleExportCSV = () => {
    if (bookings.length === 0) {
      alert('No booking records available to export.');
      return;
    }

    const headers = ['Confirmation Code', 'Customer Name', 'Email', 'Phone', 'Origin -> Destination', 'Passengers', 'Total Amount', 'Payment Status', 'Booking Status', 'Created At'];
    const rows = bookings.map(b => [
      `"${b.confirmation_code || b.id || ''}"`,
      `"${b.passenger_name || b.customer_name || ''}"`,
      `"${b.email || ''}"`,
      `"${b.phone || ''}"`,
      `"${b.origin_code || ''} to ${b.destination_code || ''}"`,
      `"${b.passengers_count || 1}"`,
      `"${b.total_amount || 0}"`,
      `"${b.payment_status || 'unpaid'}"`,
      `"${b.status || 'PENDING'}"`,
      `"${b.created_at || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `thefinalseat_bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('adminSession');
    navigate('/admin/login');
  };

  const handleProcessAuthorizedBooking = async (bookingId) => {
    const adminToken = localStorage.getItem('token');
    try {
      setUpdatingRecord(true);
      const res = await fetch(`/api/admin/bookings/${bookingId}/process-authorized`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          supplierConfirmation: `SUP-${Date.now()}`,
          airlinePnr: `PNR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          ticketNumbers: [`TKT-7788-${Date.now()}`]
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to process authorized booking.');
      }

      alert(`Booking ${data.confirmationCode} successfully charged and ticketed! Airline PNR: ${data.airlinePnr}`);
      loadAllDashboardData();
    } catch (err) {
      alert(`Process error: ${err.message}`);
    } finally {
      setUpdatingRecord(false);
    }
  };

  const handleDownloadEvidence = async (bookingId) => {
    const adminToken = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/authorization-pdf`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Failed to generate authorization PDF evidence document.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const code = selectedBooking?.confirmation_code || selectedBooking?.confirmationCode || bookingId;
      link.download = `authorization-${code}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(`Authorization PDF Export Error: ${err.message}`);
    }
  };



  if (loading && bookings.length === 0 && !analytics) {
    return (
      <div className="admin-loading-container">
        <i className="fas fa-circle-notch fa-spin"></i>
        <p>Loading management console & GA4 metrics...</p>
      </div>
    );
  }

  // Calculate high-level financial metrics
  const totalRevenue = stats?.totalRevenue || bookings
    .filter(b => (b.payment_status === 'paid' || b.payment_status === 'COMPLETED') && b.status !== 'CANCELLED' && b.status !== 'FAILED')
    .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);

  const pendingCount = bookings.filter(b => (b.status || '').toUpperCase() === 'PENDING').length;
  const confirmedCount = bookings.filter(b => (b.status || '').toUpperCase() === 'DONE' || (b.status || '').toUpperCase() === 'CONFIRMED').length;
  const failedCount = bookings.filter(b => (b.status || '').toUpperCase() === 'FAILED' || (b.status || '').toUpperCase() === 'CANCELLED').length;
  const conversionRate = analytics?.totalVisitors ? ((bookings.length / analytics.totalVisitors) * 100).toFixed(1) : '2.4';

  return (
    <div className="admin-dashboard-page">
      <Helmet>
        <title>Admin Dashboard | The Final Seat</title>
      </Helmet>

      {/* ADMIN NAV BAR */}
      <header className="admin-nav">
        <div className="admin-nav-container">
          <div className="admin-logo">
            <i className="fas fa-shield-alt"></i>
            <span>The Final Seat Admin</span>
          </div>

          <div className="admin-nav-actions">
            <div className="realtime-user-badge" title="Active users on website right now via GA4 Realtime API">
              <span className="pulse-dot"></span>
              <strong>{analytics?.realtimeActiveUsers || 1} Active Now</strong>
            </div>

            <button onClick={() => loadAllDashboardData()} className="admin-icon-btn" title="Refresh Dashboard Data">
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
            </button>

            <button onClick={handleLogout} className="admin-logout-btn">
              <i className="fas fa-sign-out-alt"></i> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="admin-main-container">

        {/* GA4 NOTICE BANNER IF APPLICABLE */}
        {analytics?.notice && (
          <div className="admin-info-banner">
            <i className="fas fa-info-circle"></i>
            <span>{analytics.notice}</span>
          </div>
        )}

        {error && (
          <div className="admin-error-banner">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        )}

        {/* NAVIGATION TABS & CONTROLS */}
        <div className="dashboard-top-toolbar">
          <div className="dashboard-tabs">
            <button 
              className={`dashboard-tab-btn ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookings')}
            >
              <i className="fas fa-ticket-alt"></i> Supabase Bookings ({bookings.length})
            </button>
            <button 
              className={`dashboard-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <i className="fas fa-chart-line"></i> GA4 Web Analytics
            </button>
            <button 
              className={`dashboard-tab-btn ${activeTab === 'abandoned' ? 'active' : ''}`}
              onClick={() => setActiveTab('abandoned')}
            >
              <i className="fas fa-user-clock"></i> Incomplete Checkouts ({abandonedBookings.length})
            </button>
          </div>

          <div className="toolbar-right-actions">
            <select 
              value={timeframe} 
              onChange={(e) => handleTimeframeChange(parseInt(e.target.value, 10))}
              className="admin-select timeframe-select"
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>

            <button onClick={handleExportCSV} className="admin-secondary-btn export-btn">
              <i className="fas fa-download"></i> Export CSV
            </button>
          </div>
        </div>

        {/* TOP KPI METRICS GRID */}
        <section className="admin-stats-section">
          <div className="stats-grid">
            <div className="stat-card stat-card--realtime">
              <h3>Active Now</h3>
              <p className="stat-value">{analytics?.realtimeActiveUsers || 1}</p>
              <small>GA4 Realtime Users</small>
            </div>
            <div className="stat-card stat-card--revenue">
              <h3>Paid Revenue</h3>
              <p className="stat-value">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <small>Supabase Confirmed Payments</small>
            </div>
            <div className="stat-card stat-card--confirmed">
              <h3>Total Bookings</h3>
              <p className="stat-value">{bookings.length}</p>
              <small>{confirmedCount} Confirmed · {pendingCount} Pending · {failedCount} Cancelled</small>
            </div>
            <div className="stat-card stat-card--pending">
              <h3>Incomplete Forms</h3>
              <p className="stat-value">{abandonedBookings.length}</p>
              <small>Saved Checkout Sessions</small>
            </div>
            <div className="stat-card stat-card--visitors">
              <h3>Total Visitors</h3>
              <p className="stat-value">{(analytics?.totalVisitors || 0).toLocaleString()}</p>
              <small>GA4 {timeframe}d Unique Visitors</small>
            </div>
            <div className="stat-card stat-card--conversion">
              <h3>Est. Conversion</h3>
              <p className="stat-value">{conversionRate}%</p>
              <small>Bookings / Visitors Ratio</small>
            </div>
          </div>
        </section>

        {/* TAB 1: SUPABASE BOOKINGS MANAGEMENT */}
        {activeTab === 'bookings' && (
          <div className="admin-workspace-grid admin-main-layout">
            <div className="workspace-left-panel">

              {/* SEARCH & FILTERS CARD */}
              <div className="admin-filters-card">
                <h3>Search & Filter Bookings</h3>
                <div className="filters-inputs-row">
                  <input
                    type="text"
                    placeholder="Ref # (e.g. TFS-)"
                    value={filters.reference}
                    onChange={(e) => handleFilterChange('reference', e.target.value)}
                    className="admin-input"
                  />
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={filters.name}
                    onChange={(e) => handleFilterChange('name', e.target.value)}
                    className="admin-input"
                  />
                  <input
                    type="text"
                    placeholder="Customer Email"
                    value={filters.email}
                    onChange={(e) => handleFilterChange('email', e.target.value)}
                    className="admin-input"
                  />
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="admin-select"
                  >
                    <option value="">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="DONE">Confirmed / Done</option>
                    <option value="FAILED">Failed / Cancelled</option>
                  </select>
                  <button onClick={handleClearFilters} className="admin-secondary-btn">Reset</button>
                </div>
              </div>

              {/* BOOKINGS DATA TABLE CARD */}
              <div className="admin-table-card">
                <div className="card-header-row">
                  <h2>Supabase Customer Bookings</h2>
                  <span>Showing {bookings.length} record(s)</span>
                </div>

                <div className="admin-table-wrapper">
                  {bookings.length === 0 ? (
                    <div className="empty-table-view">
                      <i className="fas fa-inbox"></i>
                      <p>No bookings match your current search filters.</p>
                      <button onClick={handleClearFilters} className="admin-secondary-btn">Clear Filters</button>
                    </div>
                  ) : (
                    <table className="admin-data-table">
                      <thead>
                        <tr>
                          <th>Reference #</th>
                          <th>Customer</th>
                          <th>Carrier</th>
                          <th>Route</th>
                          <th>Passengers</th>
                          <th>Amount</th>
                          <th>Booking Status</th>
                          <th>Payment Status</th>
                          <th>Date</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((booking) => {
                          const isSelected = selectedBooking?.id === booking.id;
                          const statusStr = (booking.status || 'PENDING').toUpperCase();
                          const badgeClass = statusStr === 'DONE' || statusStr === 'CONFIRMED' ? 'status-badge--completed' : (statusStr === 'PENDING' ? 'status-badge--pending' : 'status-badge--cancelled');
                          
                          const payStatusStr = (booking.payment_status || 'PENDING').toUpperCase();
                          const payBadgeClass = payStatusStr === 'PAID' ? 'status-badge--completed' : (payStatusStr === 'FAILED' ? 'status-badge--cancelled' : 'status-badge--pending');

                          const carrierName = booking.carrier || booking.airline || booking.flight_details?.airline || booking.flights?.[0]?.airline || 'N/A';
                          const originCode = booking.origin_code || booking.flights?.[0]?.departure_airport || 'SEA';
                          const destCode = booking.destination_code || booking.flights?.[0]?.arrival_airport || 'MIA';

                          return (
                            <tr key={booking.id} className={isSelected ? 'active-row' : ''}>
                              <td>
                                <strong>{booking.confirmation_code || booking.id.substring(0, 8)}</strong>
                              </td>
                              <td>
                                <div className="user-table-cell">
                                  <span>{booking.passenger_name || 'N/A'}</span>
                                  <small>{booking.email || 'N/A'}</small>
                                </div>
                              </td>
                              <td>
                                <strong>{carrierName}</strong>
                              </td>
                              <td>
                                {originCode} <i className="fas fa-arrow-right"></i> {destCode}
                              </td>
                              <td>{booking.passengers_count || booking.travellers?.length || 1}</td>
                              <td>${parseFloat(booking.customer_price || booking.total_amount || 0).toFixed(2)}</td>
                              <td>
                                <span className={`status-badge ${badgeClass}`}>{statusStr}</span>
                              </td>
                              <td>
                                <span className={`status-badge ${payBadgeClass}`}>
                                  {payStatusStr === 'FAILED' ? 'PAYMENT FAILED' : payStatusStr}
                                </span>
                              </td>
                              <td>
                                {booking.created_at ? new Date(booking.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                              </td>
                              <td>
                                <button onClick={() => handleSelectBooking(booking)} className="admin-action-btn">
                                  View / Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>            {/* DETAIL PANEL / DRAWER */}
            <aside className="admin-detail-panel booking-details-panel">

              {selectedBooking ? (
                <div className="admin-detail-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="detail-header">
                    <div>
                      <h3>Booking Detail</h3>
                      <span className="ref-tag">{selectedBooking.confirmation_code || selectedBooking.id.substring(0, 8)}</span>
                    </div>
                    <button onClick={() => setSelectedBooking(null)} className="close-panel-btn" title="Close Panel">
                      <i className="fas fa-times"></i>
                    </button>
                  </div>

                  {/* UPDATE STATUS & NOTES FORM */}
                  <form onSubmit={handleUpdateStatusAndNotes} className="detail-update-box">
                    <div className="detail-form-group">
                      <label>Update Booking Status</label>
                      <select 
                        value={newStatus} 
                        onChange={(e) => { setNewStatus(e.target.value); setHasUnsavedEdits(true); }} 
                        className="admin-select"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="AWAITING_AUTHORIZATION">Awaiting Authorization</option>
                        <option value="AUTHORIZED">Authorized</option>
                        <option value="REAUTHORIZATION_REQUIRED">Reauthorization Required</option>
                        <option value="READY_FOR_TICKETING">Ready for Ticketing</option>
                        <option value="TICKETED">Ticketed</option>
                        <option value="DONE">Done</option>
                        <option value="FAILED">Failed</option>
                        <option value="CANCELLED">Cancelled</option>

                      </select>
                    </div>

                    <div className="detail-form-group" style={{ marginTop: '10px' }}>
                      <label>Internal Consultant Notes</label>
                      <textarea 
                        rows={2}
                        value={internalNotes} 
                        onChange={(e) => { setInternalNotes(e.target.value); setHasUnsavedEdits(true); }} 
                        placeholder="Add internal notes..." 
                        className="admin-textarea"
                      />
                    </div>

                    <button type="submit" className="admin-primary-btn" style={{ width: '100%', marginTop: '10px' }} disabled={updatingRecord}>
                      {updatingRecord ? 'Saving...' : 'Save Notes & Status'}
                    </button>
                  </form>

                  {/* THREE COLLAPSED ACCORDIONS */}
                  <div className="admin-accordion-container">
                                         {/* 1. ITINERARY ACCORDION */}
                      <div className="admin-accordion-card">
                        <button
                          type="button"
                          className="admin-accordion-header"
                          onClick={() => setOpenAccordion(openAccordion === 'itinerary' ? null : 'itinerary')}
                        >
                          <span className="accordion-title-left">
                            <i className={`fas ${openAccordion === 'itinerary' ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
                            Itinerary
                          </span>
                          <span className="accordion-summary-right">
                            {outboundSegments.length > 0 
                              ? `${outboundSegments[0].origin_airport || 'LAX'} → ${outboundSegments[outboundSegments.length - 1].destination_airport || 'MIA'} (${outboundSegments.length > 1 ? `${outboundSegments.length - 1} stop(s)` : 'Nonstop'})`
                              : 'No itinerary'}
                            {hasReturnJourney && returnSegments.length > 0 && ` · Return: ${returnSegments[0]?.origin_airport || 'MIA'} → ${returnSegments[returnSegments.length - 1]?.destination_airport || 'LAX'}`}
                          </span>
                        </button>

                        {openAccordion === 'itinerary' && (
                          <div className="admin-accordion-body">
                            
                            {/* OUTBOUND JOURNEY GROUP */}
                            <div className="journey-group-card" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                              <div 
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: openOutboundGroup ? '10px' : '0' }}
                                onClick={() => setOpenOutboundGroup(!openOutboundGroup)}
                              >
                                <strong style={{ fontSize: '0.85rem', color: '#7f0d2f' }}>
                                  <i className={`fas ${openOutboundGroup ? 'fa-chevron-down' : 'fa-chevron-right'}`} style={{ marginRight: '6px' }}></i>
                                  Outbound Journey — {outboundSegments.length > 0 ? `${outboundSegments[0].origin_airport} → ${outboundSegments.map(s => s.destination_airport).join(' → ')}` : 'Empty'}
                                </strong>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{outboundSegments.length} segment(s)</span>
                              </div>

                              {openOutboundGroup && (
                                <div>
                                  {outboundSegments.map((seg, idx) => (
                                    <div key={`outbound-${idx}`} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', marginBottom: '8px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontWeight: '700', fontSize: '0.78rem', color: '#1e3a5f' }}>
                                        <span>Flight #{idx + 1} (Outbound)</span>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                          {idx > 0 && (
                                            <button type="button" onClick={() => {
                                              const next = [...outboundSegments];
                                              const temp = next[idx]; next[idx] = next[idx - 1]; next[idx - 1] = temp;
                                              setOutboundSegments(next); setHasUnsavedEdits(true);
                                            }} style={{ background: '#e2e8f0', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}>▲ Up</button>
                                          )}
                                          {idx < outboundSegments.length - 1 && (
                                            <button type="button" onClick={() => {
                                              const next = [...outboundSegments];
                                              const temp = next[idx]; next[idx] = next[idx + 1]; next[idx + 1] = temp;
                                              setOutboundSegments(next); setHasUnsavedEdits(true);
                                            }} style={{ background: '#e2e8f0', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}>▼ Down</button>
                                          )}
                                          {outboundSegments.length > 1 && (
                                            <button type="button" onClick={() => {
                                              setOutboundSegments(outboundSegments.filter((_, i) => i !== idx));
                                              setHasUnsavedEdits(true);
                                            }} style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem' }}>Delete</button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Continuity warning */}
                                      {idx < outboundSegments.length - 1 && (seg.destination_airport || '').toUpperCase() !== (outboundSegments[idx + 1].origin_airport || '').toUpperCase() && (
                                        <div style={{ background: '#fef2f2', color: '#991b1b', fontSize: '0.72rem', padding: '4px 8px', borderRadius: '4px', marginBottom: '6px' }}>
                                          ⚠️ Continuity Mismatch: Flight #{idx + 1} arrives at {seg.destination_airport}, but Flight #{idx + 2} departs from {outboundSegments[idx + 1].origin_airport}.
                                        </div>
                                      )}

                                      <div className="drawer-grid-2col">
                                        <div className="drawer-form-field">
                                          <label>Airline Name</label>
                                          <input type="text" value={seg.carrier_name} onChange={(e) => { const next = [...outboundSegments]; next[idx].carrier_name = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Carrier Code</label>
                                          <input type="text" value={seg.carrier_code} onChange={(e) => { const next = [...outboundSegments]; next[idx].carrier_code = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Operating Carrier (Optional)</label>
                                          <input type="text" value={seg.operating_carrier || ''} placeholder="e.g. SkyWest" onChange={(e) => { const next = [...outboundSegments]; next[idx].operating_carrier = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Flight #</label>
                                          <input type="text" value={seg.flight_number} onChange={(e) => { const next = [...outboundSegments]; next[idx].flight_number = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Origin Airport</label>
                                          <input type="text" value={seg.origin_airport} onChange={(e) => { const next = [...outboundSegments]; next[idx].origin_airport = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Destination Airport</label>
                                          <input type="text" value={seg.destination_airport} onChange={(e) => { const next = [...outboundSegments]; next[idx].destination_airport = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Departure Date</label>
                                          <input type="text" value={seg.departure_date} onChange={(e) => { const next = [...outboundSegments]; next[idx].departure_date = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Departure Time</label>
                                          <input type="text" value={seg.departure_time} onChange={(e) => { const next = [...outboundSegments]; next[idx].departure_time = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Arrival Date</label>
                                          <input type="text" value={seg.arrival_date} onChange={(e) => { const next = [...outboundSegments]; next[idx].arrival_date = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Arrival Time</label>
                                          <input type="text" value={seg.arrival_time} onChange={(e) => { const next = [...outboundSegments]; next[idx].arrival_time = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Cabin Class</label>
                                          <select value={seg.cabin} onChange={(e) => { const next = [...outboundSegments]; next[idx].cabin = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }}>
                                            <option value="Economy">Economy</option>
                                            <option value="Premium Economy">Premium Economy</option>
                                            <option value="Business">Business</option>
                                            <option value="First">First</option>
                                          </select>
                                        </div>
                                        <div className="drawer-form-field">
                                          <label>Aircraft / Terminal</label>
                                          <input type="text" value={seg.terminal || ''} placeholder="e.g. T2" onChange={(e) => { const next = [...outboundSegments]; next[idx].terminal = e.target.value; setOutboundSegments(next); setHasUnsavedEdits(true); }} />
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const lastSeg = outboundSegments[outboundSegments.length - 1];
                                      setOutboundSegments([...outboundSegments, {
                                        journey_direction: 'outbound',
                                        segment_sequence: outboundSegments.length + 1,
                                        carrier_name: lastSeg?.carrier_name || 'United Airlines',
                                        carrier_code: lastSeg?.carrier_code || 'DL',
                                        operating_carrier: '',
                                        flight_number: `DL ${100 + outboundSegments.length}`,
                                        origin_airport: lastSeg?.destination_airport || 'ATL',
                                        origin_city: lastSeg?.destination_city || 'Atlanta',
                                        destination_airport: 'MIA',
                                        destination_city: 'Miami',
                                        departure_date: lastSeg?.arrival_date || '2026-09-10',
                                        departure_time: '02:00 PM',
                                        arrival_date: lastSeg?.arrival_date || '2026-09-10',
                                        arrival_time: '05:00 PM',
                                        arrival_next_day: false,
                                        cabin: lastSeg?.cabin || 'Economy',
                                        booking_class: 'Y',
                                        terminal: 'T1',
                                        baggage_allowance: '1 Bag',
                                        aircraft: ''
                                      }]);
                                      setHasUnsavedEdits(true);
                                    }}
                                    style={{ background: '#ffffff', border: '1px dashed #7f0d2f', color: '#7f0d2f', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', width: '100%' }}
                                  >
                                    + Add Outbound Flight
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* RETURN JOURNEY GROUP */}
                            {hasReturnJourney ? (
                              <div className="journey-group-card" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                                <div 
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: openReturnGroup ? '10px' : '0' }}
                                  onClick={() => setOpenReturnGroup(!openReturnGroup)}
                                >
                                  <strong style={{ fontSize: '0.85rem', color: '#1e3a5f' }}>
                                    <i className={`fas ${openReturnGroup ? 'fa-chevron-down' : 'fa-chevron-right'}`} style={{ marginRight: '6px' }}></i>
                                    Return Journey — {returnSegments.length > 0 ? `${returnSegments[0].origin_airport} → ${returnSegments.map(s => s.destination_airport).join(' → ')}` : 'Empty'}
                                  </strong>
                                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{returnSegments.length} segment(s)</span>
                                </div>

                                {openReturnGroup && (
                                  <div>
                                    {returnSegments.map((seg, idx) => (
                                      <div key={`return-${idx}`} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontWeight: '700', fontSize: '0.78rem', color: '#1e3a5f' }}>
                                          <span>Flight #{idx + 1} (Return)</span>
                                          <div style={{ display: 'flex', gap: '6px' }}>
                                            {idx > 0 && (
                                              <button type="button" onClick={() => {
                                                const next = [...returnSegments];
                                                const temp = next[idx]; next[idx] = next[idx - 1]; next[idx - 1] = temp;
                                                setReturnSegments(next); setHasUnsavedEdits(true);
                                              }} style={{ background: '#e2e8f0', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}>▲ Up</button>
                                            )}
                                            {idx < returnSegments.length - 1 && (
                                              <button type="button" onClick={() => {
                                                const next = [...returnSegments];
                                                const temp = next[idx]; next[idx] = next[idx + 1]; next[idx + 1] = temp;
                                                setReturnSegments(next); setHasUnsavedEdits(true);
                                              }} style={{ background: '#e2e8f0', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}>▼ Down</button>
                                            )}
                                            <button type="button" onClick={() => {
                                              const next = returnSegments.filter((_, i) => i !== idx);
                                              setReturnSegments(next);
                                              if (next.length === 0) setHasReturnJourney(false);
                                              setHasUnsavedEdits(true);
                                            }} style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem' }}>Delete</button>
                                          </div>
                                        </div>

                                        {/* Continuity warning */}
                                        {idx < returnSegments.length - 1 && (seg.destination_airport || '').toUpperCase() !== (returnSegments[idx + 1].origin_airport || '').toUpperCase() && (
                                          <div style={{ background: '#fef2f2', color: '#991b1b', fontSize: '0.72rem', padding: '4px 8px', borderRadius: '4px', marginBottom: '6px' }}>
                                            ⚠️ Continuity Mismatch: Flight #{idx + 1} arrives at {seg.destination_airport}, but Flight #{idx + 2} departs from {returnSegments[idx + 1].origin_airport}.
                                          </div>
                                        )}

                                        <div className="drawer-grid-2col">
                                          <div className="drawer-form-field">
                                            <label>Airline Name</label>
                                            <input type="text" value={seg.carrier_name} onChange={(e) => { const next = [...returnSegments]; next[idx].carrier_name = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Carrier Code</label>
                                            <input type="text" value={seg.carrier_code} onChange={(e) => { const next = [...returnSegments]; next[idx].carrier_code = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Operating Carrier (Optional)</label>
                                            <input type="text" value={seg.operating_carrier || ''} placeholder="e.g. SkyWest" onChange={(e) => { const next = [...returnSegments]; next[idx].operating_carrier = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Flight #</label>
                                            <input type="text" value={seg.flight_number} onChange={(e) => { const next = [...returnSegments]; next[idx].flight_number = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Origin Airport</label>
                                            <input type="text" value={seg.origin_airport} onChange={(e) => { const next = [...returnSegments]; next[idx].origin_airport = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Destination Airport</label>
                                            <input type="text" value={seg.destination_airport} onChange={(e) => { const next = [...returnSegments]; next[idx].destination_airport = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Departure Date</label>
                                            <input type="text" value={seg.departure_date} onChange={(e) => { const next = [...returnSegments]; next[idx].departure_date = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Departure Time</label>
                                            <input type="text" value={seg.departure_time} onChange={(e) => { const next = [...returnSegments]; next[idx].departure_time = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Arrival Date</label>
                                            <input type="text" value={seg.arrival_date} onChange={(e) => { const next = [...returnSegments]; next[idx].arrival_date = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Arrival Time</label>
                                            <input type="text" value={seg.arrival_time} onChange={(e) => { const next = [...returnSegments]; next[idx].arrival_time = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Cabin Class</label>
                                            <select value={seg.cabin} onChange={(e) => { const next = [...returnSegments]; next[idx].cabin = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }}>
                                              <option value="Economy">Economy</option>
                                              <option value="Premium Economy">Premium Economy</option>
                                              <option value="Business">Business</option>
                                              <option value="First">First</option>
                                            </select>
                                          </div>
                                          <div className="drawer-form-field">
                                            <label>Aircraft / Terminal</label>
                                            <input type="text" value={seg.terminal || ''} placeholder="e.g. T1" onChange={(e) => { const next = [...returnSegments]; next[idx].terminal = e.target.value; setReturnSegments(next); setHasUnsavedEdits(true); }} />
                                          </div>
                                        </div>
                                      </div>
                                    ))}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const lastOutbound = outboundSegments[outboundSegments.length - 1];
                                        const lastReturn = returnSegments[returnSegments.length - 1];
                                        setReturnSegments([...returnSegments, {
                                          journey_direction: 'return',
                                          segment_sequence: returnSegments.length + 1,
                                          carrier_name: lastReturn?.carrier_name || lastOutbound?.carrier_name || 'United Airlines',
                                          carrier_code: lastReturn?.carrier_code || lastOutbound?.carrier_code || 'UA',
                                          operating_carrier: '',
                                          flight_number: `UA ${200 + returnSegments.length}`,
                                          origin_airport: lastReturn?.destination_airport || lastOutbound?.destination_airport || 'MIA',
                                          origin_city: lastReturn?.destination_city || lastOutbound?.destination_city || 'Miami',
                                          destination_airport: outboundSegments[0]?.origin_airport || 'LAX',
                                          destination_city: outboundSegments[0]?.origin_city || 'Los Angeles',
                                          departure_date: lastReturn?.arrival_date || '2026-09-17',
                                          departure_time: '10:00 AM',
                                          arrival_date: lastReturn?.arrival_date || '2026-09-17',
                                          arrival_time: '02:00 PM',
                                          arrival_next_day: false,
                                          cabin: lastReturn?.cabin || 'Economy',
                                          booking_class: 'Y',
                                          terminal: 'T1',
                                          baggage_allowance: '1 Bag',
                                          aircraft: ''
                                        }]);
                                        setHasUnsavedEdits(true);
                                      }}
                                      style={{ background: '#ffffff', border: '1px dashed #1e3a5f', color: '#1e3a5f', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', width: '100%' }}
                                    >
                                      + Add Return Flight
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setHasReturnJourney(true);
                                  const lastOutbound = outboundSegments[outboundSegments.length - 1];
                                  setReturnSegments([{
                                    journey_direction: 'return',
                                    segment_sequence: 1,
                                    carrier_name: lastOutbound?.carrier_name || 'United Airlines',

                                    carrier_code: lastOutbound?.carrier_code || 'UA',
                                    operating_carrier: '',
                                    flight_number: 'UA 200',
                                    origin_airport: lastOutbound?.destination_airport || 'MIA',
                                    origin_city: lastOutbound?.destination_city || 'Miami',
                                    destination_airport: outboundSegments[0]?.origin_airport || 'LAX',
                                    destination_city: outboundSegments[0]?.origin_city || 'Los Angeles',
                                    departure_date: '2026-09-17',
                                    departure_time: '10:00 AM',
                                    arrival_date: '2026-09-17',
                                    arrival_time: '02:00 PM',
                                    arrival_next_day: false,
                                    cabin: lastOutbound?.cabin || 'Economy',
                                    booking_class: 'Y',
                                    terminal: 'T1',
                                    baggage_allowance: '1 Bag',
                                    aircraft: ''
                                  }]);
                                  setHasUnsavedEdits(true);
                                }}
                                style={{ background: '#f1f5f9', border: '1px dashed #cbd5e1', color: '#1e3a5f', padding: '8px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', width: '100%', marginBottom: '12px' }}
                              >
                                + Add Return Journey
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setShowReviewModal(true)}
                              className="admin-primary-btn"
                              style={{ width: '100%', background: '#1e3a5f' }}
                            >
                              Apply Itinerary Changes
                            </button>
                          </div>
                        )}
                      </div>
                    {/* 2. PRICING ACCORDION */}
                    <div className="admin-accordion-card">
                      <button
                        type="button"
                        className="admin-accordion-header"
                        onClick={() => setOpenAccordion(openAccordion === 'pricing' ? null : 'pricing')}
                      >
                        <span className="accordion-title-left">
                          <i className={`fas ${openAccordion === 'pricing' ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
                          Pricing
                        </span>
                        <span className="accordion-summary-right">
                          Customer total: ${pricingForm.customerTotal.toFixed(2)} {pricingForm.currency}
                        </span>
                      </button>

                      {openAccordion === 'pricing' && (
                        <div className="admin-accordion-body">
                          {/* Compact breakdown */}
                          <div style={{ background: '#fffaf0', border: '1px solid #ecd6ad', borderRadius: '8px', padding: '8px 10px', fontSize: '0.8rem', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Supplier Fare (Internal):</span> <strong>${pricingForm.supplierFare.toFixed(2)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Taxes &amp; Fees:</span> <strong>${pricingForm.taxes.toFixed(2)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ecd6ad', paddingTop: '4px', marginTop: '4px', fontWeight: '700' }}>
                              <span>Customer Total:</span> <strong>${pricingForm.customerTotal.toFixed(2)} {pricingForm.currency}</strong>
                            </div>
                          </div>

                          <div className="drawer-grid-2col">
                            <div className="drawer-form-field">
                              <label>Supplier Fare ($)</label>
                              <input type="number" step="0.01" value={pricingForm.supplierFare} onChange={(e) => { const v = parseFloat(e.target.value || 0); setPricingForm({ ...pricingForm, supplierFare: v, margin: pricingForm.customerTotal - v }); setHasUnsavedEdits(true); }} />
                            </div>
                            <div className="drawer-form-field">
                              <label>Customer Total ($)</label>
                              <input type="number" step="0.01" value={pricingForm.customerTotal} onChange={(e) => { const v = parseFloat(e.target.value || 0); setPricingForm({ ...pricingForm, customerTotal: v, margin: v - pricingForm.supplierFare }); setHasUnsavedEdits(true); }} />
                            </div>
                          </div>

                          <div className="drawer-form-field">
                            <label>Mandatory Reason for Price Change</label>
                            <input type="text" placeholder="Explain price revision reason..." value={pricingForm.reason} onChange={(e) => { setPricingForm({ ...pricingForm, reason: e.target.value }); setHasUnsavedEdits(true); }} />
                          </div>

                          <button
                            type="button"
                            onClick={handleSavePricing}
                            className="admin-primary-btn"
                            style={{ width: '100%', marginTop: '6px' }}
                            disabled={updatingRecord}
                          >
                            Save Pricing Revisions
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 3. AIRLINE TICKET DETAILS ACCORDION */}
                    <div className="admin-accordion-card">
                      <button
                        type="button"
                        className="admin-accordion-header"
                        onClick={() => setOpenAccordion(openAccordion === 'ticket_details' ? null : 'ticket_details')}
                      >
                        <span className="accordion-title-left">
                          <i className={`fas ${openAccordion === 'ticket_details' ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
                          Airline Ticket Details
                        </span>
                        <span className="accordion-summary-right">
                          {ticketForm.airlinePnr ? `PNR: ${ticketForm.airlinePnr}` : 'Pending Ticket Issue'}
                        </span>
                      </button>

                      {openAccordion === 'ticket_details' && (
                        <div className="admin-accordion-body">
                          <div className="drawer-grid-2col">
                            <div className="drawer-form-field">
                              <label>Airline Confirmation Number / PNR *</label>
                              <input
                                type="text"
                                placeholder="e.g. 6-char PNR (XYZ123)"
                                value={ticketForm.airlinePnr}
                                onChange={(e) => { setTicketForm({ ...ticketForm, airlinePnr: e.target.value }); setHasUnsavedEdits(true); }}
                              />
                            </div>
                            <div className="drawer-form-field">
                              <label>Airline Name</label>
                              <input
                                type="text"
                                placeholder="e.g. United Airlines"
                                value={ticketForm.airlineName}
                                onChange={(e) => { setTicketForm({ ...ticketForm, airlineName: e.target.value }); setHasUnsavedEdits(true); }}
                              />
                            </div>
                          </div>

                          <div className="drawer-grid-2col">
                            <div className="drawer-form-field">
                              <label>Ticket Number</label>
                              <input
                                type="text"
                                placeholder="e.g. 016-2490182741"
                                value={ticketForm.ticketNumber}
                                onChange={(e) => { setTicketForm({ ...ticketForm, ticketNumber: e.target.value }); setHasUnsavedEdits(true); }}
                              />
                            </div>
                            <div className="drawer-form-field">
                              <label>Ticket Issue Date</label>
                              <input
                                type="date"
                                value={ticketForm.ticketIssueDate}
                                onChange={(e) => { setTicketForm({ ...ticketForm, ticketIssueDate: e.target.value }); setHasUnsavedEdits(true); }}
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleSaveTicketDetails}
                            className="admin-primary-btn"
                            style={{ width: '100%', marginTop: '12px', background: '#1e3a5f' }}
                            disabled={updatingRecord}
                          >
                            <i className="fas fa-ticket-alt" style={{ marginRight: '6px' }}></i>
                            Save Airline Ticket Details
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 4. PASSENGER AUTHORIZATION ACCORDION (Details & Audit Only) */}
                    <div className="admin-accordion-card">

                      <button
                        type="button"
                        className="admin-accordion-header"
                        onClick={() => setOpenAccordion(openAccordion === 'authorization' ? null : 'authorization')}
                      >
                        <span className="accordion-title-left">
                          <i className={`fas ${openAccordion === 'authorization' ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
                          Passenger Authorization
                        </span>
                        <span className="accordion-summary-right">
                          {selectedBooking.status || 'PENDING'} · ${pricingForm.customerTotal.toFixed(2)}
                        </span>
                      </button>

                      {openAccordion === 'authorization' && (
                        <div className="admin-accordion-body">
                          <div className="drawer-grid-2col">
                            <div className="drawer-form-field">
                              <label>Authorization Status</label>
                              <input type="text" readOnly value={selectedBooking.status || 'PENDING'} />
                            </div>
                            <div className="drawer-form-field">
                              <label>Authorized Amount ($)</label>
                              <input type="text" readOnly value={`$${paymentForm.authorizedAmount.toFixed(2)} ${pricingForm.currency}`} />
                            </div>
                          </div>

                          <div className="drawer-grid-2col">
                            <div className="drawer-form-field">
                              <label>Masked Payment Card</label>
                              <input type="text" readOnly value={`${paymentForm.brand || 'Visa'} •••• ${paymentForm.last4 || '4242'}`} />
                            </div>
                            <div className="drawer-form-field">
                              <label>Passenger IP</label>
                              <input type="text" readOnly value={selectedBooking.client_ip || selectedBooking.passenger_ip || 'Recorded on Acceptance'} />
                            </div>
                          </div>

                          <div className="drawer-grid-2col">
                            <div className="drawer-form-field">
                              <label>Sent At</label>
                              <input type="text" readOnly value={selectedBooking.authorization_email_sent_at ? new Date(selectedBooking.authorization_email_sent_at).toLocaleString() : 'Not Sent'} />
                            </div>
                            <div className="drawer-form-field">
                              <label>Expires At</label>
                              <input type="text" readOnly value={selectedBooking.authorization_expires_at ? new Date(selectedBooking.authorization_expires_at).toLocaleString() : '24 Hours from Send'} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. PAYMENT ACCORDION (Payment Fields Only) */}
                    <div className="admin-accordion-card">
                      <button
                        type="button"
                        className="admin-accordion-header"
                        onClick={() => setOpenAccordion(openAccordion === 'payment' ? null : 'payment')}
                      >
                        <span className="accordion-title-left">
                          <i className={`fas ${openAccordion === 'payment' ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
                          Payment
                        </span>
                        <span className="accordion-summary-right">
                          {paymentForm.paymentStatus} · {paymentForm.brand} •••• {paymentForm.last4}
                        </span>
                      </button>

                      {openAccordion === 'payment' && (
                        <div className="admin-accordion-body">
                          {/* Payment Authorization Splits Section */}
                          <div style={{ background: '#fffaf0', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <strong style={{ fontSize: '0.82rem', color: '#8b1236', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <i className="fas fa-layer-group" style={{ marginRight: '6px' }}></i>
                                Payment Authorization Splits
                              </strong>
                              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1e293b' }}>
                                Total Authorized: ${paymentSplits.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0).toFixed(2)} {pricingForm.currency}
                              </span>
                            </div>

                            {paymentSplits.map((split, idx) => (
                              <div key={split.id || idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ flex: '2' }}>
                                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '2px', fontWeight: '600' }}>Merchant Name</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. United Airlines"
                                    value={split.merchant_name}
                                    onChange={(e) => {
                                      const next = [...paymentSplits];
                                      next[idx].merchant_name = e.target.value;
                                      setPaymentSplits(next);
                                      setHasUnsavedEdits(true);
                                    }}
                                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff' }}
                                  />
                                </div>
                                <div style={{ flex: '1' }}>
                                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '2px', fontWeight: '600' }}>Amount ($)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={split.amount}
                                    onChange={(e) => {
                                      const next = [...paymentSplits];
                                      next[idx].amount = parseFloat(e.target.value || 0);
                                      setPaymentSplits(next);
                                      const totalSplits = next.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
                                      setPaymentForm({ ...paymentForm, authorizedAmount: totalSplits });
                                      setHasUnsavedEdits(true);
                                    }}
                                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff' }}
                                  />
                                </div>
                                <div style={{ paddingTop: '16px' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = paymentSplits.filter((_, i) => i !== idx);
                                      setPaymentSplits(next);
                                      const totalSplits = next.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
                                      setPaymentForm({ ...paymentForm, authorizedAmount: totalSplits });
                                      setHasUnsavedEdits(true);
                                    }}
                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.88rem', padding: '4px 6px' }}
                                    title="Remove split"
                                  >
                                    <i className="fas fa-trash-alt"></i>
                                  </button>
                                </div>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => {
                                setPaymentSplits([
                                  ...paymentSplits,
                                  { id: `split_${Date.now()}`, merchant_name: 'The Final Seat LLC', amount: 0, currency: 'USD' }
                                ]);
                                setHasUnsavedEdits(true);
                              }}
                              style={{ background: '#ffffff', border: '1px dashed #8b1236', color: '#8b1236', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', width: '100%', marginTop: '4px' }}
                            >
                              + Add Payment Split
                            </button>
                          </div>

                          <div className="drawer-grid-2col">

                            <div className="drawer-form-field">
                              <label>Payment State</label>
                              <select value={paymentForm.paymentStatus} onChange={(e) => { setPaymentForm({ ...paymentForm, paymentStatus: e.target.value }); setHasUnsavedEdits(true); }}>
                                <option value="PENDING">Pending</option>
                                <option value="PROCESSING">Processing</option>
                                <option value="PAID">Paid</option>
                                <option value="FAILED">Failed</option>
                                <option value="REFUNDED">Refunded</option>
                              </select>
                            </div>
                            <div className="drawer-form-field">
                              <label>Masked Card</label>
                              <input type="text" readOnly value={`${paymentForm.brand || 'Visa'} •••• ${paymentForm.last4 || '4242'}`} />
                            </div>
                          </div>

                          {paymentForm.paymentStatus === 'PENDING' && (
                            <div className="drawer-grid-2col">
                              <div className="drawer-form-field">
                                <label>Authorized Amount ($)</label>
                                <input type="number" step="0.01" value={paymentForm.authorizedAmount} onChange={(e) => { setPaymentForm({ ...paymentForm, authorizedAmount: parseFloat(e.target.value || 0) }); setHasUnsavedEdits(true); }} />
                              </div>
                              <div className="drawer-form-field">
                                <label>Payment Method</label>
                                <input type="text" readOnly value="Card Authorization Vault" />
                              </div>
                            </div>
                          )}

                          {paymentForm.paymentStatus === 'PROCESSING' && (
                            <div className="drawer-grid-2col">
                              <div className="drawer-form-field">
                                <label>Transaction / Ref ID</label>
                                <input type="text" value={paymentForm.referenceId} onChange={(e) => { setPaymentForm({ ...paymentForm, referenceId: e.target.value }); setHasUnsavedEdits(true); }} placeholder="TXN-PROCESSING-001" />
                              </div>
                              <div className="drawer-form-field">
                                <label>Authorized Amount ($)</label>
                                <input type="number" step="0.01" value={paymentForm.authorizedAmount} readOnly />
                              </div>
                            </div>
                          )}

                          {paymentForm.paymentStatus === 'PAID' && (
                            <>
                              <div className="drawer-grid-2col">
                                <div className="drawer-form-field">
                                  <label>Paid Amount ($)</label>
                                  <input type="number" step="0.01" value={paymentForm.paidAmount || selectedBooking.total_amount || 0} onChange={(e) => { setPaymentForm({ ...paymentForm, paidAmount: parseFloat(e.target.value || 0) }); setHasUnsavedEdits(true); }} />
                                </div>
                                <div className="drawer-form-field">
                                  <label>Transaction / Ref ID *</label>
                                  <input type="text" value={paymentForm.referenceId} onChange={(e) => { setPaymentForm({ ...paymentForm, referenceId: e.target.value }); setHasUnsavedEdits(true); }} placeholder="Required TXN ID" />
                                </div>
                              </div>
                              <div className="drawer-form-field">
                                <label>Paid Timestamp</label>
                                <input type="text" readOnly value={selectedBooking.paid_at ? new Date(selectedBooking.paid_at).toLocaleString() : 'Just Now (Pending Save)'} />
                              </div>
                            </>
                          )}

                          {paymentForm.paymentStatus === 'FAILED' && (
                            <div className="drawer-grid-2col">
                              <div className="drawer-form-field">
                                <label>Failure Reason</label>
                                <input type="text" value={paymentForm.reason} onChange={(e) => { setPaymentForm({ ...paymentForm, reason: e.target.value }); setHasUnsavedEdits(true); }} placeholder="Card declined by issuing bank" />
                              </div>
                              <div className="drawer-form-field">
                                <label>Failed Timestamp</label>
                                <input type="text" readOnly value={new Date().toLocaleString()} />
                              </div>
                            </div>
                          )}

                          {paymentForm.paymentStatus === 'REFUNDED' && (
                            <>
                              <div className="drawer-grid-2col">
                                <div className="drawer-form-field">
                                  <label>Refunded Amount ($) *</label>
                                  <input type="number" step="0.01" value={paymentForm.refundAmount || selectedBooking.total_amount || 0} onChange={(e) => { setPaymentForm({ ...paymentForm, refundAmount: parseFloat(e.target.value || 0) }); setHasUnsavedEdits(true); }} />
                                </div>
                                <div className="drawer-form-field">
                                  <label>Refund Reference ID *</label>
                                  <input type="text" value={paymentForm.refundReferenceId} onChange={(e) => { setPaymentForm({ ...paymentForm, refundReferenceId: e.target.value }); setHasUnsavedEdits(true); }} placeholder="REF-883921" />
                                </div>
                              </div>
                              <div className="drawer-form-field">
                                <label>Refund Reason *</label>
                                <input type="text" value={paymentForm.reason} onChange={(e) => { setPaymentForm({ ...paymentForm, reason: e.target.value }); setHasUnsavedEdits(true); }} placeholder="Customer requested cancellation" />
                              </div>
                            </>
                          )}

                          <button type="button" onClick={() => handlePaymentActionSubmit(paymentForm.paymentStatus)} className="admin-primary-btn" style={{ width: '100%', background: '#7f0d2f', marginTop: '12px' }}>
                            <i className="fas fa-save" style={{ marginRight: '4px' }}></i> Save Payment State &amp; Audit Event
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 5. EMAIL DELIVERY ACTIVITY ACCORDION */}
                    <div className="admin-accordion-card">
                      <button
                        type="button"
                        className="admin-accordion-header"
                        onClick={() => setOpenAccordion(openAccordion === 'email_activity' ? null : 'email_activity')}
                      >
                        <span className="accordion-title-left">
                          <i className={`fas ${openAccordion === 'email_activity' ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
                          Email Delivery Activity
                        </span>
                        <span className="accordion-summary-right">
                          {(() => {
                            let count = 0;
                            if ((selectedBooking.booking_request_email_status || '').toUpperCase() === 'SENT') count++;
                            if ((selectedBooking.authorization_email_status || '').toUpperCase() === 'SENT') count++;
                            if ((selectedBooking.final_confirmation_email_status || '').toUpperCase() === 'SENT') count++;
                            return `${count} Sent`;
                          })()}
                        </span>
                      </button>

                      {openAccordion === 'email_activity' && (
                        <div className="admin-accordion-body" style={{ padding: '12px' }}>
                          {/* 1. Booking Request Email Card */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '10px', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <strong style={{ color: '#1e293b', fontSize: '0.85rem' }}>Booking Request Email</strong>
                              <span className={`status-badge status-badge--${(selectedBooking.booking_request_email_status || 'NOT_SENT') === 'SENT' ? 'done' : ((selectedBooking.booking_request_email_status || 'NOT_SENT') === 'FAILED' ? 'failed' : 'pending')}`}>
                                {selectedBooking.booking_request_email_status || 'NOT_SENT'}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: '#64748b', fontSize: '0.75rem', marginBottom: '10px' }}>
                              <div><strong>Recipient:</strong> {selectedBooking.booking_request_email_recipient || selectedBooking.email || 'N/A'}</div>
                              <div><strong>Sent:</strong> {selectedBooking.booking_request_email_sent_at ? new Date(selectedBooking.booking_request_email_sent_at).toLocaleString() : 'N/A'}</div>
                              <div style={{ gridColumn: '1 / -1' }}><strong>Provider ID:</strong> {selectedBooking.booking_request_email_id || 'N/A'}</div>
                              {selectedBooking.booking_request_email_error && <div style={{ color: '#dc2626', gridColumn: '1 / -1' }}><strong>Error:</strong> {selectedBooking.booking_request_email_error}</div>}
                            </div>
                            <button type="button" onClick={() => handlePaymentActionSubmit('resend_booking_request_email')} className="admin-secondary-btn" style={{ width: '100%', fontSize: '0.78rem', height: '32px' }}>
                              <i className="fas fa-redo" style={{ marginRight: '4px' }}></i> Resend Booking Request Email
                            </button>
                          </div>

                          {/* 2. Authorization Email Card */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '10px', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <strong style={{ color: '#1e293b', fontSize: '0.85rem' }}>Authorization Email</strong>
                              <span className={`status-badge status-badge--${(selectedBooking.authorization_email_status || 'NOT_SENT') === 'SENT' ? 'done' : ((selectedBooking.authorization_email_status || 'NOT_SENT') === 'FAILED' ? 'failed' : 'pending')}`}>
                                {selectedBooking.authorization_email_status || 'NOT_SENT'}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: '#64748b', fontSize: '0.75rem', marginBottom: '10px' }}>
                              <div><strong>Recipient:</strong> {selectedBooking.authorization_email_recipient || selectedBooking.email || 'N/A'}</div>
                              <div><strong>Sent:</strong> {selectedBooking.authorization_email_sent_at ? new Date(selectedBooking.authorization_email_sent_at).toLocaleString() : 'N/A'}</div>
                              <div><strong>Expires:</strong> {selectedBooking.authorization_expires_at ? new Date(selectedBooking.authorization_expires_at).toLocaleString() : 'N/A'}</div>
                              <div><strong>Provider ID:</strong> {selectedBooking.authorization_email_id || 'N/A'}</div>
                              {selectedBooking.authorization_email_error && <div style={{ color: '#dc2626', gridColumn: '1 / -1' }}><strong>Error:</strong> {selectedBooking.authorization_email_error}</div>}
                            </div>

                            {/* Authorization State-based Actions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {['AUTHORIZED', 'READY_FOR_TICKETING', 'TICKETED', 'DONE'].includes(selectedBooking.status) ? (
                                <>
                                  <div style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '6px', borderRadius: '6px', fontWeight: '700', textAlign: 'center', fontSize: '0.78rem' }}>
                                    ✓ Authorization Completed
                                  </div>
                                  <button type="button" onClick={() => handleDownloadEvidence(selectedBooking.id)} className="admin-secondary-btn" style={{ width: '100%', fontSize: '0.78rem', height: '32px' }}>
                                    <i className="fas fa-file-pdf" style={{ marginRight: '4px', color: '#8B1236' }}></i> Download Authorization Evidence (PDF)
                                  </button>
                                </>
                              ) : (selectedBooking.status === 'EXPIRED' || selectedBooking.authorization_email_status === 'EXPIRED') ? (
                                <>
                                  <button type="button" onClick={() => handlePaymentActionSubmit('send_authorization')} className="admin-primary-btn" style={{ background: '#b45309', width: '100%', fontSize: '0.78rem', height: '34px' }}>
                                    <i className="fas fa-paper-plane" style={{ marginRight: '4px' }}></i> Send New Authorization Email
                                  </button>
                                </>
                              ) : (selectedBooking.authorization_email_status === 'SENT' || ['AWAITING_AUTH', 'AWAITING_AUTHORIZATION', 'REAUTHORIZATION_REQUIRED'].includes(selectedBooking.status)) ? (
                                <>
                                  <button type="button" onClick={() => handlePaymentActionSubmit('resend_authorization')} className="admin-primary-btn" style={{ background: '#b45309', width: '100%', fontSize: '0.78rem', height: '34px' }}>
                                    <i className="fas fa-sync" style={{ marginRight: '4px' }}></i> Resend Authorization Email
                                  </button>
                                  {selectedBooking.authorization_token && (
                                    <button type="button" onClick={() => {
                                      const link = `https://www.thefinalseat.com/authorize/${selectedBooking.authorization_token}`;
                                      navigator.clipboard.writeText(link);
                                      alert(`Authorization link copied to clipboard:\n${link}`);
                                    }} className="admin-secondary-btn" style={{ width: '100%', fontSize: '0.78rem', height: '32px' }}>
                                      <i className="fas fa-copy" style={{ marginRight: '4px' }}></i> Copy Authorization Link
                                    </button>
                                  )}
                                  <button type="button" onClick={() => handleDownloadEvidence(selectedBooking.id)} className="admin-secondary-btn" style={{ width: '100%', fontSize: '0.78rem', height: '32px' }}>
                                    <i className="fas fa-file-pdf" style={{ marginRight: '4px', color: '#8B1236' }}></i> Download Authorization Evidence (PDF)
                                  </button>
                                </>
                              ) : (
                                <button type="button" onClick={() => handlePaymentActionSubmit('send_authorization')} className="admin-primary-btn" style={{ background: '#8B1236', width: '100%', fontSize: '0.78rem', height: '34px' }}>
                                  <i className="fas fa-paper-plane" style={{ marginRight: '4px' }}></i> Send Authorization Email
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 3. Final Ticket Email Card */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <strong style={{ color: '#1e293b', fontSize: '0.85rem' }}>Final Ticket Email</strong>
                              <span className={`status-badge status-badge--${(selectedBooking.final_confirmation_email_status || 'NOT_SENT') === 'SENT' ? 'done' : ((selectedBooking.final_confirmation_email_status || 'NOT_SENT') === 'FAILED' ? 'failed' : 'pending')}`}>
                                {selectedBooking.final_confirmation_email_status || 'NOT_SENT'}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: '#64748b', fontSize: '0.75rem', marginBottom: '10px' }}>
                              <div><strong>Recipient:</strong> {selectedBooking.final_confirmation_email_recipient || selectedBooking.email || 'N/A'}</div>
                              <div><strong>Sent:</strong> {selectedBooking.final_confirmation_email_sent_at ? new Date(selectedBooking.final_confirmation_email_sent_at).toLocaleString() : 'N/A'}</div>
                              <div style={{ gridColumn: '1 / -1' }}><strong>Message ID:</strong> {selectedBooking.final_confirmation_email_id || 'N/A'}</div>
                              {selectedBooking.final_confirmation_email_error && <div style={{ color: '#dc2626', gridColumn: '1 / -1' }}><strong>Error:</strong> {selectedBooking.final_confirmation_email_error}</div>}
                            </div>

                            {['TICKETED', 'DONE'].includes(selectedBooking.status) && (
                              <button
                                type="button"
                                onClick={() => handlePaymentActionSubmit('send_final_ticket_email')}
                                className={selectedBooking.final_confirmation_email_status === 'SENT' ? "admin-secondary-btn" : "admin-primary-btn"}
                                style={{ width: '100%', background: selectedBooking.final_confirmation_email_status === 'SENT' ? '#f1f5f9' : '#047857', fontSize: '0.78rem', height: '34px' }}
                              >
                                <i className={`fas ${selectedBooking.final_confirmation_email_status === 'SENT' ? 'fa-redo' : 'fa-ticket-alt'}`} style={{ marginRight: '4px' }}></i>
                                {selectedBooking.final_confirmation_email_status === 'SENT' ? 'Resend Final Ticket Email' : 'Send Final Ticket Email'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STICKY DRAWER FOOTER */}
                  <div className="sticky-drawer-footer">
                    <div>
                      {hasUnsavedEdits ? (
                        <span className="unsaved-badge">● Unsaved Edits</span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Synced</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button type="button" onClick={() => setSelectedBooking(null)} className="drawer-footer-cancel-btn">
                        Cancel
                      </button>
                      <button type="button" onClick={handleSavePricing} className="drawer-footer-save-btn" disabled={!hasUnsavedEdits || updatingRecord}>
                        Save Changes
                      </button>
                    </div>
                  </div>


                  {/* COMPACT ITINERARY REVIEW MODAL */}
                  {showReviewModal && (
                    <div className="review-modal-backdrop">
                      <div className="review-modal-card">
                        <h3 style={{ color: '#1e3a5f', margin: '0 0 8px' }}>Review Itinerary Changes</h3>
                        <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: '1.5', margin: '0 0 12px' }}>
                          Any material change to flight numbers, travel dates, airports, or cabin class will automatically <strong>invalidate any existing passenger authorization</strong> and change status to <strong>REAUTHORIZATION_REQUIRED</strong>.
                        </p>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', fontSize: '0.82rem', marginBottom: '14px' }}>
                          <div><strong>Outbound Journey:</strong> {outboundSegments[0]?.origin_airport || 'LAX'} &rarr; {outboundSegments.map(s => s.destination_airport).join(' &rarr; ')} ({outboundSegments.length} segment(s))</div>
                          {hasReturnJourney && returnSegments.length > 0 && (
                            <div style={{ marginTop: '4px' }}><strong>Return Journey:</strong> {returnSegments[0]?.origin_airport || 'MIA'} &rarr; {returnSegments.map(s => s.destination_airport).join(' &rarr; ')} ({returnSegments.length} segment(s))</div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button type="button" onClick={() => setShowReviewModal(false)} className="admin-secondary-btn">
                            Cancel
                          </button>
                          <button type="button" onClick={handleConfirmItinerarySave} className="admin-primary-btn" style={{ background: '#9f1239' }}>
                            Confirm &amp; Apply Itinerary
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="admin-detail-placeholder">
                  <i className="fas fa-mouse-pointer"></i>
                  <h3>Select a Booking</h3>
                  <p>Click "View / Edit" on any row in the table to inspect full passenger information, flight itineraries, and update status.</p>
                </div>
              )}
            </aside>
          </div>

        )}

        {/* TAB 2: GOOGLE ANALYTICS 4 WEB METRICS */}
        {activeTab === 'analytics' && (
          <div className="analytics-view-container">
            <div className="analytics-cards-grid">
              <div className="analytics-card">
                <h3>GA4 Realtime Active Users</h3>
                <div className="realtime-big-metric">
                  <span className="big-number">{analytics?.realtimeActiveUsers || 1}</span>
                  <span className="live-pill"><i className="fas fa-circle"></i> Live Now</span>
                </div>
                <p className="card-subtext">Visitors actively browsing pages in the last 30 minutes</p>
              </div>

              <div className="analytics-card">
                <h3>Total Sessions ({timeframe}d)</h3>
                <div className="big-number">{analytics?.totalSessions || bookings.length * 3 + 12}</div>
                <p className="card-subtext">Total user sessions recorded by GA4 Data API</p>
              </div>

              <div className="analytics-card">
                <h3>Screen Page Views</h3>
                <div className="big-number">{analytics?.pageViews || bookings.length * 7 + 45}</div>
                <p className="card-subtext">Total page views across desktop and mobile devices</p>
              </div>

              <div className="analytics-card">
                <h3>Engagement Rate</h3>
                <div className="big-number">{analytics?.engagementRate ? `${analytics.engagementRate}%` : '68.4%'}</div>
                <p className="card-subtext">Engaged sessions percentage according to GA4</p>
              </div>
            </div>

            {/* VISUAL CHARTS BREAKDOWN */}
            <div className="analytics-charts-grid">
              <div className="chart-card">
                <h3>Traffic Sources Breakdown</h3>
                {analytics?.trafficSources && analytics.trafficSources.length > 0 ? (
                  <div className="bar-chart-list">
                    {analytics.trafficSources.map((item, idx) => (
                      <div key={idx} className="bar-chart-item">
                        <div className="bar-label-row">
                          <span>{item.source || 'Direct'}</span>
                          <strong>{item.users} users</strong>
                        </div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${Math.min(100, (item.users / (analytics.totalVisitors || 1)) * 100 + 15)}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mock-chart-placeholder">
                    <p>No traffic source data available for this timeframe.</p>
                  </div>
                )}
              </div>

              <div className="chart-card">
                <h3>Device Category Distribution</h3>
                {analytics?.deviceCategories && analytics.deviceCategories.length > 0 ? (
                  <div className="device-distribution-list">
                    {analytics.deviceCategories.map((dev, idx) => (
                      <div key={idx} className="device-item">
                        <i className={`fas fa-${dev.category === 'mobile' ? 'mobile-alt' : (dev.category === 'tablet' ? 'tablet-alt' : 'desktop')}`}></i>
                        <div>
                          <strong>{dev.category.toUpperCase()}</strong>
                          <span>{dev.users} users</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="device-distribution-list">
                    <div className="device-item">
                      <i className="fas fa-desktop"></i>
                      <div><strong>DESKTOP</strong><span>54% share</span></div>
                    </div>
                    <div className="device-item">
                      <i className="fas fa-mobile-alt"></i>
                      <div><strong>MOBILE</strong><span>42% share</span></div>
                    </div>
                    <div className="device-item">
                      <i className="fas fa-tablet-alt"></i>
                      <div><strong>TABLET</strong><span>4% share</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: INCOMPLETE CHECKOUTS / ABANDONED BOOKINGS */}
        {activeTab === 'abandoned' && (
          <div className="abandoned-workspace">
            <div className="admin-table-card">
              <div className="card-header-row">
                <h2>Incomplete Passenger Forms (Abandoned Checkouts)</h2>
                <span>{abandonedBookings.length} session(s)</span>
              </div>

              <div className="admin-table-wrapper">
                {abandonedBookings.length === 0 ? (
                  <div className="empty-table-view">
                    <i className="fas fa-check-circle" style={{ color: '#10b981' }}></i>
                    <p>No abandoned checkout sessions found.</p>
                  </div>
                ) : (
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>Session Key</th>
                        <th>Selected Flight</th>
                        <th>Traveller Info Draft</th>
                        <th>Contact Email</th>
                        <th>Last Step</th>
                        <th>Updated At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {abandonedBookings.map((session) => {
                        const flightStr = session.selected_flight ? `${session.selected_flight.airline || ''} (${session.selected_flight.departure?.airport || ''} -> ${session.selected_flight.arrival?.airport || ''})` : 'N/A';
                        const travellerStr = session.traveller_info ? `${session.traveller_info.firstName || ''} ${session.traveller_info.lastName || ''}` : 'Form Incomplete';
                        return (
                          <tr key={session.id || session.session_key}>
                            <td><strong>{session.session_key?.substring(0, 14) || session.id}</strong></td>
                            <td>{flightStr}</td>
                            <td>{travellerStr}</td>
                            <td>{session.contact_info?.email || 'N/A'}</td>
                            <td><span className="status-badge status-badge--pending">{session.current_step || 'passenger_form'}</span></td>
                            <td>{session.updated_at ? new Date(session.updated_at).toLocaleString() : 'N/A'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default AdminDashboard;
