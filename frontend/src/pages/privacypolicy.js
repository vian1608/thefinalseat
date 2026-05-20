import React from 'react';
import './InfoPages.css';

const PrivacyPolicy = () => {
  return (
    <section className="info-page">
      <div className="container">
        <article className="info-card">
          <h1>Privacy Policy</h1>
          <p className="info-updated"><strong>Last Updated:</strong> May 6, 2026</p>

          <section>
            <h2>1. Information We Collect</h2>
            <p>
              THE FINAL SEAT LLC respects your privacy. We collect the personal information strictly
              necessary to facilitate your travel arrangements. This includes your contact details,
              passenger details, and itinerary preferences required to process inbound flight reservations.
            </p>
          </section>

          <section>
            <h2>2. How We Use and Share Data</h2>
            <p>
              We use your information solely to fulfill your flight bookings, coordinate with our
              authorized suppliers, and share operational updates related to your travel plan. We
              share necessary passenger details strictly with the respective airlines, consolidators,
              and Global Distribution Systems (GDS) required to issue your tickets. We do not sell
              or trade your data to third-party marketers.
            </p>
          </section>

          <section>
            <h2>3. Payment Security</h2>
            <p>
              Your financial security is our priority. Payment data is processed through secure,
              PCI-DSS compliant payment gateways (such as Authorize.net). We utilize secure
              tokenization and do not store full credit card numbers on our servers at any time.
            </p>
          </section>
          <section>
            <h2>4. Privacy Policy for Mobile Information</h2>
            <p>
              The Final Seat LLC is committed to protecting your privacy. We do not sell, rent, or lease our customer lists to third parties. 
            </p>
            <p>
              No mobile information, phone numbers, or text messaging originator opt-in data will be shared with third parties, affiliates, or partners for marketing, promotional, or lead generation purposes. All other categories of personal data exclude text messaging originator opt-in data and consent; this information will not be shared with or sold to any third parties for any reason whatsoever.
            </p>
          </section>
        </article>
      </div>
    </section>
  );
};

export default PrivacyPolicy;