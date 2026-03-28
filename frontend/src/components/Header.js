import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`header ${scrolled ? 'header--scrolled' : ''}`}>
      <div className="container header-inner">
        <div className="logo">
          <i className="fas fa-plane-departure" aria-hidden="true" />
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }} onClick={closeMenu}>
            <h1>The Final Seat</h1>
          </Link>
        </div>
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
          <a href="#search" className="nav-link">
            Search Flights
          </a>
          <a href="#emergency" className="nav-link">
            Emergency
          </a>
          <a href="#contact" className="nav-link">
            Contact
          </a>
          <div className="auth-links">
            <Link to="/signin" className="nav-link auth-link">
              Sign In
            </Link>
            <Link to="/signup" className="nav-link auth-link signup-link">
              Sign Up
            </Link>
            <Link
              to="/admin/login"
              className="nav-link auth-link admin-link"
              style={{ color: '#ffc107', fontWeight: 600 }}
            >
              <i className="fas fa-shield-alt" aria-hidden="true" /> Admin
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
