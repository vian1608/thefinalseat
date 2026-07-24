import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { paymentAPI, bookingAPI } from '../../../shared/api/api';
import { SUPPORT_PHONE_DISPLAY } from '../../../shared/constants/supportContact';
import './PaymentSuccessPage.css';

function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const type = searchParams.get('type') || 'booking';
  const bookingIdParam = searchParams.get('booking_id');
  const codeParam = searchParams.get('code');

  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingMessage, setPollingMessage] = useState('Payment received, confirming your booking…');
  const [error, setError] = useState('');
  const [sessionDetails, setSessionDetails] = useState(null);
  const [bookingRef, setBookingRef] = useState(codeParam || '');
  const [bookingDataFromDb, setBookingDataFromDb] = useState(null);

  // Status Polling for Whop / PayPal booking confirmations
  useEffect(() => {
    const identifier = bookingIdParam || codeParam || bookingRef;

    if (identifier && type === 'booking') {
      let isSubscribed = true;
      let pollCount = 0;
      const maxPolls = 30; // 30 x 3s = 90 seconds max

      setIsPolling(true);
      setLoading(true);

      const checkStatus = async () => {
        try {
          pollCount++;
          const res = await bookingAPI.getPaymentStatus(identifier);

          if (!isSubscribed) return;

          if (res && res.success) {
            if (res.paymentStatus === 'paid') {
              setIsPolling(false);
              setBookingRef(res.confirmationCode || identifier);
              
              // Fetch complete booking object from DB
              const fullBooking = await bookingAPI.getByReference(res.confirmationCode || identifier);
              if (fullBooking && fullBooking.success) {
                setBookingDataFromDb(fullBooking.data);
              } else {
                setBookingDataFromDb(res);
              }
              setLoading(false);
              return true;
            } else {
              setPollingMessage('Payment received, confirming your booking…');
            }
          }
        } catch (err) {
          console.warn('Polling check error:', err.message);
        }

        if (pollCount >= maxPolls) {
          setIsPolling(false);
          // Allow fallback display with pending status after 90 seconds
          setLoading(false);
          return true;
        }

        return false;
      };

      // Immediate check
      checkStatus().then((done) => {
        if (!done) {
          const interval = setInterval(async () => {
            const finished = await checkStatus();
            if (finished) {
              clearInterval(interval);
            }
          }, 3000);

          return () => {
            isSubscribed = false;
            clearInterval(interval);
          };
        }
      });

      return () => {
        isSubscribed = false;
      };
    } else if (sessionId && type === 'stripe_legacy') {
      // Legacy Stripe session handler
      const fetchSession = async () => {
        try {
          setLoading(true);
          const data = await paymentAPI.getStripeSessionStatus(sessionId);
          if (data.success && (data.status === 'paid' || data.status === 'no_payment_required')) {
            setSessionDetails(data);
          } else {
            setError('Payment was not completed successfully. Status: ' + data?.status);
          }
        } catch (err) {
          setError('Unable to fetch transaction confirmation.');
        } finally {
          setLoading(false);
        }
      };
      fetchSession();
    } else {
      setLoading(false);
    }
  }, [sessionId, bookingIdParam, codeParam, bookingRef, type]);

  // Fetch full details from database once confirmation code is available
  useEffect(() => {
    if (bookingRef && !bookingDataFromDb) {
      const fetchBookingFromDb = async () => {
        try {
          const res = await bookingAPI.getByReference(bookingRef);
          if (res.success) {
            setBookingDataFromDb(res.data);
          }
        } catch (err) {
          console.error('Failed to fetch detailed booking from database:', err);
        }
      };
      fetchBookingFromDb();
    }
  }, [bookingRef, bookingDataFromDb]);

  const handlePrint = () => {
    window.print();
  };

  if (loading && isPolling) {
    return (
      <div className="success-loading-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <i className="fas fa-circle-notch fa-spin fa-3x" style={{ color: '#1e3a5f', marginBottom: '1.25rem' }}></i>
        <h3 style={{ color: '#1e3a5f', margin: '0 0 0.5rem' }}>{pollingMessage}</h3>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Verifying secure payment receipt with booking servers. Please do not close this window.</p>
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
          <Link to="/booking" className="btn-primary">Try Payment Again</Link>
        </div>
      </div>
    );
  }

  const displayedPrice = bookingDataFromDb
    ? parseFloat(bookingDataFromDb.customer_price || bookingDataFromDb.amount || bookingDataFromDb.total_amount || 0)
    : parseFloat(sessionDetails?.amount_total || 0);

  const supplierPrice = bookingDataFromDb
    ? parseFloat(bookingDataFromDb.supplier_price || bookingDataFromDb.original_api_price || displayedPrice)
    : displayedPrice;

  const discountAmount = bookingDataFromDb
    ? parseFloat(bookingDataFromDb.discount_amount || Math.max(0, supplierPrice - displayedPrice))
    : 0;

  return (
    <div className="payment-success-page">
      <Helmet>
        <title>Payment Successful | The Final Seat</title>
      </Helmet>

      <div className="success-inner-wrapper">
        
        {/* Print-friendly Invoice Header */}
        <div className="invoice-print-header">
          <h2>The Final Seat LLC</h2>
          <p>Booking Confirmation Receipt</p>
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
          <h2>Thank you!</h2>
          <p style={{ fontSize: '1.15rem', color: '#1e293b', fontWeight: 'bold', margin: '0.5rem 0' }}>Your reservation request has been confirmed successfully.</p>
          <p style={{ maxWidth: '600px', margin: '0 auto', color: '#475569' }}>Our travel specialists have verified your itinerary and issued your ticket. A confirmation email has been sent.</p>
          
          <div className="booking-status-badge-container" style={{ margin: '1.5rem 0' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>Booking Status</span>
            <strong style={{ fontSize: '1.15rem', color: '#047857', display: 'inline-block', padding: '6px 20px', backgroundColor: '#ecfdf5', borderRadius: '30px', border: '1px solid #a7f3d0', marginTop: '6px', fontWeight: '700' }}>
              {bookingDataFromDb?.payment_status === 'paid' ? 'Paid & Confirmed' : (bookingDataFromDb?.status === 'DONE' ? 'Confirmed & Done' : 'Pending Confirmation')}
            </strong>
          </div>
        </div>

        {/* Receipt / Invoice Details */}
        <div className="receipt-main-card">
          <div className="receipt-section-header">
            <h3>Receipt & Order Summary</h3>
            <span className="receipt-badge">Paid</span>
          </div>

          <div className="receipt-details-grid">
            <div className="details-item">
              <span className="details-label">Amount Paid (Customer Total)</span>
              <strong className="amount-highlight">${displayedPrice.toFixed(2)} USD</strong>
            </div>
            {discountAmount > 0 && (
              <div className="details-item">
                <span className="details-label">Final Seat Subsidy (10% OFF)</span>
                <span style={{ color: '#047857', fontWeight: 'bold' }}>-${discountAmount.toFixed(2)} USD</span>
              </div>
            )}
            <div className="details-item">
              <span className="details-label">Payment Gateway</span>
              <span>{bookingDataFromDb?.payment_provider ? bookingDataFromDb.payment_provider.toUpperCase() : 'Whop (Encrypted)'}</span>
            </div>
            <div className="details-item">
              <span className="details-label">Booking Reference Code</span>
              <span className="ref-code" style={{ fontWeight: 'bold', color: '#1e3a5f' }}>
                {bookingDataFromDb?.confirmation_code || bookingRef || 'CONFIRMED'}
              </span>
            </div>
            <div className="details-item">
              <span className="details-label">Billing Customer</span>
              <span>{bookingDataFromDb?.passenger_name || 'Valued Customer'}</span>
            </div>
          </div>

          {/* Conditional view: Flight Booking Ticket */}
          {type === 'booking' && (() => {
            const isAmtrak = (bookingDataFromDb?.flight_details?.airline || '').toLowerCase().includes('amtrak');
            const passengers = bookingDataFromDb?.traveller_details || [];
            
            return (
              <div className="receipt-item-details-box">
                <div className="ticket-label-overlay">
                  OFFICIAL ELECTRONIC TICKET RECEIPT
                </div>
                
                <div className="boarding-pass-visual">
                  <div className="boarding-pass-header" style={{ borderBottom: isAmtrak ? '2px dashed #8b1538' : '2px dashed #1e3a5f' }}>
                    <span>{isAmtrak ? 'Operator' : 'Carrier'}: <strong>{bookingDataFromDb?.flight_details?.airline || 'Commercial Airline'}</strong></span>
                    <span>{isAmtrak ? 'Train' : 'Flight'}: <strong>{bookingDataFromDb?.flight_details?.flightNumber || 'Scheduled Route'}</strong></span>
                    {(bookingRef || bookingDataFromDb?.confirmation_code) && (
                      <span className="ref-tag">Confirmation Code: <strong>{bookingDataFromDb?.confirmation_code || bookingRef}</strong></span>
                    )}
                  </div>
                  
                  <div className="boarding-pass-route">
                    <div className="route-terminal">
                      <h4>{bookingDataFromDb?.flight_details?.departure?.airport || 'Origin'}</h4>
                      <span>Departure</span>
                      <small>{bookingDataFromDb?.flight_details?.departure?.date} {bookingDataFromDb?.flight_details?.departure?.time || ''}</small>
                    </div>
                    
                    <div className="route-flight-symbol">
                      <i className={`fas ${isAmtrak ? 'fa-subway' : 'fa-plane'}`} style={{ color: isAmtrak ? '#8b1538' : '#1e3a5f' }}></i>
                      <span className="flight-dot-line"></span>
                    </div>
  
                    <div className="route-terminal">
                      <h4>{bookingDataFromDb?.flight_details?.arrival?.airport || 'Destination'}</h4>
                      <span>Arrival</span>
                      <small>{bookingDataFromDb?.flight_details?.arrival?.date} {bookingDataFromDb?.flight_details?.arrival?.time || ''}</small>
                    </div>
                  </div>

                  <div className="boarding-pass-passenger">
                    <div>
                      <span>Primary Contact</span>
                      <strong>{bookingDataFromDb?.passenger_name}</strong>
                    </div>
                    <div>
                      <span>Contact Info</span>
                      <strong style={{ fontSize: '0.85rem' }}>
                        {bookingDataFromDb?.email}<br/>
                        {bookingDataFromDb?.phone}
                      </strong>
                    </div>
                    <div>
                      <span>{isAmtrak ? 'Seat Class' : 'Cabin Class'}</span>
                      <strong>{bookingDataFromDb?.flight_details?.class || 'Economy'}</strong>
                    </div>
                    <div>
                      <span>Travelers</span>
                      <strong>{passengers.length || 1}</strong>
                    </div>
                  </div>

                  {passengers.length > 0 && (
                    <div className="boarding-pass-manifest">
                      <div className="manifest-header">Passenger Manifest</div>
                      <table className="manifest-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>DOB</th>
                            <th>Gender</th>
                            <th>Passport</th>
                            <th>Nationality</th>
                          </tr>
                        </thead>
                        <tbody>
                          {passengers.map((p, idx) => (
                            <tr key={idx}>
                              <td data-label="No.">{idx + 1}</td>
                              <td data-label="Name"><strong>{p.firstName} {p.middleName || ''} {p.lastName}</strong></td>
                              <td data-label="DOB">{p.dateOfBirth}</td>
                              <td data-label="Gender" style={{ textTransform: 'capitalize' }}>{p.gender}</td>
                              <td data-label="Passport">{p.passportNumber || 'N/A'}</td>
                              <td data-label="Nationality">{p.nationality || 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="next-steps-info">
                  <strong>Notice of E-Ticket Confirmation:</strong>
                  <ul>
                    <li>Your {isAmtrak ? 'train transit reservation' : 'flight reservation'} is confirmed under reference <strong>{bookingDataFromDb?.confirmation_code || bookingRef}</strong>.</li>
                    <li>A detailed confirmation itinerary and {isAmtrak ? 'train ticket receipt' : 'flight e-ticket'} has been sent to <strong>{bookingDataFromDb?.email}</strong>.</li>
                    <li>For support or itinerary changes, call us anytime at {SUPPORT_PHONE_DISPLAY}.</li>
                  </ul>
                </div>
              </div>
            );
          })()}

          {/* Conditional view: Consulting Payment */}
          {type === 'consulting' && (
            <div className="receipt-item-details-box">
              <div className="receipt-sub-header">
                <i className="fas fa-concierge-bell"></i> Consulting Service Plan
              </div>
              
              <div className="consulting-receipt-visual">
                <h4>Travel Logistics Advisory</h4>
                <p>Urgent travel planning, itinerary coordination, and support services.</p>
              </div>

              <div className="next-steps-info">
                <strong>What Happens Next:</strong>
                <ul>
                  <li>An advisor has been assigned to your travel request and is reviewing your details.</li>
                  <li>We will contact you via email or phone within 2 hours.</li>
                  <li>If you require immediate dispatch, call our hotline at {SUPPORT_PHONE_DISPLAY}.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="action-buttons-wrapper no-print">
          <button onClick={handlePrint} className="success-btn success-btn-secondary">
            <i className="fas fa-print"></i> Print / Download Ticket
          </button>
          <Link to="/my-bookings" className="success-btn success-btn-accent">
            <i className="fas fa-calendar-check"></i> Go to My Bookings
          </Link>
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
