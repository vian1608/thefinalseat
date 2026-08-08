import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../constants/supportContact';
import '../styles/InfoPages.css';

function ContactInfo() {
  return (
    <div className="info-page">
      <Helmet>
        <title>Contact The Final Seat | Travel Assistance</title>
        <meta name="description" content="Contact The Final Seat LLC for flight search help, reservation assistance, itinerary support, billing questions, and travel inquiries." />
        <meta property="og:title" content="Contact The Final Seat | Travel Assistance" />
        <meta property="og:description" content="Contact The Final Seat LLC for flight search help, reservation assistance, itinerary support, billing questions, and travel inquiries." />
        <meta property="og:url" content="https://www.thefinalseat.com/contact" />
        <link rel="canonical" href="https://www.thefinalseat.com/contact" />
      </Helmet>
      <div className="container">
        <div className="info-card">
          <h1>Contact Information</h1>
          <p className="info-intro">
            Reach The Final Seat LLC for flight search inquiries, travel assistance, and urgent itinerary support.
          </p>

          <div className="contact-grid">
            <div className="contact-item">
              <h2>Business Name</h2>
              <p>The Final Seat LLC</p>
            </div>

            <div className="contact-item">
              <h2>Email</h2>
              <p><a href="mailto:support@thefinalseat.com">support@thefinalseat.com</a></p>
            </div>

            <div className="contact-item">
              <h2>Phone</h2>
              <p><a href={SUPPORT_PHONE_HREF}>{SUPPORT_PHONE_DISPLAY}</a></p>
            </div>

            <div className="contact-item">
              <h2>Business Address</h2>
              <p>5830 E 2nd St, Ste 7000 #34290, Casper, Wyoming 82609 US</p>
            </div>

            <div className="contact-item">
              <h2>Secure Payment</h2>
              <p><Link to="/payment">Pay consulting service fees online</Link></p>
            </div>

            <div className="contact-item">
              <h2>Working Hours</h2>
              <p>24/7 Emergency Support | Standard Desk: Mon-Sat, 9:00 AM - 7:00 PM (MT)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactInfo;
