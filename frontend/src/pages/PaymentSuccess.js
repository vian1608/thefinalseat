import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { paymentAPI, bookingAPI, inquiryAPI } from '../services/api';
import { SUPPORT_PHONE_DISPLAY } from '../constants/supportContact';
import './PaymentSuccess.css';

function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const type = searchParams.get('type');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionDetails, setSessionDetails] = useState(null);
  const [bookingRef, setBookingRef] = useState('');
  const [isProcessingRecord, setIsProcessingRecord] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid checkout session. Missing session identifier.');
      setLoading(false);
      return;
    }

    const fetchSession = async () => {
      try {
        setLoading(true);
        const data = await paymentAPI.getStripeSessionStatus(sessionId);
        if (data.success) {
          if (data.status === 'paid' || data.status === 'no_payment_required') {
            setSessionDetails(data);
            // Process the transaction record (once)
            processRecord(data);
          } else {
            setError('Payment was not completed successfully. Current status: ' + data.status);
            setLoading(false);
          }
        } else {
          setError('Failed to retrieve secure checkout status.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Session retrieval failed:', err);
        setError('Unable to fetch transaction confirmation. Please contact support.');
        setLoading(false);
      }
    };

    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, type]);

  const processRecord = async (session) => {
    if (isProcessingRecord) return;
    setIsProcessingRecord(true);

    const storageKey = `processed_${type}_${sessionId}`;
    const alreadyProcessed = sessionStorage.getItem(storageKey);

    if (alreadyProcessed) {
      if (type === 'booking') {
        setBookingRef(alreadyProcessed);
      }
      setLoading(false);
      return;
    }

    try {
      const metadata = session.metadata;

      if (type === 'booking') {
        // Reconstruct flight and passenger objects from metadata
        const flightDetails = {
          airline: metadata.flight_airline,
          flightNumber: metadata.flight_number,
          departure: {
            airport: metadata.flight_route.split(' to ')[0],
            date: metadata.flight_dep_time.split(' ')[0],
            time: metadata.flight_dep_time.split(' ')[1]
          },
          arrival: {
            airport: metadata.flight_route.split(' to ')[1],
            date: metadata.flight_arr_time.split(' ')[0],
            time: metadata.flight_arr_time.split(' ')[1]
          },
          class: metadata.flight_class,
          stops: parseInt(metadata.flight_stops || '0')
        };

        const bookingData = {
          firstName: metadata.firstName,
          lastName: metadata.lastName,
          email: metadata.email,
          phone: metadata.phone,
          dateOfBirth: metadata.dateOfBirth,
          gender: metadata.gender,
          nationality: metadata.nationality,
          passportNumber: metadata.passportNumber,
          passportExpiry: metadata.passportExpiry,
          emergencyName: metadata.emergencyName,
          emergencyPhone: metadata.emergencyPhone,
          emergencyRelationship: metadata.emergencyRelationship,
          flight: flightDetails,
          subtotal: `$${(session.amount_total - 25.00 - (session.amount_total * 0.15)).toFixed(2)}`,
          taxes: `$${(session.amount_total * 0.15).toFixed(2)}`,
          total: `$${session.amount_total.toFixed(2)}`,
          paymentMethod: 'Stripe Credit Card',
          paymentStatus: 'paid'
        };

        // Create booking in the backend
        const res = await bookingAPI.create(bookingData);
        if (res.success) {
          const ref = res.data.bookingReference;
          setBookingRef(ref);
          sessionStorage.setItem(storageKey, ref);
        } else {
          throw new Error('Failed to record flight booking on backend');
        }
      } else if (type === 'consulting') {
        // Send consulting payment details to inquiries logs
        await inquiryAPI.submitConsulting(
          {
            name: metadata.name,
            email: metadata.email,
            phone: metadata.phone,
            origin: metadata.origin,
            destination: metadata.destination,
            notes: metadata.notes,
          },
          'consulting-payment'
        );
        sessionStorage.setItem(storageKey, 'completed');
      }
    } catch (err) {
      console.error('Record writing failed:', err);
      // We don't fail the success page rendering since payment was confirmed by Stripe, 
      // but we log it and proceed so the user gets their receipt.
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="success-loading-container">
        <i className="fas fa-circle-notch fa-spin"></i>
        <p>Verifying secure transaction...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="success-error-container">
        <div className="error-icon-circle">
          <i className="fas fa-times-circle"></i>
        </div>
        <h2>Transaction Error</h2>
        <p>{error}</p>
        <div className="action-buttons no-print">
          <Link to="/" className="btn-secondary">Go to Homepage</Link>
          <Link to="/payment" className="btn-primary">Try Payment Again</Link>
        </div>
      </div>
    );
  }

  const { metadata, amount_total } = sessionDetails;

  return (
    <div className="payment-success-page">
      <Helmet>
        <title>Payment Successful | The Final Seat</title>
      </Helmet>

      <div className="success-inner-wrapper">
        
        {/* Print-friendly Invoice Header */}
        <div className="invoice-print-header">
          <h2>The Final Seat LLC</h2>
          <p>Invoice & Receipt of Payment</p>
          <small>5830 E 2nd St, Ste 7000, Casper, WY 82609 · support@thefinalseat.com</small>
        </div>

        {/* Success Card Header */}
        <div className="success-card-header no-print">
          <div className="success-checkmark-wrapper">
            <svg className="checkmark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
              <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
              <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>
          <h2>Payment Successful</h2>
          <p>Thank you. Your transaction has been completed securely.</p>
        </div>

        {/* Receipt / Invoice Details */}
        <div className="receipt-main-card">
          <div className="receipt-section-header">
            <h3>Receipt & Order Summary</h3>
            <span className="receipt-badge">Paid</span>
          </div>

          <div className="receipt-details-grid">
            <div className="details-item">
              <span className="details-label">Amount Charged</span>
              <strong className="amount-highlight">${amount_total.toFixed(2)} USD</strong>
            </div>
            <div className="details-item">
              <span className="details-label">Payment Gateway</span>
              <span>Stripe (PCI Compliant)</span>
            </div>
            <div className="details-item">
              <span className="details-label">Transaction Reference</span>
              <span className="ref-code">{sessionId.substring(12, 32)}...</span>
            </div>
            <div className="details-item">
              <span className="details-label">Billing Name</span>
              <span>{type === 'booking' ? `${metadata.firstName} ${metadata.lastName}` : metadata.name}</span>
            </div>
          </div>

          {/* Conditional view: Flight Booking */}
          {type === 'booking' && (
            <div className="receipt-item-details-box">
              <div className="receipt-sub-header">
                <i className="fas fa-ticket-alt"></i> Flight Booking Pass
              </div>
              
              <div className="boarding-pass-visual">
                <div className="boarding-pass-header">
                  <span>Carrier: <strong>{metadata.flight_airline}</strong></span>
                  <span>Flight: <strong>{metadata.flight_number}</strong></span>
                  {bookingRef && <span className="ref-tag">Ref: <strong>{bookingRef}</strong></span>}
                </div>
                
                <div className="boarding-pass-route">
                  <div className="route-terminal">
                    <h4>{metadata.flight_route.split(' to ')[0]}</h4>
                    <span>Departure</span>
                    <small>{metadata.flight_dep_time}</small>
                  </div>
                  
                  <div className="route-flight-symbol">
                    <i className="fas fa-plane"></i>
                    <span className="flight-dot-line"></span>
                  </div>

                  <div className="route-terminal">
                    <h4>{metadata.flight_route.split(' to ')[1]}</h4>
                    <span>Arrival</span>
                    <small>{metadata.flight_arr_time}</small>
                  </div>
                </div>

                <div className="boarding-pass-passenger">
                  <div>
                    <span>Passenger</span>
                    <strong>{metadata.firstName} {metadata.lastName}</strong>
                  </div>
                  <div>
                    <span>Cabin Class</span>
                    <strong>{metadata.flight_class}</strong>
                  </div>
                  <div>
                    <span>Stops</span>
                    <strong>{metadata.flight_stops === '0' ? 'Nonstop' : `${metadata.flight_stops} stop(s)`}</strong>
                  </div>
                </div>
              </div>

              <div className="next-steps-info">
                <strong>Next Steps:</strong>
                <ul>
                  <li>Your flight reservation is now registered under reference <strong>{bookingRef || 'Pending'}</strong>.</li>
                  <li>A detailed confirmation itinerary and flight e-ticket has been sent to <strong>{metadata.email}</strong>.</li>
                  <li>For support or changes, call us anytime at {SUPPORT_PHONE_DISPLAY}.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Conditional view: Consulting Payment */}
          {type === 'consulting' && (
            <div className="receipt-item-details-box">
              <div className="receipt-sub-header">
                <i className="fas fa-concierge-bell"></i> Consulting Service Plan
              </div>
              
              <div className="consulting-receipt-visual">
                <h4>{metadata.plan_name}</h4>
                <p>Urgent travel logistics advisory, itinerary coordination, and support services.</p>
                <div className="consulting-meta-row">
                  <div>
                    <span>Associated Email</span>
                    <strong>{metadata.email}</strong>
                  </div>
                  <div>
                    <span>Contact Number</span>
                    <strong>{metadata.phone || 'Not provided'}</strong>
                  </div>
                </div>
              </div>

              <div className="next-steps-info">
                <strong>What Happens Next:</strong>
                <ul>
                  <li>An advisor has been assigned to your travel request and is reviewing your details.</li>
                  <li>We will contact you via email or phone at <strong>{metadata.phone || metadata.email}</strong> within 2 hours.</li>
                  <li>If you require immediate dispatch, call our hotline at {SUPPORT_PHONE_DISPLAY}.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="action-buttons-wrapper no-print">
          <button onClick={handlePrint} className="success-btn success-btn-secondary">
            <i className="fas fa-print"></i> Print Receipt / Save PDF
          </button>
          <Link to="/" className="success-btn success-btn-primary">
            Go to Homepage
          </Link>
        </div>

        <div className="success-footer">
          <p>The Final Seat LLC · Casper, WY · support@thefinalseat.com</p>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccess;
