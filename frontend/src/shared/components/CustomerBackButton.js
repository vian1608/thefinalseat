import React from 'react';
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

  if (pathname === '/' || pathname.startsWith('/admin')) return null;

  const handleBack = () => {
    const browserHasAppHistory = Number(window.history.state?.idx || 0) > 0;
    if (browserHasAppHistory) {
      navigate(-1);
      return;
    }
    navigate(fallbackFor(pathname));
  };

  return (
    <div className="tfs-customer-back-wrap" aria-label="Page navigation">
      <button type="button" className="tfs-customer-back" onClick={handleBack}>
        <i className="fas fa-arrow-left" aria-hidden="true" />
        <span>Back</span>
      </button>
    </div>
  );
}
