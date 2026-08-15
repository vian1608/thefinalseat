import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../constants/supportContact';
import './Header.css';
import './HeaderLayoutOverrides.css';

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onScroll = () => setMenuOpen(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const closeMenu = () => setMenuOpen(false);

  const isFlightsActive = location.pathname === '/';
  const isCarsActive = location.pathname.startsWith('/car-rentals');
  const isContactActive = location.pathname === '/contact';
  const isCarsTheme = isCarsActive;
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <header
      className={`header ${isCarsTheme ? 'header--cars' : 'header--flights'} ${isAdminRoute ? 'header--admin-route' : ''} ${scrolled ? 'header--scrolled' : ''}`}
    >
      <div className="container header-inner">
        <div className="logo">
          <i
            key={isCarsTheme ? 'car-icon' : 'flight-icon'}
            className={`fas logo-icon ${isCarsTheme ? 'fa-car' : 'fa-plane-departure'}`}
            aria-hidden="true"
          />
          <Link to="/" className="logo-link" onClick={closeMenu}>
            <h1>The Final Seat</h1>
          </Link>
        </div>

        {!isAdminRoute && (
          <a
            className="header-mobile-call"
            href={SUPPORT_PHONE_HREF}
            aria-label={`Call The Final Seat at ${SUPPORT_PHONE_DISPLAY}`}
            onClick={closeMenu}
          >
            <i className="fas fa-phone-alt" aria-hidden="true" />
            <span>Call Now</span>
          </a>
        )}

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <i className={menuOpen ? 'fas fa-times' : 'fas fa-bars'} aria-hidden="true" />
        </button>

        <nav
          id="site-nav"
          className={`nav ${menuOpen ? 'nav--open' : ''}`}
          onClick={(e) => {
            if (e.target.closest('a, [href], button')) {
              closeMenu();
            }
          }}
        >
          <div className="nav-main">
            <Link
              to="/"
              className={`header-nav-link ${isFlightsActive ? 'header-nav-link--active' : ''}`}
            >
              Flights
            </Link>
            <Link
              to="/car-rentals"
              className={`header-nav-link ${isCarsActive ? 'header-nav-link--active' : ''}`}
            >
              Car Rentals
            </Link>
            <Link
              to="/my-bookings"
              className={`header-nav-link ${location.pathname === '/my-bookings' ? 'header-nav-link--active' : ''}`}
            >
              My Bookings
            </Link>
            <Link
              to="/contact"
              className={`header-nav-link ${isContactActive ? 'header-nav-link--active' : ''}`}
            >
              Contact Us
            </Link>
          </div>

          <div className="header-auth">
            <Link to="/signin" className="header-nav-link header-auth__signin">
              Sign In
            </Link>
          </div>
        </nav>

        {menuOpen && (
          <button
            type="button"
            className="nav-backdrop"
            aria-label="Close menu"
            onClick={closeMenu}
          />
        )}
      </div>
    </header>
  );
}

export default Header;
