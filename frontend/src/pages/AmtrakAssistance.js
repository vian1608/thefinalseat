import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import HeroSlider from '../components/HeroSlider';
import InquiryLocationSelect from '../components/InquiryLocationSelect';
import { amtrakStationSelectGroups } from '../data/amtrakStations';
import CustomerReviews from '../components/CustomerReviews';
import { inquiryAPI } from '../services/api';
import { railReviews } from '../data/customerReviews';
import { railHeroSlides, heroOfferTag } from '../data/heroSlides';
import RouteSlider from '../components/RouteSlider';
import './AmtrakAssistance.css';

const trainRoutesData = [
  { title: 'NYC to Washington, D.C.', path: '/train-nyc-to-dc', image: '/images/train_route_1.png', desc: 'Direct Northeast Corridor Service' },
  { title: 'Washington, D.C. to NYC', path: '/train-dc-to-nyc', image: '/images/train_route_2.png', desc: 'High-speed business class available' },
  { title: 'Philadelphia to NYC', path: '/train-philly-to-nyc', image: '/images/train_route_1.png', desc: 'Fast, reliable Northeast Regional' },
  { title: 'Boston to NYC', path: '/train-boston-to-nyc', image: '/images/train_route_2.png', desc: 'Scenic coastal views on the Acela' },
  { title: 'Chicago to St. Louis', path: '/train-chicago-to-stlouis', image: '/images/train_route_1.png', desc: 'Lincoln Service through the Midwest' },
  { title: 'LA to San Diego', path: '/train-la-to-sandiego', image: '/images/train_route_2.png', desc: 'Pacific Surfliner ocean views' },
  { title: 'Seattle to Portland', path: '/train-seattle-to-portland', image: '/images/train_route_1.png', desc: 'Amtrak Cascades beautiful greenery' },
  { title: 'NYC to Albany', path: '/train-nyc-to-albany', image: '/images/train_route_2.png', desc: 'Empire Service up the Hudson River' }
];

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

