import React from 'react';
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
              <li><a href="#search">Search Flights</a></li>
              <li><a href="#emergency">Emergency Services</a></li>
              <li><a href="#contact">Contact Us</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Support</h4>
            <ul>
              <li><a href="/signin">Sign In</a></li>
              <li><a href="/signup">Sign Up</a></li>
              <li><a href="tel:+1-800-URGENT">24/7 Hotline</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 The Final Seat. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
