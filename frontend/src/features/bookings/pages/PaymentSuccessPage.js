import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { bookingAPI } from '../../../shared/api/api';
import './PaymentSuccessPage.css';

function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const bookingIdParam = searchParams.get('booking_id');
  const codeParam = searchParams.get('code');

  const [paymentState, setPaymentState] = useState('POLLING'); // 'POLLING' | 'PAID' | 'FAILED'
  const [bookingData, setBookingData] = useState(null);
  const intervalRef = useRef(null);

  const targetIdentifier = bookingIdParam || codeParam;

  // Break out of Whop iframe if embedded checkout redirected inside the iframe
  useEffect(() => {
    if (window.top !== window.self) {
      try {
        window.top.location.href = window.location.href;
      } catch (e) {
        /* cross-origin fallback */
      }
    }
  }, []);

  useEffect(() => {
    if (!targetIdentifier) {
      setPaymentState('FAILED');
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const res = await bookingAPI.getPaymentStatus(targetIdentifier);
        if (res && res.success) {
          const status = (res.paymentStatus || '').toLowerCase();

          if (status === 'paid') {
            // Also fetch enriched booking data from DB if available
            try {
              const fullRes = await bookingAPI.getByReference(res.confirmationCode || targetIdentifier);
              if (fullRes && fullRes.success && fullRes.data) {
                setBookingData({
                  ...res,
                  ...fullRes.data,
                  passengerName: fullRes.data.passenger_name || res.passengerName,
                  confirmationCode: fullRes.data.confirmation_code || res.confirmationCode,
                  email: fullRes.data.email || res.email,
                  emailSentAt: fullRes.data.confirmation_email_sent_at || res.emailSentAt
                });
              } else {
                setBookingData(res);
              }
            } catch (e) {
              setBookingData(res);
            }
            setPaymentState('PAID');
            if (intervalRef.current) clearInterval(intervalRef.current);
            return true;
          }

          if (status === 'failed' || status === 'cancelled') {
            setPaymentState('FAILED');
            if (intervalRef.current) clearInterval(intervalRef.current);
            return true;
          }
        }
      } catch (err) {
        console.warn('Status poll error:', err.message);
      }
      return false;
    };

    // Initial check immediately
    checkPaymentStatus();

    // Poll every 2 seconds
    intervalRef.current = setInterval(checkPaymentStatus, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetIdentifier]);

  // ── 1. LOADING / POLLING / PENDING STATE ──────────────────────────────────
  if (paymentState === 'POLLING') {
    return (
      <div className="minimal-page-wrapper">
        <Helmet>
          <title>Confirming Your Payment | The Final Seat</title>
        </Helmet>
        <div className="minimal-card minimal-card--polling">
          <i className="fas fa-circle-notch fa-spin minimal-spinner"></i>
          <p className="minimal-polling-text">Confirming your payment…</p>
        </div>
      </div>
    );
  }

  // ── 2. FAILED STATE ───────────────────────────────────────────────────────
  if (paymentState === 'FAILED') {
    return (
      <div className="minimal-page-wrapper">
        <Helmet>
          <title>Payment Failed | The Final Seat</title>
        </Helmet>
        <div className="minimal-card minimal-card--failed">
          <div className="minimal-failed-icon">
            <i className="fas fa-exclamation-circle"></i>
          </div>
          <h2 className="minimal-failed-title">Payment Processing Failed</h2>
          <p className="minimal-failed-desc">
            Your payment could not be processed. Please retry your payment to complete your reservation.
          </p>
          <div className="minimal-actions">
            <Link to="/booking" className="btn-minimal btn-minimal--retry">
              Retry Payment
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. MINIMAL SUCCESS STATE (paymentStatus === 'paid') ───────────────────
  const rawName = bookingData?.passengerName || bookingData?.passenger_name || 'Customer';
  const firstName = rawName.split(' ')[0] || 'Customer';
  const confirmationCode = bookingData?.confirmationCode || bookingData?.confirmation_code || targetIdentifier || 'TFS-2026-ABC123';
  const customerEmail = bookingData?.email || 'customer@email.com';
  const isEmailSent = !!(bookingData?.emailSentAt || bookingData?.confirmation_email_sent_at);

  return (
    <div className="minimal-page-wrapper">
      <Helmet>
        <title>Payment Successful | The Final Seat</title>
      </Helmet>

      <div className="minimal-card minimal-card--success">
        {/* Animated Minimal Green Checkmark */}
        <div className="minimal-checkmark-circle">
          <span className="minimal-checkmark-symbol">&#10003;</span>
        </div>

        <h1 className="minimal-title">Thank you, {firstName}!</h1>

        <p className="minimal-subtitle">Your payment was successful.</p>

        <div className="minimal-ref-box">
          <span className="minimal-ref-label">Temporary Confirmation Number</span>
          <strong className="minimal-ref-code">{confirmationCode}</strong>
        </div>

        <p className="minimal-email-note">
          Your reservation confirmation {isEmailSent ? 'has been sent to' : 'will be emailed to'}{' '}
          <strong className="email-highlight">{customerEmail}</strong>.
        </p>

        <p className="minimal-disclaimer">
          Your final airline confirmation and electronic ticket details will be shared separately after the reservation is processed.
        </p>

        <div className="minimal-actions">
          <Link to="/my-bookings" className="btn-minimal btn-minimal--primary">
            View My Booking
          </Link>
          <Link to="/" className="btn-minimal btn-minimal--secondary">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;
