import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { inquiryAPI } from '../services/api';
import './TrainRoute.css';

const TrainRoute = ({ title, metaTitle, metaDescription, keywords }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    travelDateTime: '',
    paxCount: '1',
    specialRequests: '',
    phone: '',
    email: '',
  });
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus('submitting');

    try {
      // Map to existing inquiry API schema structure to keep leads consolidated
      const payload = {
        name: formData.fullName,
        email: formData.email || 'route-inquiry@thefinalseat.com',
        phone: formData.phone,
        origin: title,
        destination: title,
        travelDate: formData.travelDateTime,
        passengers: formData.paxCount,
        notes: formData.specialRequests,
      };

      const result = await inquiryAPI.submitConsulting(payload, 'rail');
      
      setSubmitStatus('success');
      setSubmitMessage(
        result.message || 'Availability request received. We will contact you shortly.'
      );
      setFormData({ fullName: '', travelDateTime: '', paxCount: '1', specialRequests: '', phone: '', email: '' });
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage('Unable to check availability right now. Please call us.');
    }
  };

  return (
    <div className="train-route-page">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="keywords" content={keywords} />
      </Helmet>

      <section className="train-route-hero">
        <div className="container">
          <h1>{title}</h1>
          <p>Premium routing, seamless ticketing, and expert passenger assistance.</p>
        </div>
      </section>

      <section className="train-route-form-section">
        <div className="container">
          <div className="train-route-card">
            <h2>Check Route Availability</h2>
            <form className="train-route-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="John Doe"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1 555 123 4567"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="travelDateTime">Date/Time of Travel</label>
                  <input
                    type="datetime-local"
                    id="travelDateTime"
                    name="travelDateTime"
                    required
                    value={formData.travelDateTime}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="paxCount">Passenger (Pax) Count</label>
                  <select
                    id="paxCount"
                    name="paxCount"
                    value={formData.paxCount}
                    onChange={handleChange}
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} Passenger{i !== 0 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="specialRequests">Special Requests</label>
                <textarea
                  id="specialRequests"
                  name="specialRequests"
                  rows={3}
                  value={formData.specialRequests}
                  onChange={handleChange}
                  placeholder="Any specific seat preferences or accommodations needed?"
                />
              </div>

              {submitMessage && (
                <p className={`form-message ${submitStatus === 'success' ? 'success' : 'error'}`}>
                  {submitMessage}
                </p>
              )}

              <p className="sms-disclaimer" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', lineHeight: '1.4' }}>
                By providing a telephone number and submitting this form you are consenting to be contacted by SMS text message. Message &amp; data rates may apply. You can reply STOP to opt-out of further messaging.
              </p>

              <button type="submit" className="train-route-submit-btn" disabled={submitStatus === 'submitting'}>
                {submitStatus === 'submitting' ? 'Checking...' : 'Check Availability'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TrainRoute;
