import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams, Navigate } from 'react-router-dom';
import AirlineLogo from '../components/AirlineLogo';
import { AIRLINE_ACTIONS } from '../config/airlineActionContent';
import { getAirlineFromSlug, getAirlineDisplayName } from '../utils/airlineDisplay';
import { inquiryAPI } from '../services/api';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../constants/supportContact';
import './AirlineActionPage.css';

function AirlineActionPage({ action }) {
  const { airline: airlineSlug } = useParams();
  const config = AIRLINE_ACTIONS[action];
  const airline = getAirlineFromSlug(airlineSlug);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    origin: '',
    destination: '',
    passengers: '1',
    notes: '',
  });
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  if (!config || !airlineSlug) {
    return <Navigate to="/" replace />;
  }

  const airlineName = getAirlineDisplayName(airlineSlug);
  const canonicalUrl = `https://thefinalseat.com/${action}/${airline.slug}`;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus('submitting');
    setSubmitMessage('');

    try {
      const result = await inquiryAPI.submitConsulting(
        {
          ...formData,
          notes: [formData.notes, `${config.breadcrumbRoot} — ${airlineName}`].filter(Boolean).join(' | '),
        },
        config.serviceType
      );
      setSubmitStatus('success');
      setSubmitMessage(
        result.message || 'Thank you. Your inquiry was submitted and our team will contact you shortly.'
      );
      setFormData({
        name: '',
        email: '',
        phone: '',
        origin: '',
        destination: '',
        passengers: '1',
        notes: '',
      });
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage(
        error.response?.data?.error ||
          `Unable to submit right now. Please call ${SUPPORT_PHONE_DISPLAY} for immediate assistance.`
      );
    }
  };

  return (
    <div className={`airline-action-page airline-action-page--${action}`}>
      <Helmet>
        <title>{config.h1(airlineName)} | The Final Seat LLC</title>
        <meta
          name="description"
          content={`${config.subtext} Speak with The Final Seat LLC for ${airlineName} logistics advisory.`}
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <div className="airline-action-container">
        <nav className="airline-action-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">{config.breadcrumbRoot}</Link>
          <span aria-hidden="true">›</span>
          <span>{airlineName} Airlines</span>
          <span aria-hidden="true">›</span>
          <span>{config.breadcrumbDesk}</span>
        </nav>

        <section className="airline-action-hero">
          <div className="airline-action-hero__top">
            <AirlineLogo slug={airline.slug} airlineName={airlineName} className="airline-action-hero__logo" />
            <div className="airline-action-hero__copy">
              <h1>{config.h1(airlineName)}</h1>
              <p className="airline-action-hero__subtext">{config.subtext}</p>
            </div>
          </div>

          <a href={SUPPORT_PHONE_HREF} className="airline-action-call-cta">
            <i className="fas fa-phone-alt" aria-hidden="true" />
            <span>{config.callLabel}</span>
            <strong>{SUPPORT_PHONE_DISPLAY}</strong>
          </a>
        </section>

        <section className="airline-action-form-card">
          <h2>{config.formTitle}</h2>
          <p>{config.formIntro}</p>

          <form className="airline-action-form" onSubmit={handleSubmit}>
            <div className="airline-action-form__row">
              <div className="airline-action-form__group">
                <label htmlFor="aa-name">Full name</label>
                <input
                  id="aa-name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="airline-action-form__group">
                <label htmlFor="aa-email">Email</label>
                <input
                  id="aa-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="airline-action-form__row">
              <div className="airline-action-form__group">
                <label htmlFor="aa-phone">Phone</label>
                <input
                  id="aa-phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="airline-action-form__group">
                <label htmlFor="aa-passengers">Passengers</label>
                <select
                  id="aa-passengers"
                  name="passengers"
                  value={formData.passengers}
                  onChange={handleChange}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5+">5+</option>
                </select>
              </div>
            </div>
            <div className="airline-action-form__row">
              <div className="airline-action-form__group">
                <label htmlFor="aa-origin">Origin</label>
                <input
                  id="aa-origin"
                  name="origin"
                  type="text"
                  value={formData.origin}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="airline-action-form__group">
                <label htmlFor="aa-destination">Destination</label>
                <input
                  id="aa-destination"
                  name="destination"
                  type="text"
                  value={formData.destination}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="airline-action-form__group">
              <label htmlFor="aa-notes">Advisory notes</label>
              <textarea
                id="aa-notes"
                name="notes"
                rows={4}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Confirmation number, travel dates, or urgency details"
              />
            </div>

            {submitMessage && (
              <p
                className={`airline-action-form__message airline-action-form__message--${submitStatus}`}
                role="alert"
              >
                {submitMessage}
              </p>
            )}

            <button
              type="submit"
              className="airline-action-form__submit"
              disabled={submitStatus === 'submitting'}
            >
              {submitStatus === 'submitting' ? 'Submitting…' : 'Request a Quote'}
            </button>
          </form>
        </section>

        <p className="airline-action-disclaimer">
          The Final Seat LLC is an independent logistics consultancy and does not issue tickets
          directly. All airline names and logos are trademarks of their respective owners.
        </p>
      </div>
    </div>
  );
}

export default AirlineActionPage;
