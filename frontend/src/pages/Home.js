import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import HeroSlider from '../components/HeroSlider';
import InquiryLocationSelect from '../components/InquiryLocationSelect';
import { flightAirportSelectGroups } from '../data/flightAirports';
import CustomerReviews from '../components/CustomerReviews';
import { inquiryAPI } from '../services/api';
import { flightReviews } from '../data/customerReviews';
import { flightHeroSlides, heroOfferTag } from '../data/heroSlides';
import RouteSlider from '../components/RouteSlider';
import './Home.css';

const flightRoutesData = [
  { title: 'NYC to London (LHR)', path: '/flight-nyc-to-lon', image: '/images/london_lhr.png', desc: 'Direct transatlantic routes available.' },
  { title: 'LAX to Tokyo (NRT)', path: '/flight-lax-to-tokyo', image: '/images/tokyo_nrt.png', desc: 'Premium cabins on direct Pacific flights.' },
  { title: 'Miami to Paris (CDG)', path: '/flight-mia-to-paris', image: '/images/paris_cdg.png', desc: 'Non-stop flights to Charles de Gaulle.' },
  { title: 'Chicago to Frankfurt', path: '/flight-ord-to-fra', image: '/images/frankfurt_fra.png', desc: 'Direct access to the heart of Europe.' },
  { title: 'SFO to Sydney', path: '/flight-sfo-to-syd', image: '/images/sydney_syd.png', desc: 'Transpacific routes with lie-flat seating.' },
  { title: 'JFK to Dubai', path: '/flight-jfk-to-dxb', image: '/images/dubai_dxb.png', desc: 'Ultimate luxury to the Middle East.' },
  { title: 'Dallas to London', path: '/flight-dfw-to-lhr', image: '/images/london_lhr.png', desc: 'Non-stop from Texas to the UK.' },
  { title: 'Boston to Dublin', path: '/flight-bos-to-dub', image: '/images/flight_route_2.png', desc: 'Fastest route to Ireland.' }
];

const initialFormData = {
  name: '',
  email: '',
  phone: '',
  origin: '',
  destination: '',
  tripType: 'roundtrip',
  travelDate: '',
  returnDate: '',
  passengers: '1',
  cabinClass: 'economy',
  notes: '',
};

