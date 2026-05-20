import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingAPI, paymentAPI } from '../services/api';
import './Booking.css';

function Booking() {
  const navigate = useNavigate();
  const [flight, setFlight] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    nationality: '',
    passportNumber: '',
    passportExpiry: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    paymentMethod: 'creditCard'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const flightData = JSON.parse(sessionStorage.getItem('selectedFlight') || 'null');
    if (!flightData) {
      navigate('/');
      return;
    }
    setFlight(flightData);
  }, [navigate]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateTotal = () => {
    const basePrice = parseFloat(flight?.price?.total || 0);
    const taxes = basePrice * 0.15; // 15% taxes
    return {
      subtotal: basePrice.toFixed(2),
      taxes: taxes.toFixed(2),
      total: (basePrice + taxes).toFixed(2)
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const pricing = calculateTotal();
      const bookingData = {
        ...formData,
        flight,
        subtotal: `$${pricing.subtotal}`,
        taxes: `$${pricing.taxes}`,
        total: `$${pricing.total}`,
        paymentStatus: 'pending'
      };

      // Process payment if credit card
      if (formData.paymentMethod === 'creditCard') {
        // Create Razorpay order
        await paymentAPI.createRazorpayOrder(
          parseFloat(pricing.total),
          'USD'
        );
        
        // In a real app, you would integrate Razorpay SDK here
        // For now, we'll proceed with booking
      }

      // Create booking
      const response = await bookingAPI.create(bookingData);
      
      if (response.success) {
        sessionStorage.setItem('bookingReference', response.data.bookingReference);
        const searchType = sessionStorage.getItem('searchType') || 'oneway';
        navigate(searchType === 'roundtrip' ? '/confirmation/round-trip' : '/confirmation/one-way');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Failed to complete booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!flight) {
    return <div>Loading...</div>;
  }

  const pricing = calculateTotal();

  return (
    <div className="booking-page">
      <div className="container">
        <h2>Complete Your Booking</h2>
        
        <div className="booking-content">
          <div className="booking-form-section">
            <form id="bookingForm" onSubmit={handleSubmit}>
              <div className="form-section">
                <h3>Passenger Information</h3>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    required
                  />
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  required
                />
                <div className="form-row">
                  <input
                    type="date"
                    placeholder="Date of Birth"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    required
                  />
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    required
                  >
                    <option value="">Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Nationality"
                  value={formData.nationality}
                  onChange={(e) => handleInputChange('nationality', e.target.value)}
                  required
                />
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Passport Number"
                    value={formData.passportNumber}
                    onChange={(e) => handleInputChange('passportNumber', e.target.value)}
                    required
                  />
                  <input
                    type="date"
                    placeholder="Passport Expiry"
                    value={formData.passportExpiry}
                    onChange={(e) => handleInputChange('passportExpiry', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Emergency Contact</h3>
                <input
                  type="text"
                  placeholder="Emergency Contact Name"
                  value={formData.emergencyName}
                  onChange={(e) => handleInputChange('emergencyName', e.target.value)}
                  required
                />
                <input
                  type="tel"
                  placeholder="Emergency Contact Phone"
                  value={formData.emergencyPhone}
                  onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Relationship"
                  value={formData.emergencyRelationship}
                  onChange={(e) => handleInputChange('emergencyRelationship', e.target.value)}
                  required
                />
              </div>

              <div className="form-section">
                <h3>Payment Method</h3>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  required
                >
                  <option value="creditCard">Credit Card</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>

              <p className="sms-disclaimer" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', lineHeight: '1.4' }}>
                By providing a telephone number and submitting this form you are consenting to be contacted by SMS text message. Message &amp; data rates may apply. You can reply STOP to opt-out of further messaging.
              </p>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Processing...' : 'Complete Booking'}
              </button>
            </form>
          </div>

          <div className="booking-summary">
            <h3>Flight Summary</h3>
            <div className="summary-card">
              <div className="summary-item">
                <span>Airline:</span>
                <span>{flight.airline}</span>
              </div>
              <div className="summary-item">
                <span>Route:</span>
                <span>{flight.departure?.airport} → {flight.arrival?.airport}</span>
              </div>
              <div className="summary-item">
                <span>Departure:</span>
                <span>{flight.departure?.date} {flight.departure?.time}</span>
              </div>
              <div className="summary-item">
                <span>Arrival:</span>
                <span>{flight.arrival?.date} {flight.arrival?.time}</span>
              </div>
              <div className="summary-divider"></div>
              <div className="summary-item">
                <span>Subtotal:</span>
                <span>${pricing.subtotal}</span>
              </div>
              <div className="summary-item">
                <span>Taxes:</span>
                <span>${pricing.taxes}</span>
              </div>
              <div className="summary-item total">
                <span>Total:</span>
                <span>${pricing.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Booking;
