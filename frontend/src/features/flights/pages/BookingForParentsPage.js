import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../../../shared/constants/supportContact';
import './BookingForParentsPage.css';

function BookingForParentsPage() {
  return (
    <div className="booking-for-parents-page">
      <Helmet>
        <title>Helping You Book Flights For Your Parents | The Final Seat</title>
        <meta
          name="description"
          content="Simple, trustworthy flight booking support when arranging travel for parents, elderly relatives, or family members. Real human assistance with routes, baggage, and layovers."
        />
        <meta
          name="keywords"
          content="book flights for parents, elderly travel assistance, family flight booking, travel assistance for seniors"
        />
      </Helmet>

      {/* Hero Section */}
      <section className="bfp-hero">
        <div className="container">
          <div className="bfp-hero__content">
            <span className="bfp-eyebrow">The Final Seat — Family Booking Assistance</span>
            <h1>Helping You Book Flights For Your Parents</h1>
            <p className="bfp-lead">
              We make it easy to arrange safe, comfortable, and manageable flight itineraries for your parents or older family members, supported by real travel specialists.
            </p>
            <div className="bfp-hero__actions">
              <Link to="/#inquiry" className="flights-btn flights-btn--primary">
                <i className="fas fa-search" aria-hidden="true"></i> Find Flight Options
              </Link>
              <a href={SUPPORT_PHONE_HREF} className="flights-btn flights-btn--outline">
                <i className="fas fa-headset" aria-hidden="true"></i> Talk to a Travel Specialist
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Core Benefits */}
      <section className="bfp-section bfp-section--light">
        <div className="container">
          <div className="bfp-section__header">
            <h2>Why Families Trust Us With Parent Reservations</h2>
            <p>Thoughtful flight coordination designed for peace of mind.</p>
          </div>

          <div className="bfp-grid bfp-grid--4">
            <div className="bfp-card">
              <div className="bfp-card__icon"><i className="fas fa-smile"></i></div>
              <h3>Easy Booking Process</h3>
              <p>Simple flight selection without requiring parents to navigate confusing online forms or complex airline apps.</p>
            </div>
            <div className="bfp-card">
              <div className="bfp-card__icon"><i className="fas fa-info-circle"></i></div>
              <h3>Help Understanding Options</h3>
              <p>Clear explanations of connection times, baggage rules, seat legroom, and flight schedule convenience.</p>
            </div>
            <div className="bfp-card">
              <div className="bfp-card__icon"><i className="fas fa-route"></i></div>
              <h3>Support with Complex Routes</h3>
              <p>Special care evaluating layovers and transfers to ensure connections are stress-free and manageable.</p>
            </div>
            <div className="bfp-card">
              <div className="bfp-card__icon"><i className="fas fa-wheelchair"></i></div>
              <h3>Assistance for Older Travelers</h3>
              <p>Help adding wheelchair assistance, special meal requests, and daytime departure preferences.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works for Family Members */}
      <section className="bfp-section">
        <div className="container">
          <div className="bfp-section__header">
            <h2>How Booking For Someone Else Works</h2>
            <p>Keep your family updated every step of the way.</p>
          </div>

          <div className="bfp-steps">
            <div className="bfp-step">
              <div className="bfp-step__num">1</div>
              <h3>Select Traveling Passengers</h3>
              <p>Enter your parents or relatives as the primary passengers on the ticket.</p>
            </div>
            <div className="bfp-step">
              <div className="bfp-step__num">2</div>
              <h3>Add Your Assisting Contact</h3>
              <p>Include your email and phone number to receive confirmation notices and status updates.</p>
            </div>
            <div className="bfp-step">
              <div className="bfp-step__num">3</div>
              <h3>Review & Confirm</h3>
              <p>Our travel specialists review connection times and flight details before issuing final tickets.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bfp-cta-box">
        <div className="container">
          <div className="bfp-cta-content">
            <h2>Need Help Arranging Travel For A Parent?</h2>
            <p>Our travel specialists are ready to assist with schedule comparison and ticket reservation.</p>
            <div className="bfp-cta-buttons">
              <Link to="/#inquiry" className="flights-btn flights-btn--primary">
                Find Flight Options
              </Link>
              <a href={SUPPORT_PHONE_HREF} className="call-btn flights-btn flights-btn--cta">
                <i className="fas fa-phone"></i> Call {SUPPORT_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BookingForParentsPage;
