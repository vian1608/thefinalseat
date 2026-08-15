import React from 'react';
import { Helmet } from 'react-helmet-async';
import HeroSlider from '../../../shared/components/HeroSlider';
import SeamlessAdvisorySection from '../../../shared/components/SeamlessAdvisorySection';
import { SUPPORT_PHONE_HREF, SUPPORT_PHONE_DISPLAY } from '../../../shared/constants/supportContact';
import './CarRentalsHomePage.css';

const carHeroSlides = [
  {
    id: 'car-slide-1',
    title: 'Compare & Reserve Car Rentals Worldwide',
    subtitle: 'Get personal help finding rental cars, airport pickup options, and clear rental policies.',
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80',
    ctaText: `Call ${SUPPORT_PHONE_DISPLAY}`,
    ctaLink: SUPPORT_PHONE_HREF
  },
  {
    id: 'car-slide-2',
    title: 'Airport Car Hire With Fast Pickup',
    titleHighlight: 'Car Hire',
    subtitle: 'Call our travel team for help finding airport and local rental car options.',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1600&q=80',
    ctaText: `Call ${SUPPORT_PHONE_DISPLAY}`,
    ctaLink: SUPPORT_PHONE_HREF
  }
];

const carHeroOfferTag = {
  badge: 'SUPPORT',
  title: 'Car Rental Assistance',
  text: `Call ${SUPPORT_PHONE_DISPLAY} for help`
};

const POPULAR_AIRPORTS = [
  { code: 'JFK', name: 'New York (JFK)', location: 'John F. Kennedy International Airport', city: 'New York, NY' },
  { code: 'MIA', name: 'Miami (MIA)', location: 'Miami International Airport', city: 'Miami, FL' },
  { code: 'LAX', name: 'Los Angeles (LAX)', location: 'Los Angeles International Airport', city: 'Los Angeles, CA' },
  { code: 'ORD', name: 'Chicago (ORD)', location: "O'Hare International Airport", city: 'Chicago, IL' },
  { code: 'MCO', name: 'Orlando (MCO)', location: 'Orlando International Airport', city: 'Orlando, FL' },
  { code: 'SFO', name: 'San Francisco (SFO)', location: 'San Francisco International Airport', city: 'San Francisco, CA' }
];

function CarRentalsHomePage() {
  return (
    <div className="car-rentals-home-page">
      <Helmet>
        <title>Car Rentals &amp; Airport Car Hire | The Final Seat</title>
        <meta name="description" content="Get personal assistance comparing car rental options, suppliers, pickup locations and policies through The Final Seat." />
        <meta property="og:title" content="Car Rentals & Airport Car Hire | The Final Seat" />
        <meta property="og:description" content="Call The Final Seat for help comparing rental car options, pickup locations, pricing and policies." />
        <meta property="og:url" content="https://www.thefinalseat.com/car-rentals" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://www.thefinalseat.com/car-rentals" />
      </Helmet>

      <HeroSlider slides={carHeroSlides} variant="flights" serviceNavActive="cars" offerTag={carHeroOfferTag} />

      <section className="car-call-section" aria-label="Car rental phone assistance">
        <div className="container">
          <div className="car-call-card">
            <div className="car-call-icon" aria-hidden="true">
              <i className="fas fa-phone-alt" />
            </div>
            <div className="car-call-copy">
              <span className="car-call-eyebrow">Car Rental Assistance</span>
              <h1>Need a Rental Car?</h1>
              <p>Call us for help comparing airport and local rental car options, pickup details, pricing and rental policies.</p>
            </div>
            <a className="car-call-button" href={SUPPORT_PHONE_HREF}>
              <i className="fas fa-phone-alt" aria-hidden="true" />
              <span>Call Now</span>
              <strong>{SUPPORT_PHONE_DISPLAY}</strong>
            </a>
          </div>
        </div>
      </section>

      <section className="popular-airports-section">
        <div className="container">
          <h2 className="section-title">Popular Airport Car Rental Destinations</h2>
          <p className="section-subtitle">Call us for help finding rental options at major airports and nearby locations.</p>

          <div className="popular-airports-grid">
            {POPULAR_AIRPORTS.map((airport) => (
              <div key={airport.code} className="airport-card">
                <div className="airport-card-header">
                  <i className="fas fa-plane-arrival" />
                  <span className="airport-code">{airport.code}</span>
                </div>
                <h3>{airport.name}</h3>
                <p className="airport-sub">{airport.location}</p>
                <a href={SUPPORT_PHONE_HREF} className="airport-search-link">
                  Call for cars in {airport.city} <i className="fas fa-phone-alt" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="car-features-section">
        <div className="container">
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-search-dollar" /></div>
              <h3>Compare Pricing</h3>
              <p>Call us to review rental pricing, possible fees, deposits and pickup details before you reserve.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-file-contract" /></div>
              <h3>Clear Rental Policies</h3>
              <p>Get help understanding cancellation rules, mileage allowances, fuel policies and rental requirements.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-headset" /></div>
              <h3>Human Support</h3>
              <p>Questions about your trip? Call <a href={SUPPORT_PHONE_HREF}>{SUPPORT_PHONE_DISPLAY}</a> for assistance.</p>
            </div>
          </div>
        </div>
      </section>

      <SeamlessAdvisorySection variant="flight" />
    </div>
  );
}

export default CarRentalsHomePage;
