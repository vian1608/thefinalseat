import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>The Final Seat</h3>
            <p>Your trusted partner for emergency and urgent travel needs.</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/terms">Terms & Conditions</Link></li>
              <li><Link to="/contact">Contact Information</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Support</h4>
            <ul>
              <li><Link to="/signin">Sign In</Link></li>
              <li><Link to="/signup">Sign Up</Link></li>
              <li><a href="mailto:support@thefinalseat.com">support@thefinalseat.com</a></li>
              <li><a href="tel:+18083015460">+1 808 301 5460</a></li>
              <li>5830 E 2nd St, Ste 7000 #34290, Casper, Wyoming 82609 US</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 The Final Seat. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
