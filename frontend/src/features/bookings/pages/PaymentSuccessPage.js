import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { bookingAPI } from '../../../shared/api/api';
import { SUPPORT_PHONE_DISPLAY } from '../../../shared/constants/supportContact';
import './PaymentSuccessPage.css';

function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const bookingIdParam = searchParams.get('booking_id');
  const codeParam = searchParams.get('code');

  const [pollingStatus, setPollingStatus] = useState('POLLING'); // 'POLLING' | 'SUCCESS' | 'PENDING_TIMEOUT' | 'FAILED'
  const [pollCount, setPollCount] = useState(0);
  const [bookingData, setBookingData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const maxAttempts = 30; // 30 attempts x 2s = 60s max polling
  const intervalRef = useRef(null);

  const targetIdentifier = bookingIdParam || codeParam || sessionId;

  const fetchAndVerifyStatus = async () => {
    if (!targetIdentifier) {
      setPollingStatus('FAILED');
      setErrorMessage('No booking reference or session identifier found in URL.');
      return true;
    }

    try {
      // 1. Check status from payment status endpoint
      const statusRes = await bookingAPI.getPaymentStatus(targetIdentifier);

      if (statusRes && statusRes.success) {
        const pStatus = (statusRes.paymentStatus || '').toLowerCase();
        const bStatus = (statusRes.bookingStatus || statusRes.status || '').toUpperCase();

        if (pStatus === 'paid' && (bStatus === 'CONFIRMED' || bStatus === 'DONE')) {
          // Fetch complete enriched canonical booking from DB
          const fullRes = await bookingAPI.getByReference(statusRes.confirmationCode || targetIdentifier);
          if (fullRes && fullRes.success && fullRes.data) {
            setBookingData(fullRes.data);
          } else {
            setBookingData(statusRes);
          }
          setPollingStatus('SUCCESS');
          return true;
        }

        if (pStatus === 'failed' || pStatus === 'cancelled' || bStatus === 'FAILED' || bStatus === 'CANCELLED') {
          setPollingStatus('FAILED');
          setErrorMessage('Payment processing was declined or failed. Your reservation could not be completed.');
          return true;
        }
      }
    } catch (err) {
      console.warn('[Polling] Verification check attempt error:', err.message);
    }

    return false;
  };

  const startPolling = () => {
    setPollingStatus('POLLING');
    setPollCount(0);
    setErrorMessage('');

    let attempts = 0;

    const poll = async () => {
      attempts++;
      setPollCount(attempts);

      const isComplete = await fetchAndVerifyStatus();
      if (isComplete) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      if (attempts >= maxAttempts) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        // Final attempt to fetch booking data for pending screen
        try {
          const finalRes = await bookingAPI.getByReference(targetIdentifier);
          if (finalRes && finalRes.success && finalRes.data) {
            setBookingData(finalRes.data);
          }
        } catch (e) { /* non-blocking */ }
        setPollingStatus('PENDING_TIMEOUT');
      }
    };

    // Immediate initial check
    poll();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(poll, 2000);
  };

  useEffect(() => {
    startPolling();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetIdentifier]);

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const handlePrint = () => {
    window.print();
  };

  // ── 1. POLLING / CONFIRMING PAYMENT SCREEN ──────────────────────────────
  if (pollingStatus === 'POLLING') {
    return (
      <div className="payment-success-page">
        <Helmet>
          <title>Confirming Your Payment | The Final Seat</title>
        </Helmet>
        <div className="success-inner-wrapper">
          <div className="polling-card">
            <div className="polling-spinner-container">
              <div className="pulse-ring"></div>
              <i className="fas fa-lock polling-lock-icon"></i>
            </div>
            <h2>Confirming Your Payment</h2>
            <p className="polling-subtitle">
              Verifying secure payment receipt with booking servers. Please do not close or refresh this window.
            </p>
            <div className="polling-progress-bar">
              <div
                className="polling-progress-fill"
                style={{ width: `${Math.min(100, (pollCount / maxAttempts) * 100)}%` }}
              ></div>
            </div>
            <p className="polling-step-text">
              Verification step {pollCount} of {maxAttempts} &middot; 256-Bit SSL Encrypted Handshake
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. FAILED PAYMENT SCREEN ─────────────────────────────────────────────
  if (pollingStatus === 'FAILED') {
    return (
      <div className="payment-success-page">
        <Helmet>
          <title>Payment Failed | The Final Seat</title>
        </Helmet>
        <div className="success-inner-wrapper">
          <div className="failed-card">
            <div className="failed-icon-circle">
              <i className="fas fa-times"></i>
            </div>
            <h2>Payment Processing Failed</h2>
            <p className="failed-message">
              {errorMessage || 'Your payment attempt could not be processed by the gateway. Your reservation has not been charged or confirmed.'}
            </p>
            <div className="failed-actions">
              <Link to="/booking" className="btn-retry-payment">
                <i className="fas fa-redo"></i> Retry Payment
              </Link>
              <Link to="/contact" className="btn-support-contact">
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. TIMEOUT / PENDING SCREEN ──────────────────────────────────────────
  if (pollingStatus === 'PENDING_TIMEOUT') {
    const pendingCode = bookingData?.confirmation_code || targetIdentifier || 'TFS-PENDING';
    const pendingEmail = bookingData?.email || 'your email address';

    return (
      <div className="payment-success-page">
        <Helmet>
          <title>Payment Pending Verification | The Final Seat</title>
        </Helmet>
        <div className="success-inner-wrapper">
          <div className="pending-card">
            <div className="pending-icon-circle">
              <i className="fas fa-clock"></i>
            </div>
            <h2>Payment Received — Confirmation Processing</h2>
            <p className="pending-subtitle">
              Your payment has been received, but automatic ticket confirmation is taking longer than expected to reconcile on our servers.
            </p>

            <div className="temp-code-card">
              <span className="temp-code-label">Temporary Confirmation Number</span>
              <div className="temp-code-row">
                <strong className="temp-code-value">{pendingCode}</strong>
                <button
                  type="button"
                  className="btn-copy-code"
                  onClick={() => handleCopyCode(pendingCode)}
                >
                  <i className={`fas fa-${copied ? 'check' : 'copy'}`}></i>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <p className="pending-info">
              A confirmation email will be sent to <strong>{pendingEmail}</strong> once processing completes. You can check your booking status anytime using your confirmation number.
            </p>

            <div className="pending-actions">
              <button type="button" className="btn-refresh-status" onClick={startPolling}>
                <i className="fas fa-sync-alt"></i> Refresh &amp; Check Status
              </button>
              <Link to="/my-bookings" className="btn-view-bookings">
                <i className="fas fa-calendar-check"></i> View My Bookings
              </Link>
            </div>

            <div className="disclaimer-alert-box">
              <i className="fas fa-exclamation-triangle"></i>
              <span>
                This is a temporary reservation status update and not the airline&apos;s final ticket number or PNR.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 4. SUCCESSFUL PAYMENT SCREEN (paymentStatus === 'paid' & bookingStatus === 'CONFIRMED') ──
  const travellers = bookingData?.travellers || bookingData?.traveller_details || [];
  const firstPassenger = travellers[0] || {};
  const firstName = firstPassenger.first_name || firstPassenger.firstName || (bookingData?.passenger_name || 'Customer').split(' ')[0];

  const confirmationCode = bookingData?.confirmation_code || targetIdentifier || 'TFS-CONFIRMED';
  const customerEmail = bookingData?.email || firstPassenger.email || 'customer@email.com';

  const customerPrice = parseFloat(bookingData?.customer_price || bookingData?.amount || bookingData?.total_amount || 0);
  const supplierPrice = parseFloat(bookingData?.supplier_price || bookingData?.original_api_price || customerPrice);
  const discountAmount = parseFloat(bookingData?.discount_amount || Math.max(0, supplierPrice - customerPrice));

  const outboundFlight = bookingData?.flights?.find(f => f.direction === 'outbound') || bookingData?.flights?.[0] || bookingData?.flight_details || {};
  const returnFlight = bookingData?.flights?.find(f => f.direction === 'return') || bookingData?.returnFlight || null;
  const isRoundTrip = !!returnFlight;

  const carrierName = bookingData?.carrier || bookingData?.airline || outboundFlight.airline || outboundFlight.carrier || 'Commercial Airline';
  const flightNumber = outboundFlight.flight_number || outboundFlight.flightNumber || 'Scheduled';
  const originCode = bookingData?.origin_code || outboundFlight.departure_airport || outboundFlight.origin || 'DEP';
  const destCode = bookingData?.destination_code || outboundFlight.arrival_airport || outboundFlight.destination || 'ARR';
  const departureDate = bookingData?.departure_date || outboundFlight.departure_time || outboundFlight.departure_date || 'Scheduled';
  const cabinClass = outboundFlight.cabin_class || outboundFlight.class || 'Economy';

  const paymentProvider = (bookingData?.payment_provider || 'whop').toUpperCase() === 'PAYPAL' ? 'PayPal' : 'Credit Card (Whop Encrypted)';
  const passengerCount = travellers.length || 1;

  return (
    <div className="payment-success-page">
      <Helmet>
        <title>Payment Successful — {confirmationCode} | The Final Seat</title>
      </Helmet>

      <div className="success-inner-wrapper">

        {/* Print-only Invoice Header */}
        <div className="invoice-print-header">
          <h2>The Final Seat LLC</h2>
          <p>Temporary Booking Confirmation Receipt</p>
          <small>5830 E 2nd St, Ste 7000, Casper, WY 82609 &middot; support@thefinalseat.com</small>
        </div>

        {/* Success Banner Card */}
        <div className="success-banner-card no-print">
          <div className="success-checkmark-animated">
            <svg className="checkmark-svg" viewBox="0 0 52 52">
              <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          </div>

          <h1 className="success-greeting">Thank you, {firstName}!</h1>
          <p className="success-tagline">Your payment has been successfully received.</p>

          <div className="status-badge-row">
            <span className="badge-confirmed">
              <i className="fas fa-check-circle"></i> Payment Status: Paid &amp; Confirmed
            </span>
          </div>
        </div>

        {/* Temporary Confirmation Number Box */}
        <div className="temp-ref-box">
          <span className="temp-ref-label">Temporary Confirmation Number</span>
          <div className="temp-ref-value-row">
            <strong className="temp-ref-code">{confirmationCode}</strong>
            <button
              type="button"
              className="btn-copy-code"
              onClick={() => handleCopyCode(confirmationCode)}
            >
              <i className={`fas fa-${copied ? 'check' : 'copy'}`}></i>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Email Notification & Status Info Message */}
        <div className="email-sent-notice">
          <i className="fas fa-envelope-open-text"></i>
          <span>
            A confirmation email has been sent to <strong>{customerEmail}</strong>. Please keep your temporary confirmation number for tracking your reservation. Your final electronic ticket and airline confirmation details will be emailed after fulfilment is completed.
          </span>
        </div>

        {/* Critical Disclaimer Box */}
        <div className="disclaimer-alert-box">
          <i className="fas fa-info-circle" style={{ fontSize: '1.25rem' }}></i>
          <div>
            <strong>Notice of Temporary Reservation:</strong>
            <p>
              This is a temporary reservation confirmation and not the airline&apos;s final ticket number or PNR. Your electronic ticket details will be emailed after fulfilment is completed.
            </p>
          </div>
        </div>

        {/* Main Details & Breakdown Card */}
        <div className="receipt-summary-card">
          <h3 className="card-section-title">
            <i className="fas fa-receipt"></i> Payment &amp; Reservation Breakdown
          </h3>

          <div className="receipt-grid">
            <div className="receipt-grid-item">
              <span className="r-label">Amount Paid (Customer Total)</span>
              <strong className="r-value r-value-price">${customerPrice.toFixed(2)} USD</strong>
            </div>

            {discountAmount > 0 && (
              <div className="receipt-grid-item">
                <span className="r-label">Final Seat Subsidy (10% OFF)</span>
                <span className="r-value r-value-discount">-${discountAmount.toFixed(2)} USD</span>
              </div>
            )}

            <div className="receipt-grid-item">
              <span className="r-label">Original Supplier Fare</span>
              <span className="r-value r-value-original">${supplierPrice.toFixed(2)} USD</span>
            </div>

            <div className="receipt-grid-item">
              <span className="r-label">Payment Gateway</span>
              <span className="r-value">{paymentProvider}</span>
            </div>

            <div className="receipt-grid-item">
              <span className="r-label">Route</span>
              <span className="r-value">{originCode} &rarr; {destCode}</span>
            </div>

            <div className="receipt-grid-item">
              <span className="r-label">Airline / Operator</span>
              <span className="r-value">{carrierName}</span>
            </div>

            <div className="receipt-grid-item">
              <span className="r-label">Flight Number</span>
              <span className="r-value">{flightNumber}</span>
            </div>

            <div className="receipt-grid-item">
              <span className="r-label">Travel Date / Time</span>
              <span className="r-value">{departureDate}</span>
            </div>

            <div className="receipt-grid-item">
              <span className="r-label">Cabin Class</span>
              <span className="r-value">{cabinClass}</span>
            </div>

            <div className="receipt-grid-item">
              <span className="r-label">Travelers</span>
              <span className="r-value">{passengerCount} Traveler{passengerCount > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Passenger Manifest Table */}
          {travellers.length > 0 && (
            <div className="manifest-section">
              <h4 className="manifest-title">Passenger Manifest</h4>
              <div className="table-responsive">
                <table className="manifest-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Passenger Name</th>
                      <th>DOB</th>
                      <th>Gender</th>
                      <th>Passport Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {travellers.map((p, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td><strong>{p.first_name || p.firstName} {p.middle_name || p.middleName || ''} {p.last_name || p.lastName}</strong></td>
                        <td>{p.date_of_birth || p.dateOfBirth || 'N/A'}</td>
                        <td style={{ textTransform: 'capitalize' }}>{p.gender || 'N/A'}</td>
                        <td>{p.passport_number || p.passportNumber || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="action-buttons-row no-print">
          <Link to="/my-bookings" className="btn-action btn-action-accent">
            <i className="fas fa-calendar-check"></i> View My Booking
          </Link>
          <Link to="/" className="btn-action btn-action-primary">
            <i className="fas fa-home"></i> Return to Home
          </Link>
          <button type="button" onClick={handlePrint} className="btn-action btn-action-secondary">
            <i className="fas fa-print"></i> Print Confirmation
          </button>
        </div>

        <footer className="success-footer-note">
          <p>
            The Final Seat LLC &middot; Casper, WY &middot;{' '}
            <a href="mailto:support@thefinalseat.com">support@thefinalseat.com</a> &middot; Phone: {SUPPORT_PHONE_DISPLAY}
          </p>
        </footer>

      </div>
    </div>
  );
}

export default PaymentSuccess;
