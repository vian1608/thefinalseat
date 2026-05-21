import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const canonicalUrl = `https://thefinalseat.com${location.pathname}`;

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
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <section className="train-route-hero">
        <div className="container">
          <h1>{title}</h1>
          <p>Premium routing, seamless ticketing, and expert passenger assistance.</p>
        </div>
      </section>

      <section className="train-route-form-section">
        <div className="container">
          <div className="inquiry-split-layout">
            <div className="inquiry-left-panel">
              <h2>Need Immediate Support?</h2>
              <p>Skip the form and call us directly to secure your rail logistics immediately.</p>
              
              <a href="tel:+12139659727" className="call-btn amtrak-btn amtrak-btn--cta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', padding: '1.25rem', fontSize: '1.2rem', backgroundColor: '#1e3a5f', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                <i className="fas fa-phone"></i> Call Now To Book Directly
              </a>
              
              <div className="benefits-list">
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#1e3a5f' }}>Benefits for booking with us:</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'start' }}>
                    <i className="fas fa-check-circle" style={{ color: '#0ea5e9', marginTop: '0.25rem' }}></i>
                    <span>Includes free 24/7 support till date of travel.</span>
                  </li>
                  <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                    <i className="fas fa-check-circle" style={{ color: '#0ea5e9', marginTop: '0.25rem' }}></i>
                    <span>No need to wait on long holds like with Amtrak.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="inquiry-right-panel">
              <div className="train-route-card" style={{ margin: 0 }}>
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

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="travelDateTime">Date of Travel</label>
                  <input
                    type="date"
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


              {/* SMS OPT-IN COMPLIANCE DISCLOSURE BLOCK */}
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1rem', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <input 
                    type="checkbox" 
                    id="smsOptIn" 
                    name="smsOptIn" 
                    required 
                    style={{ marginTop: '0.25rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="smsOptIn" style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.625', cursor: 'pointer' }}>
                    By checking this box and clicking 'Check Availability', I provide my express written consent to receive automated train updates, travel quotes, and booking notifications via SMS from The Final Seat LLC at the number provided. <strong>Consent is not a condition of purchase. Message frequency varies based on booking activity (up to 4 messages per month).</strong> Message and data rates may apply. Text STOP to cancel at any time, or HELP for assistance. View our <a href="/privacy-policy" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Privacy Policy</a> and <a href="/terms" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Terms of Service</a>.
                  </label>
                </div>
              </div>

              <div className="md:col-span-2 mt-2">
                <button type="submit" className="train-route-submit-btn" disabled={submitStatus === 'submitting'}>
                  {submitStatus === 'submitting' ? 'Checking...' : 'Check Availability'}
                </button>
              </div>

              {submitMessage && (
                <div className="md:col-span-2 mt-2">
                  <p className={`form-message ${submitStatus === 'success' ? 'success' : 'error'}`}>
                    {submitMessage}
                  </p>
                </div>
              )}
            </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TrainRoute;
