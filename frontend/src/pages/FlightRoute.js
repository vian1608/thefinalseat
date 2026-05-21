import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { inquiryAPI } from '../services/api';
import './FlightRoute.css';

const FlightRoute = ({ title, metaTitle, metaDescription, keywords }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    travelDateTime: '',
    paxCount: '1',
    cabinClass: 'economy',
    tripType: 'roundtrip',
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
      const payload = {
        name: formData.fullName,
        email: formData.email || 'route-inquiry@thefinalseat.com',
        phone: formData.phone,
        origin: title,
        destination: title,
        travelDate: formData.travelDateTime,
        passengers: formData.paxCount,
        notes: `Cabin: ${formData.cabinClass}, Trip: ${formData.tripType}. ${formData.specialRequests}`,
      };

      const result = await inquiryAPI.submitConsulting(payload, 'flights');
      
      setSubmitStatus('success');
      setSubmitMessage(
        result.message || 'Availability request received. We will contact you shortly.'
      );
      setFormData({ fullName: '', travelDateTime: '', paxCount: '1', cabinClass: 'economy', tripType: 'roundtrip', specialRequests: '', phone: '', email: '' });
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage('Unable to check availability right now. Please call us.');
    }
  };

  return (
    <div className="flight-route-page">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="keywords" content={keywords} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <section className="flight-route-hero">
        <div className="container">
          <h1>{title}</h1>
          <p>Premium routing, seamless ticketing, and expert passenger assistance.</p>
        </div>
      </section>

      <section className="flight-route-form-section">
        <div className="container">
          <div className="inquiry-split-layout">
            <div className="inquiry-left-panel">
              <h2>Need Immediate Support?</h2>
              <p>Skip the form and call us directly to secure your air logistics immediately.</p>
              
              <a href="tel:+12139659727" className="call-btn flights-btn flights-btn--cta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', padding: '1.25rem', fontSize: '1.2rem', backgroundColor: '#1e293b', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                <i className="fas fa-phone"></i> Call Now To Book Directly
              </a>
              
              <div className="benefits-list">
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#1e293b' }}>Benefits for booking with us:</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'start' }}>
                    <i className="fas fa-check-circle" style={{ color: '#3b82f6', marginTop: '0.25rem' }}></i>
                    <span>Includes free 24/7 support till date of travel.</span>
                  </li>
                  <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                    <i className="fas fa-check-circle" style={{ color: '#3b82f6', marginTop: '0.25rem' }}></i>
                    <span>No need to wait on long holds like with the airline.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="inquiry-right-panel">
              <div className="flight-route-card" style={{ margin: 0 }}>
                <h2>Check Route Availability</h2>
                <form className="flight-route-form" onSubmit={handleSubmit}>
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
                  <label htmlFor="paxCount">Passenger Count</label>
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

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tripType">Trip Type</label>
                  <select id="tripType" name="tripType" value={formData.tripType} onChange={handleChange}>
                    <option value="roundtrip">Round Trip</option>
                    <option value="oneway">One Way</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="cabinClass">Cabin Class</label>
                  <select id="cabinClass" name="cabinClass" value={formData.cabinClass} onChange={handleChange}>
                    <option value="economy">Economy</option>
                    <option value="premium">Premium Economy</option>
                    <option value="business">Business</option>
                    <option value="first">First</option>
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
                  placeholder="Any specific seating or meal preferences?"
                />
              </div>

              {submitMessage && (
                <p className={`form-message ${submitStatus === 'success' ? 'success' : 'error'}`}>
                  {submitMessage}
                </p>
              )}

              {/* SMS OPT-IN COMPLIANCE DISCLOSURE BLOCK */}
              <div className="md:col-span-2 mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    id="smsOptIn" 
                    name="smsOptIn" 
                    required 
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="smsOptIn" className="text-xs text-slate-600 leading-relaxed">
                    By checking this box and submitting this request, I provide my express written consent to receive automated flight updates, travel quotes, and booking notifications via SMS from The Final Seat LLC at the number provided. <strong>Consent is not a condition of purchase. Message frequency varies based on booking activity (up to 4 messages per month).</strong> Message and data rates may apply. Text STOP to cancel at any time, or HELP for assistance. View our <a href="/privacy-policy" className="text-indigo-600 underline hover:text-indigo-800">Privacy Policy</a> and <a href="/terms" className="text-indigo-600 underline hover:text-indigo-800">Terms of Service</a>.
                  </label>
                </div>
              </div>

              <div className="md:col-span-2 mt-2">
                <button type="submit" className="w-full p-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition duration-150 ease-in-out text-sm shadow-sm flight-route-submit-btn" disabled={submitStatus === 'submitting'}>
                  {submitStatus === 'submitting' ? 'Checking...' : 'Check Availability'}
                </button>
              </div>
            </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FlightRoute;
