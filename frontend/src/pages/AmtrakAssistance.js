import React, { useState } from 'react';
import HeroSlider from '../components/HeroSlider';
import CustomerReviews from '../components/CustomerReviews';
import { inquiryAPI } from '../services/api';
import { railReviews } from '../data/customerReviews';
import { railHeroSlides, heroOfferTag } from '../data/heroSlides';
import './AmtrakAssistance.css';

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
      <HeroSlider
        slides={railHeroSlides}
        variant="rail"
        serviceNavActive="rail"
        inquiryHref="#inquiry"
        offerTag={heroOfferTag}
      />

<section id="inquiry" className="amtrak-section">
        <div className="container">
          <div className="amtrak-inquiry-card">
            <h2>Consulting Inquiry</h2>
            <p className="amtrak-inquiry__intro">
              Submit your rail logistics details. A consultant will respond with advisory options and
              a quote outline.
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
                  <label htmlFor="amtrak-origin">Origin station or region</label>
                  <input
                    id="amtrak-origin"
                    type="text"
                    value={formData.origin}
                    onChange={(e) => handleChange('origin', e.target.value)}
                    placeholder="e.g. Chicago Union Station"
                    required
                  />
                </div>
                <div className="amtrak-form__group">
                  <label htmlFor="amtrak-destination">Destination station or region</label>
                  <input
                    id="amtrak-destination"
                    type="text"
                    value={formData.destination}
                    onChange={(e) => handleChange('destination', e.target.value)}
                    placeholder="e.g. Washington, DC"
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

      <section className="amtrak-section">
        <div className="container">
          <h2 className="amtrak-section__title">How Consulting Works</h2>
          <ol className="amtrak-steps">
            <li>
              <strong>Consulting inquiry</strong> — Share origin, destination, dates, and urgency.
            </li>
            <li>
              <strong>Logistics strategy</strong> — We evaluate routes, classes, and connection risk.
            </li>
            <li>
              <strong>Advisory delivery</strong> — You receive a structured plan and fulfillment
              coordination through authorized third-party providers.
            </li>
          </ol>
          <p className="amtrak-disclaimer">
            The Final Seat LLC is an independent logistics consultancy and does not issue tickets
            directly. Rail transport is fulfilled subject to carrier and third-party provider terms.
          </p>
        </div>
      </section>

            <CustomerReviews reviews={railReviews} variant="rail" />
    </div>
  );
}

export default AmtrakAssistance;
