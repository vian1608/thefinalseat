import React from 'react';
import { Helmet } from 'react-helmet-async';
import LandingCtaSection from '../../../shared/components/LandingCtaSection';
import './UrgentTravelPage.css';

function UrgentTravelPage() {
  return (
    <div className="urgent-travel-page">
      <Helmet>
        <title>Urgent Travel & Last-Minute Flight Support | The Final Seat</title>
        <meta
          name="description"
          content="Fast, reliable flight booking support when timing matters. Save up to 20% on eligible urgent travel reservations within 3 days with real human assistance."
        />
        <meta
          name="keywords"
          content="urgent flights, last minute flight booking, urgent travel assistance, emergency flight support"
        />
      </Helmet>

      {/* Hero Section */}
      <section className="ut-hero">
        <div className="container">
          <div className="ut-hero__content">
            <span className="ut-eyebrow">The Final Seat — Urgent Flight Support</span>
            <h1>Need A Flight Within The Next Few Days?</h1>
            <p className="ut-lead">
              We help travelers compare real-time route availability, baggage rules, and schedules when timing is critical. Save up to 20% on eligible urgent travel reservations within 3 days.
            </p>
            <LandingCtaSection
              primaryText="Request Urgent Travel Help"
              primaryHref="/#inquiry"
              variant="hero"
            />
          </div>
        </div>
      </section>

      {/* Offer Banner */}
      <div className="ut-offer-banner">
        <div className="container">
          <div className="ut-offer-box">
            <span className="ut-offer-badge">Limited Offer</span>
            <h3>Save Up To 20% On Travel Within 3 Days</h3>
            <p>Applied to eligible time-sensitive itineraries. Speak with our travel specialists to verify instant availability.</p>
          </div>
        </div>
      </div>

      {/* Key Services */}
      <section className="ut-section">
        <div className="container">
          <div className="ut-section__header">
            <h2>Why Use Our Urgent Travel Service</h2>
            <p>Fast responses, clear flight options, and direct human coordination.</p>
          </div>

          <div className="ut-grid ut-grid--3">
            <div className="ut-card">
              <div className="ut-card__icon"><i className="fas fa-tachometer-alt"></i></div>
              <h3>Fast Assistance</h3>
              <p>Immediate phone and online support when you need to secure a seat without long holds.</p>
            </div>
            <div className="ut-card">
              <div className="ut-card__icon"><i className="fas fa-layer-group"></i></div>
              <h3>Compare Available Options</h3>
              <p>Real-time review of domestic and international carrier schedules, layovers, and cabin classes.</p>
            </div>
            <div className="ut-card">
              <div className="ut-card__icon"><i className="fas fa-user-check"></i></div>
              <h3>Human Support</h3>
              <p>Direct contact with dedicated travel specialists who verify itinerary rules before reservation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="ut-cta-box">
        <div className="container">
          <LandingCtaSection
            title="Need Immediate Flight Assistance?"
            description="Our urgent travel desk is open 24/7. Call or request online assistance now."
            primaryText="Request Urgent Travel Help"
            primaryHref="/#inquiry"
            variant="footer"
          />
        </div>
      </section>
    </div>
  );
}

export default UrgentTravelPage;