function Home() {
  const [formData, setFormData] = useState(initialFormData);
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus('submitting');
    setSubmitMessage('');

    try {
      const result = await inquiryAPI.submitConsulting({
        serviceType: 'flights',
        ...formData,
      });
      setSubmitStatus('success');
      setSubmitMessage(
        result.message ||
          'Thank you. Your inquiry was submitted and our team will contact you shortly.'
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
        setSubmitMessage(
          'Unable to submit right now. Please call us or email support@thefinalseat.com.'
        );
      }
    }
  };

  return (
    <div className="flights-page">
      <Helmet>
      </Helmet>
      <HeroSlider
        slides={flightHeroSlides}
        variant="flights"
        serviceNavActive="flights"
        inquiryHref="#inquiry"
        offerTag={heroOfferTag}
      />

<section id="inquiry" className="flights-section">
        <div className="container">
          <div className="inquiry-split-layout">
            <div className="inquiry-left-panel">
              <h2 style={{ fontSize: '1.8rem', color: '#1e293b', marginBottom: '1rem' }}>Need Immediate Support?</h2>
              <p>Skip the form and call us directly to secure your air logistics immediately.</p>
              
              <a href="tel:+12139659727" className="call-btn flights-btn flights-btn--cta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', padding: '1.25rem', fontSize: '1.2rem', backgroundColor: '#8b1538', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                <i className="fas fa-phone-alt"></i> Call Now To Book Directly
              </a>
              
              <div className="benefits-list">
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#1e293b' }}>Benefits for booking with us:</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'start' }}>
                    <i className="fas fa-check-circle" style={{ color: '#8b1538', marginTop: '0.25rem' }}></i>
                    <span>Includes free 24/7 support till date of travel.</span>
                  </li>
                  <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                    <i className="fas fa-check-circle" style={{ color: '#8b1538', marginTop: '0.25rem' }}></i>
                    <span>No need to wait on long holds like with the airline.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="inquiry-right-panel">
              <div className="flights-inquiry-card" style={{ margin: 0 }}>
                <h2 style={{ marginBottom: '0.5rem', color: '#1e293b', fontSize: '1.75rem' }}>Consulting Inquiry</h2>
                <p className="flights-inquiry__intro">
                  Submit your air logistics details. A consultant will respond with advisory options and a quote outline.
                </p>
            <form className="flights-form" onSubmit={handleSubmit}>
              <div className="flights-form__row">
                <div className="flights-form__group">
                  <label htmlFor="flight-name">Full name</label>
                  <input
                    id="flight-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="flights-form__group">
                  <label htmlFor="flight-email">Email</label>
                  <input
                    id="flight-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="flights-form__row">
                <div className="flights-form__group">
                  <label htmlFor="flight-phone">Phone (optional)</label>
                  <input
                    id="flight-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div className="flights-form__group">
                  <label htmlFor="flight-passengers">Passengers</label>
                  <select
                    id="flight-passengers"
                    value={formData.passengers}
                    onChange={(e) => handleChange('passengers', e.target.value)}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5+">5+</option>
                  </select>
                </div>
              </div>
              <div className="flights-form__row">
                <div className="flights-form__group">
                  <InquiryLocationSelect
                    id="flight-origin"
                    label="Origin airport"
                    value={formData.origin}
                    onChange={(value) => handleChange('origin', value)}
                    groups={flightAirportSelectGroups}
                    placeholder="Select origin airport"
                    required
                  />
                </div>
                <div className="flights-form__group">
                  <InquiryLocationSelect
                    id="flight-destination"
                    label="Destination airport"
                    value={formData.destination}
                    onChange={(value) => handleChange('destination', value)}
                    groups={flightAirportSelectGroups}
                    placeholder="Select destination airport"
                    required
                  />
                </div>
              </div>
              <div className="flights-form__row">
                <div className="flights-form__group">
                  <label htmlFor="flight-trip-type">Trip type</label>
                  <select
                    id="flight-trip-type"
                    value={formData.tripType}
                    onChange={(e) => handleChange('tripType', e.target.value)}
                  >
                    <option value="oneway">One way</option>
                    <option value="roundtrip">Round trip</option>
                  </select>
                </div>
                <div className="flights-form__group">
                  <label htmlFor="flight-cabin">Preferred cabin</label>
                  <select
                    id="flight-cabin"
                    value={formData.cabinClass}
                    onChange={(e) => handleChange('cabinClass', e.target.value)}
                  >
                    <option value="economy">Economy</option>
                    <option value="premium">Premium economy</option>
                    <option value="business">Business</option>
                    <option value="first">First</option>
                  </select>
                </div>
              </div>
              <div className="flights-form__row">
                <div className="flights-form__group">
                  <label htmlFor="flight-date">Departure date</label>
                  <input
                    id="flight-date"
                    type="date"
                    value={formData.travelDate}
                    onChange={(e) => handleChange('travelDate', e.target.value)}
                  />
                </div>
                {formData.tripType === 'roundtrip' && (
                  <div className="flights-form__group">
                    <label htmlFor="flight-return">Return date</label>
                    <input
                      id="flight-return"
                      type="date"
                      value={formData.returnDate}
                      onChange={(e) => handleChange('returnDate', e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="flights-form__group">
                <label htmlFor="flight-notes">Advisory notes (urgency, visa, accessibility, etc.)</label>
                <textarea
                  id="flight-notes"
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Describe your logistics needs and timeline."
                />
              </div>
              {submitMessage && (
                <p
                  className={`inquiry-form__message ${
                    submitStatus === 'success'
                      ? 'inquiry-form__message--success'
                      : 'inquiry-form__message--error'
                  }`}
                  role="alert"
                >
                  {submitMessage}
                </p>
              )}
              <p className="sms-disclaimer" style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', lineHeight: '1.4' }}>
                By providing a telephone number and submitting this form you are consenting to be contacted by SMS text message. Message &amp; data rates may apply. You can reply STOP to opt-out of further messaging.
              </p>
              <button
                type="submit"
                className="flights-btn flights-btn--cta flights-btn--full"
                disabled={submitStatus === 'submitting'}
              >
                {submitStatus === 'submitting' ? 'Submitting…' : 'Submit Consulting Inquiry'}
              </button>
            </form>
          </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flights-section">
        <div className="container" style={{ overflow: 'hidden' }}>
          <RouteSlider routes={flightRoutesData} btnClassPrefix="flights" />
        </div>
      </section>

      <section className="flights-section flights-section--muted">
        <div className="container">
          <h2 className="flights-section__title">Logistics Advisory Services</h2>
          <div className="flights-grid">
            <article className="flights-card">
              <i className="fas fa-route" aria-hidden="true" />
              <h3>Itinerary Optimization</h3>
              <p>
                Multi-leg routing with realistic connection windows, backup options, and
                carrier-specific guidance when schedules change.
              </p>
            </article>
            <article className="flights-card">
              <i className="fas fa-clock" aria-hidden="true" />
              <h3>Urgent Air Logistics</h3>
              <p>
                Same-week and emergency advisory for family, medical, and business travel
                requiring fast, workable options.
              </p>
            </article>
            <article className="flights-card">
              <i className="fas fa-globe-americas" aria-hidden="true" />
              <h3>International Strategy</h3>
              <p>
                Cross-border routing, document timing, and coordinated connections for complex
                global itineraries.
              </p>
            </article>
            <article className="flights-card">
              <i className="fas fa-headset" aria-hidden="true" />
              <h3>24/7 Advisory Desk</h3>
              <p>
                Direct consultant access for cancellations, re-routing, and escalation support
                when plans shift unexpectedly.
              </p>
            </article>
          </div>
        </div>
      </section>



            <CustomerReviews reviews={flightReviews} variant="flights" />
    </div>
  );
}

export default Home;
