import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import './CustomerBackButton.css';

const FALLBACK_BY_PATH = [
  [/^\/return-flight/, '/search'],
  [/^\/booking$/, '/return-flight'],
  [/^\/payment/, '/booking'],
  [/^\/authorize\//, '/my-bookings'],
  [/^\/confirmation\//, '/my-bookings'],
  [/^\/booking-confirmed/, '/my-bookings'],
  [/^\/car-rentals\/(search|results)/, '/car-rentals'],
  [/^\/signin/, '/'],
  [/^\/signup/, '/signin'],
];

function fallbackFor(pathname) {
  const match = FALLBACK_BY_PATH.find(([pattern]) => pattern.test(pathname));
  return match?.[1] || '/';
}

export default function CustomerBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname || '/';
  const isBookingPage = pathname === '/booking';
  const [bookingTarget, setBookingTarget] = useState(null);

  useEffect(() => {
    if (!isBookingPage) {
      setBookingTarget(null);
      return undefined;
    }

    const locateTarget = () => {
      setBookingTarget(document.querySelector('.booking-itinerary-top-panel__inner'));
    };

    locateTarget();
    const observer = new MutationObserver(locateTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isBookingPage]);

  if (pathname === '/' || pathname.startsWith('/admin')) return null;

  const handleBack = () => {
    const browserHasAppHistory = Number(window.history.state?.idx || 0) > 0;
    if (browserHasAppHistory) {
      navigate(-1);
      return;
    }
    navigate(fallbackFor(pathname));
  };

  const button = (
    <div
      className={`tfs-customer-back-wrap${isBookingPage ? ' tfs-customer-back-wrap--booking' : ''}`}
      aria-label="Page navigation"
    >
      <button type="button" className="tfs-customer-back" onClick={handleBack}>
        <i className="fas fa-arrow-left" aria-hidden="true" />
        <span>Back</span>
      </button>
    </div>
  );

  if (isBookingPage) {
    return bookingTarget ? createPortal(button, bookingTarget) : null;
  }

  return button;
}
