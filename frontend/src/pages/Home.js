import React, { useState } from 'react';
import HeroSlider from '../components/HeroSlider';
import InquiryLocationSelect from '../components/InquiryLocationSelect';
import { flightAirportSelectGroups } from '../data/flightAirports';
import CustomerReviews from '../components/CustomerReviews';
import { inquiryAPI } from '../services/api';
import { flightReviews } from '../data/customerReviews';
import { flightHeroSlides, heroOfferTag } from '../data/heroSlides';
import './Home.css';

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
      <HeroSlider
        slides={flightHeroSlides}
        variant="flights"
        serviceNavActive="flights"
        inquiryHref="#inquiry"
        offerTag={heroOfferTag}
      />

<section id="inquiry" className="flights-section">
        <div className="container">
          <div className="flights-inquiry-card">
            <h2>Consulting Inquiry</h2>
            <p className="flights-inquiry__intro">
              Submit your air logistics details. A consultant will respond with advisory options and
              a quote outline.
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

      <section className="flights-section">
        <div className="container">
          <h2 className="flights-section__title">How Consulting Works</h2>
          <ol className="flights-steps">
            <li>
              <strong>Consulting inquiry</strong> — Share origin, destination, dates, and urgency.
            </li>
            <li>
              <strong>Logistics strategy</strong> — We evaluate routes, cabins, and connection risk.
            </li>
            <li>
              <strong>Advisory delivery</strong> — You receive a structured plan and fulfillment
              coordination through authorized third-party providers.
            </li>
          </ol>
          <p className="flights-disclaimer">
            The Final Seat LLC is an independent logistics consultancy and does not issue tickets
            directly. Air transport is fulfilled subject to carrier and third-party provider terms.
          </p>
        </div>
      </section>

            <CustomerReviews reviews={flightReviews} variant="flights" />
    </div>
  );
}

export default Home;
