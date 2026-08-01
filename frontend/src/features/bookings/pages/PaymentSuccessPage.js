import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { bookingAPI } from '../../../shared/api/api';
import './PaymentSuccessPage.css';

function PaymentSuccessPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();

  const confirmationCodeParam = params.confirmationCode || searchParams.get('code') || searchParams.get('booking_id');
  const userEmailParam = searchParams.get('email');

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchBookingDetails() {
      if (!confirmationCodeParam) {
        if (isMounted) {
          setErrorMsg('We could not load your reservation details. Please contact support with your booking reference.');
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const res = await bookingAPI.getByReference(confirmationCodeParam);

        if (res && res.success && res.data) {
          if (isMounted) {
            setBooking(res.data);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setErrorMsg('We could not load your reservation details. Please contact support with your booking reference.');
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error loading confirmation booking:', err);
        if (isMounted) {
          setErrorMsg('We could not load your reservation details. Please contact support with your booking reference.');
          setLoading(false);
        }
      }
    }

    fetchBookingDetails();

    return () => {
      isMounted = false;
    };
  }, [confirmationCodeParam]);

  const handlePrint = () => {
    window.print();
  };

  // ── 1. LOADING STATE ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="confirmation-page-wrapper">
        <Helmet>
          <title>Loading Reservation Confirmation | The Final Seat</title>
        </Helmet>
        <div className="confirmation-card confirmation-card--loading">
          <i className="fas fa-circle-notch fa-spin confirmation-spinner"></i>
          <p className="confirmation-loading-text">Loading your reservation details...</p>
        </div>
      </div>
    );
  }

  // ── 2. ERROR / NOT FOUND STATE ─────────────────────────────────────────────
  if (errorMsg || !booking) {
    return (
      <div className="confirmation-page-wrapper">
        <Helmet>
          <title>Reservation Not Found | The Final Seat</title>
        </Helmet>
        <div className="confirmation-card confirmation-card--error">
          <div className="confirmation-error-icon">
            <i className="fas fa-exclamation-circle"></i>
          </div>
          <h2 className="confirmation-error-title">Reservation Lookup Failed</h2>
          <p className="confirmation-error-desc">
            {errorMsg || 'We could not load your reservation details. Please contact support with your booking reference.'}
          </p>
          <div className="confirmation-actions">
            <Link to="/" className="btn-confirm btn-confirm--primary">
              Return to Home
            </Link>
            <a href="mailto:support@thefinalseat.com" className="btn-confirm btn-confirm--secondary">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. DATA EXTRACTION & DERIVED VALUES ──────────────────────────────────
  const isPaid = (booking.payment_status || booking.paymentStatus || '').toLowerCase() === 'paid';
  const passengerName = booking.passenger_name || booking.passengerName || 'Valued Traveler';
  const firstName = passengerName.split(' ')[0] || 'Traveler';
  const code = booking.confirmation_code || booking.confirmationCode || booking.bookingId || confirmationCodeParam;
  const email = booking.email || userEmailParam || 'customer@example.com';
  const phone = booking.phone || 'N/A';
  const bookingDate = booking.created_at ? new Date(booking.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  }) : new Date().toLocaleDateString('en-US');

  const paymentStatusDisplay = isPaid ? 'Paid' : 'Pending';
  const bookingStatusDisplay = (booking.status || 'PENDING').toUpperCase();

  const isEmailSent = !!(booking.authorization_email_sent_at || booking.emailSentAt || booking.email_sent_at);
  const emailNoticeMessage = isEmailSent
    ? `Your confirmation email is on its way to ${email}.`
    : `Your reservation is saved, but we could not send the confirmation email. Please keep your booking ID.`;

  // Itinerary Segments
  const outboundSegments = booking.outbound_segments || booking.itinerary?.outbound || [];
  const returnSegments = booking.return_segments || booking.itinerary?.return || [];
  const allSegments = [...outboundSegments, ...returnSegments];

  // Payment Method Metadata Reference
  const pm = booking.paymentMethod || booking.payment_method || {};
  const cardholderName = pm.cardholder_name || pm.cardholderName || booking.passenger_name || passengerName;
  const cardBrand = pm.card_brand || pm.cardBrand || 'Card';
  const cardLast4 = pm.card_last4 || pm.cardLast4 || '4242';
  const expMonth = pm.card_exp_month || pm.cardExpMonth || '12';
  const expYear = pm.card_exp_year || pm.cardExpYear || '2028';
  const cardDisplay = `${cardBrand} ending in ${cardLast4}`;

  const billingAddr = [
    pm.billing_address_line1 || pm.billingAddress,
    pm.billing_address_line2,
    pm.billing_city,
    pm.billing_state,
    pm.billing_postal_code,
    pm.billing_country
  ].filter(Boolean).join(', ') || 'On File';

  const billingPhone = pm.billing_phone || pm.billingPhone || phone;

  // Price Calculation
  const totalPrice = parseFloat(booking.customer_price || booking.total_amount || 0).toFixed(2);
  const currency = (booking.currency || 'USD').toUpperCase();

  return (
    <div className="confirmation-page-wrapper">
      <Helmet>
        <title>{isPaid ? 'Booking & Payment Confirmed' : 'Reservation Received'} | The Final Seat</title>
      </Helmet>

      <div className="confirmation-container no-print-padding">
        
        {/* ── 1. Header Banner & Success Checkmark ──────────────────────── */}
        <div className="confirmation-header-banner">
          <div className="confirmation-checkmark-circle">
            <span className="confirmation-checkmark-symbol">&#10003;</span>
          </div>

          <h1 className="confirmation-hero-title">
            {isPaid ? 'Booking and Payment Confirmed' : 'Reservation Received'}
          </h1>

          <p className="confirmation-hero-subtitle">
            {isPaid
              ? `Thank you, ${firstName}. Your payment was successful and your reservation has been confirmed.`
              : `Thank you, ${firstName}. Your reservation details have been received. Our team will process the booking and provide the final confirmation.`}
          </p>

          <div className="confirmation-status-row">
            <div className={`status-badge status-badge--${isPaid ? 'paid' : 'pending'}`}>
              <i className={`fas ${isPaid ? 'fa-check-circle' : 'fa-clock'}`}></i>
              Payment Status: {paymentStatusDisplay}
            </div>
            <div className="status-badge status-badge--info">
              <i className="fas fa-ticket-alt"></i>
              Booking Status: {bookingStatusDisplay}
            </div>
          </div>
        </div>

        {/* ── 2. Prominent Reservation Details Card ──────────────────────── */}
        <div className="reservation-details-card">
          
          {/* Section: Booking Information */}
          <div className="res-section">
            <h3 className="res-section-title">
              <i className="fas fa-info-circle"></i> Booking Information
            </h3>
            <div className="res-grid-two">
              <div className="res-field">
                <span className="res-field-label">Confirmation Code / Booking ID</span>
                <strong className="res-field-code">{code}</strong>
              </div>
              <div className="res-field">
                <span className="res-field-label">Booking Date</span>
                <span className="res-field-val">{bookingDate}</span>
              </div>
              <div className="res-field">
                <span className="res-field-label">Primary Passenger</span>
                <span className="res-field-val">{passengerName}</span>
              </div>
              <div className="res-field">
                <span className="res-field-label">Contact Email</span>
                <span className="res-field-val">{email}</span>
              </div>
              <div className="res-field">
                <span className="res-field-label">Contact Phone</span>
                <span className="res-field-val">{phone}</span>
              </div>
            </div>
          </div>

          <hr className="res-divider" />

          {/* Section: Flight Itinerary */}
          <div className="res-section">
            <h3 className="res-section-title">
              <i className="fas fa-plane-departure"></i> Flight Itinerary
            </h3>

            {allSegments.length === 0 ? (
              <div className="incomplete-itinerary-alert">
                <i className="fas fa-exclamation-triangle"></i> Itinerary details are currently incomplete. Our operations team has been notified to attach segment routing.
              </div>
            ) : (
              <div className="itinerary-segments-list">
                {outboundSegments.length > 0 && (
                  <div className="itinerary-leg-group">
                    <h4 className="leg-group-title"><i className="fas fa-plane"></i> Outbound Flight</h4>
                    {outboundSegments.map((seg, idx) => (
                      <div key={idx} className="segment-card">
                        <div className="segment-header">
                          <span className="segment-airline">
                            {seg.airlineLogoUrl && <img src={seg.airlineLogoUrl} alt={seg.airlineName} className="segment-logo" />}
                            <strong>{seg.airlineName || seg.airline || 'Airline'}</strong> ({seg.flightNumber || seg.flight_number || 'N/A'})
                          </span>
                          <span className="segment-cabin">{seg.cabinClass || seg.cabin || 'Economy'}</span>
                        </div>
                        <div className="segment-route">
                          <div className="route-point">
                            <span className="airport-code">{seg.originCode || seg.origin_airport}</span>
                            <span className="city-name">{seg.originCity || seg.origin_city || ''}</span>
                            <span className="time-date">{seg.departureDate || seg.departure_date} {seg.departureTime || seg.departure_time || ''}</span>
                          </div>
                          <div className="route-arrow">
                            <i className="fas fa-arrow-right"></i>
                            <span className="stops-count">{seg.stops === 0 ? 'Non-stop' : `${seg.stops} stop(s)`}</span>
                          </div>
                          <div className="route-point">
                            <span className="airport-code">{seg.destinationCode || seg.destination_airport}</span>
                            <span className="city-name">{seg.destinationCity || seg.destination_city || ''}</span>
                            <span className="time-date">{seg.arrivalDate || seg.arrival_date} {seg.arrivalTime || seg.arrival_time || ''}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {returnSegments.length > 0 && (
                  <div className="itinerary-leg-group" style={{ marginTop: '1.25rem' }}>
                    <h4 className="leg-group-title"><i className="fas fa-undo"></i> Return Flight</h4>
                    {returnSegments.map((seg, idx) => (
                      <div key={idx} className="segment-card">
                        <div className="segment-header">
                          <span className="segment-airline">
                            {seg.airlineLogoUrl && <img src={seg.airlineLogoUrl} alt={seg.airlineName} className="segment-logo" />}
                            <strong>{seg.airlineName || seg.airline || 'Airline'}</strong> ({seg.flightNumber || seg.flight_number || 'N/A'})
                          </span>
                          <span className="segment-cabin">{seg.cabinClass || seg.cabin || 'Economy'}</span>
                        </div>
                        <div className="segment-route">
                          <div className="route-point">
                            <span className="airport-code">{seg.originCode || seg.origin_airport}</span>
                            <span className="city-name">{seg.originCity || seg.origin_city || ''}</span>
                            <span className="time-date">{seg.departureDate || seg.departure_date} {seg.departureTime || seg.departure_time || ''}</span>
                          </div>
                          <div className="route-arrow">
                            <i className="fas fa-arrow-right"></i>
                            <span className="stops-count">{seg.stops === 0 ? 'Non-stop' : `${seg.stops} stop(s)`}</span>
                          </div>
                          <div className="route-point">
                            <span className="airport-code">{seg.destinationCode || seg.destination_airport}</span>
                            <span className="city-name">{seg.destinationCity || seg.destination_city || ''}</span>
                            <span className="time-date">{seg.arrivalDate || seg.arrival_date} {seg.arrivalTime || seg.arrival_time || ''}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <hr className="res-divider" />

          {/* Section: Price Details */}
          <div className="res-section">
            <h3 className="res-section-title">
              <i className="fas fa-dollar-sign"></i> Price Details
            </h3>
            <div className="price-summary-box">
              <div className="price-row price-row--total">
                <span>Total Reservation Amount:</span>
                <strong>${totalPrice} {currency}</strong>
              </div>
            </div>
          </div>

          <hr className="res-divider" />

          {/* Section: Card and Billing Reference (Masked Metadata Only) */}
          <div className="res-section">
            <h3 className="res-section-title">
              <i className="fas fa-credit-card"></i> Card & Billing Reference
            </h3>
            <div className="res-grid-two">
              <div className="res-field">
                <span className="res-field-label">Cardholder Name</span>
                <span className="res-field-val">{cardholderName}</span>
              </div>
              <div className="res-field">
                <span className="res-field-label">Payment Method</span>
                <span className="res-field-val">{cardDisplay}</span>
              </div>
              <div className="res-field">
                <span className="res-field-label">Expiration</span>
                <span className="res-field-val">{expMonth}/{expYear}</span>
              </div>
              <div className="res-field">
                <span className="res-field-label">Billing Phone</span>
                <span className="res-field-val">{billingPhone}</span>
              </div>
              <div className="res-field" style={{ gridColumn: 'span 2' }}>
                <span className="res-field-label">Billing Address</span>
                <span className="res-field-val">{billingAddr}</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── 3. Email Delivery Status Notice ─────────────────────────────── */}
        <div className={`email-notice-box email-notice-box--${isEmailSent ? 'success' : 'warn'}`}>
          <i className={`fas ${isEmailSent ? 'fa-envelope-open-text' : 'fa-info-circle'}`}></i>
          <span>{emailNoticeMessage}</span>
        </div>

        {/* ── 4. Action Buttons ────────────────────────────────────────────── */}
        <div className="confirmation-actions-bar no-print">
          <Link to="/my-bookings" className="btn-confirm btn-confirm--primary">
            <i className="fas fa-suitcase"></i> View My Booking
          </Link>
          <button type="button" onClick={handlePrint} className="btn-confirm btn-confirm--secondary">
            <i className="fas fa-print"></i> Print Reservation
          </button>
          <Link to="/" className="btn-confirm btn-confirm--outline">
            <i className="fas fa-home"></i> Return to Home
          </Link>
          <a href="mailto:support@thefinalseat.com" className="btn-confirm btn-confirm--outline">
            <i className="fas fa-headset"></i> Contact Support
          </a>
        </div>

      </div>
    </div>
  );
}

export default PaymentSuccessPage;