function AmtrakAssistance() {
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
        serviceType: 'rail',
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
    <div className="amtrak-page">
      <Helmet>
        <title>Amtrak Assistance & Auto Train Tickets | The Final Seat</title>
        <meta name="keywords" content="buy train tickets, amtrak tickets, amtrak schedule, amtrak student discount, amtrak auto train, autotrain, train car transport, train vehicle transport, move car by train, car transport by train charges, train car carrier, car transport through train, train to new york, train new york washington, train from nyc to dc, train from philly to nyc, train from nyc to philadelphia, train to new york from dc, new york to dc train, new york to boston train, nyc to boston train, boston to nyc train" />
        <meta name="description" content="Expert assistance for booking Amtrak, Auto Train, and vehicle transport. Discover schedules and buy train tickets from NYC, DC, Boston, Philadelphia, and more." />
      </Helmet>
      <HeroSlider
        slides={railHeroSlides}
        variant="rail"
        serviceNavActive="rail"
        inquiryHref="#inquiry"
        offerTag={heroOfferTag}
      />

<section id="inquiry" className="amtrak-section">
        <div className="container">
          <div className="inquiry-split-layout">
            <div className="inquiry-left-panel">
              <h2 style={{ fontSize: '1.8rem', color: '#1e3a5f', marginBottom: '1rem' }}>Need Immediate Support?</h2>
              <p>Skip the form and call us directly to secure your rail logistics immediately.</p>
              
              <a href="tel:+12139659727" className="call-btn amtrak-btn amtrak-btn--cta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', padding: '1.25rem', fontSize: '1.2rem', backgroundColor: '#8b1538', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                <i className="fas fa-phone"></i> Call Now To Book Directly
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
                    <span>No need to wait on long holds like with Amtrak.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="inquiry-right-panel">
              <div className="amtrak-inquiry-card" style={{ margin: 0 }}>
                <h2 style={{ marginBottom: '0.5rem', color: '#1e3a5f', fontSize: '1.75rem' }}>Consulting Inquiry</h2>
                <p className="amtrak-inquiry__intro">
                  Submit your rail logistics details. A consultant will respond with advisory options and a quote outline.
                </p>
            <form className="amtrak-form" onSubmit={handleSubmit}>
              <div className="amtrak-form__row">
                <div className="amtrak-form__group">
                  <label htmlFor="amtrak-name">Full name</label>
                  <input
                    id="amtrak-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="amtrak-form__group">
                  <label htmlFor="amtrak-email">Email</label>
                  <input
                    id="amtrak-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="amtrak-form__row">
                <div className="amtrak-form__group">
                  <label htmlFor="amtrak-phone">Phone (optional)</label>
                  <input
                    id="amtrak-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div className="amtrak-form__group">
                  <label htmlFor="amtrak-passengers">Passengers</label>
                  <select
                    id="amtrak-passengers"
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
              <div className="amtrak-form__row">
                <div className="amtrak-form__group">
                  <InquiryLocationSelect
                    id="amtrak-origin"
                    label="Origin station"
                    value={formData.origin}
                    onChange={(value) => handleChange('origin', value)}
                    groups={amtrakStationSelectGroups}
                    placeholder="Select origin station"
                    required
                  />
                </div>
                <div className="amtrak-form__group">
                  <InquiryLocationSelect
                    id="amtrak-destination"
                    label="Destination station"
                    value={formData.destination}
                    onChange={(value) => handleChange('destination', value)}
                    groups={amtrakStationSelectGroups}
                    placeholder="Select destination station"
                    required
                  />
                </div>
              </div>
              <div className="amtrak-form__row">
                <div className="amtrak-form__group">
                  <label htmlFor="amtrak-date">Preferred travel date</label>
                  <input
                    id="amtrak-date"
                    type="date"
                    value={formData.travelDate}
                    onChange={(e) => handleChange('travelDate', e.target.value)}
                  />
                </div>
              </div>
              <div className="amtrak-form__group">
                <label htmlFor="amtrak-notes">Advisory notes (urgency, accessibility, etc.)</label>
                <textarea
                  id="amtrak-notes"
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
                    By checking this box and submitting this request, I provide my express written consent to receive automated travel updates, route quotes, and booking notifications via SMS from The Final Seat LLC at the number provided. <strong>Consent is not a condition of purchase. Message frequency varies based on booking activity (up to 4 messages per month).</strong> Message and data rates may apply. Text STOP to cancel at any time, or HELP for assistance. View our <Link to="/privacy-policy" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Privacy Policy</Link> and <Link to="/terms" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Terms of Service</Link>.
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="amtrak-btn amtrak-btn--cta amtrak-btn--full"
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

      <section className="amtrak-section">
        <div className="container" style={{ overflow: 'hidden' }}>
          <RouteSlider routes={trainRoutesData} btnClassPrefix="amtrak" />
        </div>
      </section>

      <section className="amtrak-section amtrak-section--muted">
        <div className="container">
          <h2 className="amtrak-section__title">Logistics Advisory Services</h2>
          <div className="amtrak-grid">
            <article className="amtrak-card">
              <i className="fas fa-route" aria-hidden="true" />
              <h3>Itinerary Optimization</h3>
              <p>
                Multi-segment rail planning with realistic connection windows and backup routing
                when schedules shift.
              </p>
            </article>
            <article className="amtrak-card">
              <i className="fas fa-clock" aria-hidden="true" />
              <h3>Urgent Rail Logistics</h3>
              <p>
                Time-sensitive advisory for family, medical, and business travel requiring same-week
                or next-available rail options.
              </p>
            </article>
            <article className="amtrak-card">
              <i className="fas fa-map-marked-alt" aria-hidden="true" />
              <h3>Connection Strategy</h3>
              <p>
                Station transfer planning, overnight positioning, and coordinated ground-to-rail
                logistics where needed.
              </p>
            </article>
            <article className="amtrak-card">
              <i className="fas fa-headset" aria-hidden="true" />
              <h3>24/7 Advisory Desk</h3>
              <p>
                Direct access to consultants for disruption response, re-routing guidance, and
                escalation support.
              </p>
            </article>
          </div>
        </div>
      </section>



            <CustomerReviews reviews={railReviews} variant="rail" />
    </div>
  );
}

export default AmtrakAssistance;
