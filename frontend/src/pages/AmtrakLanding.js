import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import InquiryLocationSelect from '../components/InquiryLocationSelect';
import { amtrakStationSelectGroups } from '../data/amtrakStations';
import CustomerReviews from '../components/CustomerReviews';
import { inquiryAPI } from '../services/api';
import { railReviews } from '../data/customerReviews';
import './AmtrakLanding.css';

const initialFormData = {
  name: '',
  email: '',
  phone: '',
  origin: '',
  destination: '',
  travelDate: '',
  passengers: '1',
  notes: '',
};

function AmtrakLanding() {
  // Detailed Form state
  const [formData, setFormData] = useState(initialFormData);
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const handleConsultingScroll = (e) => {
    e.preventDefault();
    // Smooth scroll to inquiry form
    const formElement = document.getElementById('inquiry-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus('submitting');
    setSubmitMessage('');

    try {
      const result = await inquiryAPI.submitConsulting({
        serviceType: 'rail',
        ...formData,
      });
      setSubmitStatus('success');
      setSubmitMessage(
        result.message || 'Thank you. Your inquiry was submitted and our team will contact you shortly.'
      );
      setFormData(initialFormData);

      // Fire Google Ads conversion event
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'conversion', {
          'send_to': 'AW-18166581434/W9aXCMPzpq8cELqRwNZD',
          'transaction_id': ''
        });
      }
    } catch (error) {
      setSubmitStatus('error');
      if (error.response?.data?.error) {
        setSubmitMessage(error.response.data.error);
      } else if (error.code === 'ERR_NETWORK' || !error.response) {
        const isLocal =
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        setSubmitMessage(
          isLocal
            ? 'Unable to reach the server. Start the backend on port 5001 (cd backend && npm run dev), restart the frontend, then try again.'
            : 'Unable to reach our servers. Hard-refresh the page (Cmd+Shift+R) and try again, or email support@thefinalseat.com.'
        );
      } else {
        setSubmitMessage('Unable to submit right now. Please call us or email support@thefinalseat.com.');
      }
    }
  };

  return (
    <div className="amtrak-landing-page">
      <Helmet>
        <title>Amtrak Ticket Booking & Fast Advisory Desk | The Final Seat</title>
        <meta name="keywords" content="buy train tickets, amtrak tickets, amtrak schedule, amtrak student discount, amtrak auto train, autotrain, train car transport, train vehicle transport, move car by train, car transport by train charges, train car carrier, car transport through train, train to new york, train new york washington, train from nyc to dc, train from philly to nyc, train from nyc to philadelphia, train to new york from dc, new york to dc train, new york to boston train, nyc to boston train, boston to nyc train" />
        <meta name="description" content="Stunning Amtrak & Auto Train express ticket coordination. Skip the booking line and connect instantly with our 24/7 dedicated train logistics advisory desk." />
        <link rel="canonical" href="https://thefinalseat.com/amtrak" />
      </Helmet>

      {/* Hero Section */}
      <section className="amtrak-landing-hero">
        <div className="container">
          
          {/* Authentic Amtrak Header Brand Logo */}
          <div className="amtrak-official-header">
            <svg width="46" height="46" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 32C30 32, 45 42, 90 42" stroke="#0076A5" strokeWidth="12" strokeLinecap="round" />
              <path d="M10 50C30 50, 45 60, 90 60" stroke="#D12630" strokeWidth="12" strokeLinecap="round" />
              <path d="M10 68C30 68, 45 78, 90 78" stroke="#0f2744" strokeWidth="12" strokeLinecap="round" />
            </svg>
            <span className="amtrak-logo-text">AMTRAK</span>
            <span className="amtrak-partner-badge">OFFICIAL SUPPORT AGENT</span>
          </div>

          <h1>Express Amtrak Booking & Advisory</h1>
          <p className="hero-lead">
            Skip long Amtrak hold times. Connect with our dedicated advisory desk to optimize routing, secure sleeper roomettes, and handle urgent rail ticketing instantly.
          </p>

          {/* THE MAIN ACTION CARD WITH ONLY TWO CORE CTAs */}
          <div className="booking-engine-card">
            <div className="booking-two-actions">
              
              {/* Core CTA 1: THE ULTIMATE CALL NOW BUTTON */}
              <a href="tel:+12139659227" className="booking-call-cta-heavy">
                <span className="booking-cta-pulse"></span>
                <span className="booking-active-badge-heavy">24/7 TRAVEL DESK ACTIVE</span>
                <div className="booking-cta-title-heavy">
                  <i className="fas fa-phone-alt"></i>
                  <span>CALL NOW TO BOOK</span>
                </div>
                <div className="booking-cta-subtext-heavy">
                  Speak directly with an Amtrak booking advisor at +1 (213) 965-9227
                </div>
              </a>

              {/* Core CTA 2: CONSULTING INQUIRY BUTTON */}
              <button onClick={handleConsultingScroll} className="booking-consulting-cta-heavy">
                <span className="booking-active-badge-secondary">SELF SERVICE OPTIONS</span>
                <div className="booking-cta-title-heavy-sec">
                  <i className="fas fa-edit"></i>
                  <span>SUBMIT INQUIRY ONLINE</span>
                </div>
                <div className="booking-cta-subtext-heavy-sec">
                  Receive customized train quotes via Email or SMS
                </div>
              </button>

            </div>
          </div>

        </div>
      </section>

      {/* Content Offset spacer to account for overlapping card */}
      <div className="amtrak-landing-content-offset"></div>

      {/* Dynamic Step-by-Step Layout */}
      <section className="amtrak-landing-steps">
        <div className="container">
          <div className="marketing-heading">
            <h2>Seamless Direct Rail Advisory</h2>
            <p>Our passenger support model delivers ticket clarity and stress-free logistics in three easy steps.</p>
          </div>

          <div className="steps-grid">
            <div className="step-item">
              <div className="step-number">1</div>
              <h3>Specify Route</h3>
              <p>Identify your desired departure, arrival station, and date parameters above.</p>
            </div>

            <div className="step-item">
              <div className="step-number">2</div>
              <h3>Call the Desk</h3>
              <p>Tap our safety-red hotline to establish instant voice communication with an Amtrak booking advisor.</p>
            </div>

            <div className="step-item">
              <div className="step-number">3</div>
              <h3>Travel with Advisory</h3>
              <p>Receive tickets directly in your inbox and enjoy complete 24/7 disruption monitoring through the day of travel.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Official Amtrak Route & Train Gallery */}
      <section className="amtrak-gallery-section">
        <div className="container">
          <div className="marketing-heading">
            <h2>Official Amtrak Gallery & Service Showcase</h2>
            <p>Breathtaking views and premium accommodation options available across Amtrak's historical network.</p>
          </div>

          <div className="amtrak-gallery-grid">
            <div className="amtrak-gallery-card">
              <div className="gallery-image-wrapper">
                <img src="/images/amtrak_scenic_view.png" alt="Amtrak Coastal Sunset View" />
                <span className="gallery-tag">WEST COAST</span>
              </div>
              <div className="gallery-info">
                <h3>Scenic Coastline Sunset Route</h3>
                <p>Captivating views along the Pacific Surfliner and Coast Starlight pathways overlooking the gorgeous ocean coastline.</p>
              </div>
            </div>

            <div className="amtrak-gallery-card">
              <div className="gallery-image-wrapper">
                <img src="/images/train_route_1.png" alt="Amtrak Northeast Regional" />
                <span className="gallery-tag">NORTHEAST CORRIDOR</span>
              </div>
              <div className="gallery-info">
                <h3>Northeast Regional Express</h3>
                <p>Accelerated and comfortable business class transit connecting Washington D.C., Philadelphia, New York, and Boston.</p>
              </div>
            </div>

            <div className="amtrak-gallery-card">
              <div className="gallery-image-wrapper">
                <img src="/images/train_route_2.png" alt="Amtrak Long Distance Sleeper" />
                <span className="gallery-tag">NATIONAL NETWORK</span>
              </div>
              <div className="gallery-info">
                <h3>Long-Distance Sleeper Coaches</h3>
                <p>Private Superliner roomettes and bedrooms designed for optimal overnight rest across historical cross-country journeys.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Marketing Value Section */}
      <section className="amtrak-landing-marketing">
        <div className="container">
          <div className="marketing-heading">
            <h2>Why Book With Our Advisory Desk?</h2>
            <p>We combine deep logistics expertise with 24/7 responsiveness to keep your journey on schedule.</p>
          </div>

          <div className="marketing-features">
            <div className="marketing-feature-card">
              <div className="feature-icon-wrapper">
                <i className="fas fa-shield-alt"></i>
              </div>
              <h3>Guaranteed Disruption Shield</h3>
              <p>When Amtrak cancels or delays, our desk proactively locks in alternate routes or emergency options before you get stranded at the platform.</p>
            </div>

            <div className="marketing-feature-card">
              <div className="feature-icon-wrapper">
                <i className="fas fa-bed"></i>
              </div>
              <h3>Premium Cabin Curation</h3>
              <p>Specialized reservation support for Acela First Class, Roomettes, Bedrooms, and long-distance Auto Train auto transport holds.</p>
            </div>

            <div className="marketing-feature-card">
              <div className="feature-icon-wrapper">
                <i className="fas fa-headset"></i>
              </div>
              <h3>No Holds, Ever</h3>
              <p>Bypass the average 45-minute phone queues at Amtrak. We dial the exclusive carrier lines on your behalf to resolve requests instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call Hotline Callout Section */}
      <section className="amtrak-landing-hotline">
        <div className="container">
          <h2>Need Urgent Booking Support?</h2>
          <p>Don't wait for schedules online. Our travel consultants are standing by to lock in your tickets right now.</p>
          <a href="tel:+12139659227" className="hotline-phone-btn">
            <i className="fas fa-phone-volume"></i>
            <span>+1 (213) 965-9227</span>
          </a>
        </div>
      </section>

      {/* Self-Service Inquiry Form Section */}
      <section id="inquiry-form" className="amtrak-landing-form-sec">
        <div className="container">
          <div className="inquiry-split-layout">
            
            {/* Left Column Information */}
            <div className="inquiry-left-panel">
              <h2>Self-Service Consultation</h2>
              <p>If you prefer to communicate via email/SMS, submit your advisory request details below. A train specialist will reply with itinerary quotes and optimized schedule outlines.</p>
              
              <div className="benefits-list">
                <h3>Passenger Privileges Included:</h3>
                <ul>
                  <li>
                    <i className="fas fa-check-circle"></i>
                    <span>Free itinerary monitoring and same-day re-booking privileges.</span>
                  </li>
                  <li>
                    <i className="fas fa-check-circle"></i>
                    <span>Pre-assigned seating coordination and baggage planning assistance.</span>
                  </li>
                  <li>
                    <i className="fas fa-check-circle"></i>
                    <span>Dedicated direct-dial numbers for subsequent changes en route.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column Form Card */}
            <div className="inquiry-right-panel">
              <div className="amtrak-landing-form-card">
                <h2>Consulting Inquiry</h2>
                <p>Submit your rail logistics parameters below for custom ticketing quotes.</p>

                <form onSubmit={handleSubmit}>
                  <div className="form-group-grid">
                    <div className="form-field-wrapper">
                      <label htmlFor="name">Full Name</label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="form-field-wrapper">
                      <label htmlFor="email">Email</label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="form-group-grid">
                    <div className="form-field-wrapper">
                      <label htmlFor="phone">Phone (optional)</label>
                      <input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        placeholder="+1 555-123-4567"
                      />
                    </div>
                    <div className="form-field-wrapper">
                      <label htmlFor="passengers">Passengers</label>
                      <select
                        id="passengers"
                        value={formData.passengers}
                        onChange={(e) => handleChange('passengers', e.target.value)}
                      >
                        <option value="1">1 Passenger</option>
                        <option value="2">2 Passengers</option>
                        <option value="3">3 Passengers</option>
                        <option value="4">4 Passengers</option>
                        <option value="5+">5+ Passengers</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group-grid">
                    <div className="form-field-wrapper">
                      <InquiryLocationSelect
                        id="origin"
                        label="Origin Station"
                        value={formData.origin}
                        onChange={(val) => handleChange('origin', val)}
                        groups={amtrakStationSelectGroups}
                        placeholder="Select origin station"
                        required
                      />
                    </div>
                    <div className="form-field-wrapper">
                      <InquiryLocationSelect
                        id="destination"
                        label="Destination Station"
                        value={formData.destination}
                        onChange={(val) => handleChange('destination', val)}
                        groups={amtrakStationSelectGroups}
                        placeholder="Select destination station"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field-wrapper" style={{ marginBottom: '1.25rem' }}>
                    <label htmlFor="date">Depart Date</label>
                    <input
                      id="date"
                      type="date"
                      value={formData.travelDate}
                      onChange={(e) => handleChange('travelDate', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-field-wrapper" style={{ marginBottom: '1.25rem' }}>
                    <label htmlFor="notes">Advisory Notes (sleeper cabin preference, car transport details, accessibility, urgency)</label>
                    <textarea
                      id="notes"
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => handleChange('notes', e.target.value)}
                      placeholder="Specify Auto Train vehicle requirements, medical assistance needs, or route connections..."
                    />
                  </div>

                  {/* SMS opt-in compliance checkbox block */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <input 
                        type="checkbox" 
                        id="smsOptIn" 
                        name="smsOptIn" 
                        required 
                        style={{ marginTop: '0.25rem', width: 'auto', minHeight: 'auto', cursor: 'pointer' }}
                      />
                      <label htmlFor="smsOptIn" style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.625', cursor: 'pointer' }}>
                        By checking this box and submitting this request, I provide my express written consent to receive automated train updates, route quotes, and booking notifications via SMS from The Final Seat LLC at the number provided. <strong>Consent is not a condition of purchase. Message frequency varies based on booking activity (up to 4 messages per month).</strong> Message and data rates may apply. Text STOP to cancel at any time, or HELP for assistance. View our <Link to="/privacy-policy" style={{ color: '#0f2744', textDecoration: 'underline', fontWeight: '600' }}>Privacy Policy</Link> and <Link to="/terms" style={{ color: '#0f2744', textDecoration: 'underline', fontWeight: '600' }}>Terms of Service</Link>.
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="submit-inquiry-btn"
                    disabled={submitStatus === 'submitting'}
                  >
                    {submitStatus === 'submitting' ? 'Submitting request...' : 'Submit Consulting Inquiry'}
                  </button>

                  {submitMessage && (
                    <p
                      className={`inquiry-form__message ${
                        submitStatus === 'success' ? 'inquiry-form__message--success' : 'inquiry-form__message--error'
                      }`}
                      role="alert"
                      style={{ marginTop: '1.25rem' }}
                    >
                      {submitMessage}
                    </p>
                  )}
                </form>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Customer Reviews Section */}
      <CustomerReviews reviews={railReviews} variant="rail" />
    </div>
  );
}

export default AmtrakLanding;
