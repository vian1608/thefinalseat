import React, { useState } from 'react';
import HeroSlider from '../components/HeroSlider';
import CustomerReviews from '../components/CustomerReviews';
import { flightReviews } from '../data/customerReviews';
import { flightHeroSlides } from '../data/heroSlides';
import './Home.css';

function Home() {
  const [formData, setFormData] = useState({
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
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const body = [
      `Name: ${formData.name}`,
      `Email: ${formData.email}`,
      `Phone: ${formData.phone || 'Not provided'}`,
      `Origin: ${formData.origin}`,
      `Destination: ${formData.destination}`,
      `Trip type: ${formData.tripType}`,
      `Departure date: ${formData.travelDate || 'Flexible'}`,
      formData.tripType === 'roundtrip'
        ? `Return date: ${formData.returnDate || 'Flexible'}`
        : null,
      `Passengers: ${formData.passengers}`,
      `Preferred cabin: ${formData.cabinClass}`,
      '',
      'Advisory notes:',
      formData.notes || 'None',
    ]
      .filter(Boolean)
      .join('\n');

    const subject = encodeURIComponent('Air Logistics Advisory — Consulting Inquiry');
    const mailBody = encodeURIComponent(body);
    window.location.href = `mailto:support@thefinalseat.com?subject=${subject}&body=${mailBody}`;
  };

  return (
    <div className="flights-page">
      <HeroSlider
        slides={flightHeroSlides}
        variant="flights"
        serviceNavActive="flights"
        inquiryHref="#inquiry"
      />

      <section className="flights-section">
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

      <section className="flights-section flights-section--muted">
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
                  <label htmlFor="flight-origin">Origin city or airport</label>
                  <input
                    id="flight-origin"
                    type="text"
                    value={formData.origin}
                    onChange={(e) => handleChange('origin', e.target.value)}
                    placeholder="e.g. Los Angeles (LAX)"
                    required
                  />
                </div>
                <div className="flights-form__group">
                  <label htmlFor="flight-destination">Destination city or airport</label>
                  <input
                    id="flight-destination"
                    type="text"
                    value={formData.destination}
                    onChange={(e) => handleChange('destination', e.target.value)}
                    placeholder="e.g. New York (JFK)"
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
              <button type="submit" className="flights-btn flights-btn--cta flights-btn--full">
                Submit Consulting Inquiry
              </button>
            </form>
          </div>
        </div>
      </section>

      <CustomerReviews reviews={flightReviews} variant="flights" />
    </div>
  );
}

export default Home;
