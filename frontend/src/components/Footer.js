import React from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../constants/supportContact';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section footer-brand">
            <h3>The Final Seat LLC</h3>
            <p>Your trusted partner for urgent travel advisory and support.</p>
          </div>
          <div className="footer-section">
            <h4>Company</h4>
            <ul>
              <li><Link to="/">Flights</Link></li>
              <li><Link to="/amtrak">Amtrak Assistance</Link></li>
              <li><Link to="/my-bookings">My Bookings</Link></li>
              <li><Link to="/contact">Contact Information</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Legal</h4>
            <ul>
              <li><Link to="/terms">Terms & Conditions</Link></li>
              <li><Link to="/privacy-policy">Privacy Policy</Link></li>
              <li><Link to="/refund-policy">Refund Policy</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Contact</h4>
            <ul>
              <li><a href="mailto:support@thefinalseat.com">support@thefinalseat.com</a></li>
              <li><a href={SUPPORT_PHONE_HREF}>{SUPPORT_PHONE_DISPLAY}</a></li>
              <li>5830 E 2nd St, Ste 7000, Casper, WY 82609</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 The Final Seat LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
