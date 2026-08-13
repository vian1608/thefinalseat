import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../constants/supportContact';
import './Footer.css';

function FooterSection({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`footer-section footer-section--collapsible${open ? ' footer-section--open' : ''}`}>
      <button
        className="footer-section__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} aria-hidden="true" />
      </button>
      <div className="footer-section__body">{children}</div>
    </div>
  );
}

function Footer() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <footer className={`footer${isAdminRoute ? ' footer--admin' : ''}`}>
      <div className="container">
        <div className="footer-content">
          {/* Brand — always visible */}
          <div className="footer-section footer-brand">
            <h3>The Final Seat LLC</h3>
            <p>The Final Seat provides flight-search and reservation assistance for travelers who value clear information and real human support.</p>
          </div>

          {/* Collapsible on mobile */}
          <FooterSection title="Company">
            <ul>
              <li><Link to="/">Flights</Link></li>
              <li><Link to="/car-rentals">Car Rentals</Link></li>
              <li><Link to="/my-bookings">My Bookings</Link></li>
              <li><Link to="/contact">Contact Information</Link></li>
            </ul>
          </FooterSection>

          <FooterSection title="Legal">
            <ul>
              <li><Link to="/terms">Terms &amp; Conditions</Link></li>
              <li><Link to="/privacy-policy">Privacy Policy</Link></li>
              <li><Link to="/refund-policy">Refund Policy</Link></li>
            </ul>
          </FooterSection>

          <FooterSection title="Contact">
            <ul>
              <li><a href="mailto:support@thefinalseat.com">support@thefinalseat.com</a></li>
              <li><a href={SUPPORT_PHONE_HREF}>{SUPPORT_PHONE_DISPLAY}</a></li>
              <li>5830 E 2nd St, Ste 7000, Casper, WY 82609</li>
            </ul>
          </FooterSection>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 The Final Seat LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
