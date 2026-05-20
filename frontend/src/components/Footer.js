import React from 'react';
import { Link } from 'react-router-dom';
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
              <li><Link to="/amtrak-assistance">Amtrak Assistance</Link></li>
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
            <h4>Popular Travel Routes</h4>
            <ul>
              <li><Link to="/train-nyc-to-dc">Train from NYC to Washington, D.C.</Link></li>
              <li><Link to="/train-dc-to-nyc">Train from D.C. to New York City</Link></li>
              <li><Link to="/train-philly-to-nyc">Train from Philadelphia to NYC</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Contact</h4>
            <ul>
              <li><a href="mailto:support@thefinalseat.com">support@thefinalseat.com</a></li>
              <li><a href="tel:+12139659727">+1 213 965 9727</a></li>
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
