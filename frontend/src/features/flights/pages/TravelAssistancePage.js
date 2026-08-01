import React from 'react';
import { Helmet } from 'react-helmet-async';
import LandingCtaSection from '../../../shared/components/LandingCtaSection';
import './TravelAssistancePage.css';

function TravelAssistancePage() {
  return (
    <div className="travel-assistance-page">
      <Helmet>
        <title>Travel Assistance & Flight Booking Support | The Final Seat</title>
        <meta
          name="description"
          content="Personal flight booking assistance for travelers and families. We help compare routes, connections, baggage allowance and journey time with real human support."
        />
      </Helmet>

      {/* Hero Section */}
      <section className="ta-hero">
        <div className="container">
          <div className="ta-hero__content">
            <span className="ta-eyebrow">The Final Seat — Travel Assistance</span>
            <h1>Need Help Booking Your Flight?</h1>
            <p className="ta-lead">
              We help you compare routes, connections, baggage and total travel time, with real human support throughout the reservation process.
            </p>
            <LandingCtaSection
              primaryText="Get Travel Assistance"
              primaryHref="/#inquiry"
              variant="hero"
            />
          </div>
        </div>
      </section>

      {/* Who The Service Is For */}
      <section className="ta-section ta-section--light">
        <div className="container">
          <div className="ta-section__header">
            <h2>Who This Service Is For</h2>
            <p>Thoughtful flight booking support designed for clarity and peace of mind.</p>
          </div>
          <div className="ta-grid ta-grid--4">
            <div className="ta-card">
              <div className="ta-card__icon"><i className="fas fa-user-friends"></i></div>
              <h3>Independent Travelers</h3>
              <p>Passengers who prefer personal booking support over navigating complicated automated booking engines.</p>
            </div>
            <div className="ta-card">
              <div className="ta-card__icon"><i className="fas fa-heart"></i></div>
              <h3>Family Organizers</h3>
              <p>Adult children and relatives booking flights on behalf of parents, grandparents, or loved ones.</p>
            </div>
            <div className="ta-card">
              <div className="ta-card__icon"><i className="fas fa-route"></i></div>
              <h3>Multi-Stop Journeys</h3>
              <p>Travelers comparing complex routes, multiple connection points, or long-distance international flights.</p>
            </div>
            <div className="ta-card">
              <div className="ta-card__icon"><i className="fas fa-hands-helping"></i></div>
              <h3>Assisted Travel Needs</h3>
              <p>Passengers requiring wheelchair requests, preferred seat selection, or clear baggage explanations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* What Assistance Is Available */}
      <section className="ta-section">
        <div className="container">
          <div className="ta-section__header">
            <h2>What Assistance Is Available</h2>
            <p>We guide you through every step of evaluating and completing your flight reservation.</p>
          </div>
          <div className="ta-grid ta-grid--3">
            <div className="ta-feature">
              <i className="fas fa-clock ta-feature__icon"></i>
              <div>
                <h3>Connection & Layover Review</h3>
                <p>We check connection times to ensure layovers are comfortable and manageable for transfers.</p>
              </div>
            </div>
            <div className="ta-feature">
              <i className="fas fa-suitcase ta-feature__icon"></i>
              <div>
                <h3>Baggage Rules & Allowances</h3>
                <p>Clear explanations of carry-on limits, checked bag fees, and airline baggage policies.</p>
              </div>
            </div>
            <div className="ta-feature">
              <i className="fas fa-map-marked-alt ta-feature__icon"></i>
              <div>
                <h3>Airport & Terminal Transfers</h3>
                <p>Alerts and guidance when routes require changing terminals or airports between connections.</p>
              </div>
            </div>
            <div className="ta-feature">
              <i className="fas fa-shield-alt ta-feature__icon"></i>
              <div>
                <h3>Fare Rules & Flexibility</h3>
                <p>Plain-language summary of refund policies, change fees, and ticket flexibility conditions.</p>
              </div>
            </div>
            <div className="ta-feature">
              <i className="fas fa-users-cog ta-feature__icon"></i>
              <div>
                <h3>Family Contact Coordination</h3>
                <p>Option to include family member contact details to receive booking updates and itinerary copies.</p>
              </div>
            </div>
            <div className="ta-feature">
              <i className="fas fa-headset ta-feature__icon"></i>
              <div>
                <h3>24/7 Travel Day Support</h3>
                <p>Direct access to our support desk for assistance before, during, and after your flight.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How The Process Works */}
      <section className="ta-section ta-section--dark">
        <div className="container">
          <div className="ta-section__header ta-section__header--light">
            <h2>How The Process Works</h2>
            <p>Simple 3-step reservation support.</p>
          </div>
          <div className="ta-steps">
            <div className="ta-step">
              <div className="ta-step__num">1</div>
              <h3>Share Your Route & Dates</h3>
              <p>Use our flight search form or call our team to share your preferred cities, dates, and travelers.</p>
            </div>
            <div className="ta-step">
              <div className="ta-step__num">2</div>
              <h3>Review Suitable Options</h3>
              <p>Compare flight times, layover durations, baggage policies, and total prices with clear guidance.</p>
            </div>
            <div className="ta-step">
              <div className="ta-step__num">3</div>
              <h3>Complete Reservation</h3>
              <p>Confirm your booking with easy-to-read confirmation details and ongoing support throughout travel.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Urgent Travel Notice & FAQ */}
      <section className="ta-section">
        <div className="container">
          <div className="ta-faq-container">
            <h2>Frequently Asked Questions</h2>
            <div className="ta-faq-item">
              <h4>Can I book a flight for my parent or relative?</h4>
              <p>Yes. You can select "I am booking for a parent, relative or another traveler" during search and enter their details as the primary passenger while adding your contact information for reservation updates.</p>
            </div>
            <div className="ta-faq-item">
              <h4>Is urgent travel assistance available?</h4>
              <p>Yes. For travel within 3 days or immediate departure needs, our phone desk is available 24/7 with special offers of up to 20% off eligible itineraries.</p>
            </div>
            <div className="ta-faq-item">
              <h4>Will I speak to a real person?</h4>
              <p>Always. The Final Seat combines online search with direct phone and email support from real reservation specialists.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="ta-cta-box">
        <div className="container">
          <LandingCtaSection
            title="Ready to Find Your Flight?"
            description="Speak with a real person or start your flight search online today."
            primaryText="Get Travel Assistance"
            primaryHref="/#inquiry"
            variant="footer"
          />
        </div>
      </section>
    </div>
  );
}

export default TravelAssistancePage;
