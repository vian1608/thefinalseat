import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './CustomerRouteLoadingOverlay.css';

const MIN_VISIBLE_MS = 520;

function transitionCopy(pathname) {
  if (pathname === '/return-flight') {
    return { icon: 'fa-plane-arrival', title: 'Preparing return flight options', detail: 'Keeping your selected departure flight and loading the return step.' };
  }
  if (pathname === '/booking') {
    return { icon: 'fa-passport', title: 'Preparing traveler details', detail: 'Loading your selected itinerary and reservation form.' };
  }
  if (pathname === '/payment' || pathname === '/pay') {
    return { icon: 'fa-lock', title: 'Preparing secure checkout', detail: 'Opening the payment step securely.' };
  }
  if (pathname === '/my-bookings') {
    return { icon: 'fa-receipt', title: 'Opening booking lookup', detail: 'Preparing your reservation lookup tools.' };
  }
  if (pathname.startsWith('/authorize/')) {
    return { icon: 'fa-shield-alt', title: 'Opening secure authorization', detail: 'Loading the reservation details you need to review.' };
  }
  if (pathname.startsWith('/booking-confirmed') || pathname === '/confirmation/success') {
    return { icon: 'fa-check-circle', title: 'Loading reservation confirmation', detail: 'Retrieving the latest saved booking details.' };
  }
  if (pathname === '/confirmation/one-way' || pathname === '/confirmation/round-trip') {
    return { icon: 'fa-file-alt', title: 'Preparing reservation summary', detail: 'Loading your trip summary.' };
  }
  if (pathname === '/car-rentals/search' || pathname === '/car-rentals/results') {
    return { icon: 'fa-car', title: 'Loading rental car options', detail: 'Preparing available vehicles and rates.' };
  }
  return null;
}

export default function CustomerRouteLoadingOverlay() {
  const location = useLocation();
  const copy = useMemo(() => transitionCopy(location.pathname || '/'), [location.pathname]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!copy) {
      setVisible(false);
      return undefined;
    }

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), MIN_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [location.key, location.pathname, copy]);

  if (!copy || !visible) return null;

  return (
    <div className="tfs-route-waiter" role="status" aria-live="polite">
      <div className="tfs-route-waiter__card">
        <div className="tfs-route-waiter__icon"><i className={`fas ${copy.icon}`} /></div>
        <div className="tfs-route-waiter__copy">
          <strong>{copy.title}</strong>
          <span>{copy.detail}</span>
        </div>
        <div className="tfs-route-waiter__dots" aria-hidden="true"><i /><i /><i /></div>
      </div>
    </div>
  );
}
