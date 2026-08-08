import React from 'react';
import { Helmet } from 'react-helmet-async';
import CarSearchForm from '../components/CarSearchForm';
import HeroSlider from '../../../shared/components/HeroSlider';
import SeamlessAdvisorySection from '../../../shared/components/SeamlessAdvisorySection';
import { SUPPORT_PHONE_HREF, SUPPORT_PHONE_DISPLAY } from '../../../shared/constants/supportContact';
import './CarRentalsHomePage.css';

const carHeroSlides = [
  {
    id: 'car-slide-1',
    title: 'Compare & Reserve Car Rentals Worldwide',
    subtitle: 'Search top suppliers, airport locations, and transparent rental policies with zero hidden fees.',
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80',
    ctaText: 'Search Rental Cars',
    ctaLink: '#car-search-section'
  },
  {
    id: 'car-slide-2',
    title: 'Airport Car Hire With Fast Pickup',
    titleHighlight: 'Car Hire',
    subtitle: 'Find in-terminal counters and free shuttle depots at major international airports.',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1600&q=80',
    ctaText: 'Find Airport Cars',
    ctaLink: '#car-search-section'
  }
];

const carHeroOfferTag = {
  badge: 'POPULAR',
  title: 'Top Car Rental Deals',
  text: 'Save on weekly rates & airport pickups'
};

const POPULAR_AIRPORTS = [
  { code: 'JFK', name: 'New York (JFK)', location: 'John F. Kennedy International Airport', city: 'New York, NY' },
  { code: 'MIA', name: 'Miami (MIA)', location: 'Miami International Airport', city: 'Miami, FL' },
  { code: 'LAX', name: 'Los Angeles (LAX)', location: 'Los Angeles International Airport', city: 'Los Angeles, CA' },
  { code: 'ORD', name: 'Chicago (ORD)', location: "O'Hare International Airport", city: 'Chicago, IL' },
  { code: 'MCO', name: 'Orlando (MCO)', location: 'Orlando International Airport', city: 'Orlando, FL' },
  { code: 'SFO', name: 'San Francisco (SFO)', location: 'San Francisco International Airport', city: 'San Francisco, CA' }
];

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function popularAirportHref(code) {
  const params = new URLSearchParams({
    pickup: code,
    dropoff: code,
    pickupDate: futureDate(7),
    pickupTime: '10:00:00',
    dropoffDate: futureDate(12),
    dropoffTime: '10:00:00',
    driverAge: '30',
    driverCountry: 'us',
    currency: 'USD'
  });
  return `/car-rentals/results?${params.toString()}`;
}

function CarRentalsHomePage() {
  return (
    <div className="car-rentals-home-page">
      <Helmet>
        <title>Car Rentals &amp; Airport Car Hire | The Final Seat</title>
        <meta name="description" content="Compare car rental options, suppliers, pickup locations and policies through The Final Seat." />
        <meta property="og:title" content="Car Rentals & Airport Car Hire | The Final Seat" />
        <meta property="og:description" content="Compare car rental options, suppliers, pickup locations and policies through The Final Seat." />
        <meta property="og:url" content="https://www.thefinalseat.com/car-rentals" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://www.thefinalseat.com/car-rentals" />
      </Helmet>

      <HeroSlider slides={carHeroSlides} variant="flights" serviceNavActive="cars" offerTag={carHeroOfferTag} />

      <section id="car-search-section" className="car-search-hero-section">
        <div className="container">
          <div className="car-search-container-box">
            <h1 className="car-search-heading">Find &amp; Compare Rental Cars</h1>
            <p className="car-search-subheading">Search real-time inventory from top rental suppliers with full pricing and policy transparency.</p>
            <CarSearchForm />
          </div>
        </div>
      </section>

      <section className="popular-airports-section">
        <div className="container">
          <h2 className="section-title">Popular Airport Car Rental Destinations</h2>
          <p className="section-subtitle">Convenient pickup counters located directly in airport terminals or via fast shuttles.</p>

          <div className="popular-airports-grid">
            {POPULAR_AIRPORTS.map((airport) => (
              <div key={airport.code} className="airport-card">
                <div className="airport-card-header">
                  <i className="fas fa-plane-arrival" />
                  <span className="airport-code">{airport.code}</span>
                </div>
                <h3>{airport.name}</h3>
                <p className="airport-sub">{airport.location}</p>
                <a href={popularAirportHref(airport.code)} className="airport-search-link">
                  Search Cars in {airport.city} <i className="fas fa-arrow-right" />
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
              <h3>Transparent Pricing</h3>
              <p>Itemized breakdowns showing total rental prices, young driver fees, and deposit requirements up front.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-file-contract" /></div>
              <h3>Clear Rental Policies</h3>
              <p>Free cancellation rules, mileage allowances, and fuel policies clearly displayed before you continue.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="fas fa-headset" /></div>
              <h3>Human Support</h3>
              <p>Questions about your trip? Call <a href={SUPPORT_PHONE_HREF}>{SUPPORT_PHONE_DISPLAY}</a> for travel assistance.</p>
            </div>
          </div>
        </div>
      </section>

      <SeamlessAdvisorySection
        title="Need Assistance Choosing the Right Rental Vehicle?"
        subtitle="Our travel specialists can help review airport pickups, child-seat needs, and travel logistics."
        primaryActionText={`Call Support ${SUPPORT_PHONE_DISPLAY}`}
        primaryActionHref={SUPPORT_PHONE_HREF}
      />
    </div>
  );
}

export default CarRentalsHomePage;
