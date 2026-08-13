import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import './CustomerBackButton.css';

const FALLBACK_BY_PATH = [
  [/^\/return-flight/, '/search'],
  [/^\/booking(?:\/|$)/, '/search'],
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
  const isBookingPage = /^\/booking(?:\/|$)/.test(pathname);
  const [bookingTarget, setBookingTarget] = useState(null);

  useEffect(() => {
    if (!isBookingPage) {
      setBookingTarget(null);
      return undefined;
    }

    let ownedSlot = null;

    const locateTarget = () => {
      const panel = document.querySelector('.booking-itinerary-top-panel__inner');
      if (!panel) {
        setBookingTarget(null);
        return;
      }

      let slot = panel.querySelector(':scope > .tfs-booking-back-slot');
      if (!slot) {
        slot = document.createElement('div');
        slot.className = 'tfs-booking-back-slot';
        slot.setAttribute('data-tfs-booking-back-slot', 'true');

        const itineraryTitle = panel.querySelector(':scope > .booking-itinerary-top-panel__title');
        panel.insertBefore(slot, itineraryTitle || panel.firstChild);
        ownedSlot = slot;
      }

      setBookingTarget(slot);
    };

    locateTarget();
    const observer = new MutationObserver(locateTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (ownedSlot?.isConnected) ownedSlot.remove();
    };
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
