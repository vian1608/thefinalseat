import React from 'react';
import './SeamlessAdvisorySection.css';

const CONTENT = {
  rail: {
    title: 'Seamless Direct Rail Advisory',
    subtitle:
      'Our passenger support model delivers ticket clarity and stress-free logistics in three easy steps.',
    steps: [
      {
        title: 'Specify Route',
        text: 'Enter your departure station, arrival station, and travel dates in the inquiry form above.',
      },
      {
        title: 'Call the Desk',
        text: 'Use our hotline to speak directly with a rail logistics advisor for Amtrak and national rail options.',
      },
      {
        title: 'Travel with Advisory',
        text: 'Receive coordinated options by email and 24/7 disruption guidance through your day of travel.',
      },
    ],
  },
  flight: {
    title: 'Seamless Direct Flight Advisory',
    subtitle:
      'Our passenger support model delivers itinerary clarity and stress-free air logistics in three easy steps.',
    steps: [
      {
        title: 'Specify Itinerary',
        text: 'Enter your origin, destination, travel dates, and cabin preferences in the inquiry form above.',
      },
      {
        title: 'Call the Desk',
        text: 'Use our hotline to speak directly with a flight logistics advisor for domestic and international routing.',
      },
      {
        title: 'Travel with Advisory',
        text: 'Receive coordinated options by email and 24/7 disruption guidance through your day of travel.',
      },
    ],
  },
};

function SeamlessAdvisorySection({ variant = 'rail' }) {
  const { title, subtitle, steps } = CONTENT[variant] || CONTENT.rail;

  return (
    <section className={`seamless-advisory seamless-advisory--${variant}`}>
      <div className="container">
        <div className="seamless-advisory__heading">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="seamless-advisory__steps">
          {steps.map((step, index) => (
            <div className="seamless-advisory__step" key={step.title}>
              <div className="seamless-advisory__number">{index + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SeamlessAdvisorySection;
