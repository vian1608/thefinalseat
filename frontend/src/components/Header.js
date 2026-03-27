import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="logo">
          <i className="fas fa-plane-departure"></i>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>The Final Seat</h1>
          </Link>
        </div>
        <nav className="nav">
          <a href="#search" className="nav-link">Search Flights</a>
          <a href="#emergency" className="nav-link">Emergency</a>
          <a href="#contact" className="nav-link">Contact</a>
          <div className="auth-links">
            <Link to="/signin" className="nav-link auth-link">Sign In</Link>
            <Link to="/signup" className="nav-link auth-link signup-link">Sign Up</Link>
            <Link to="/admin/login" className="nav-link auth-link admin-link" style={{ color: '#ffc107', fontWeight: 600 }}>
              <i className="fas fa-shield-alt"></i> Admin
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

export default Header;
