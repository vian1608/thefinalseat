import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import SupportCallCTA from './SupportCallCTA';

function productThemeForPath(pathname = '/') {
  if (pathname.startsWith('/hotels')) return 'hotels';
  if (pathname.startsWith('/car-rentals')) return 'cars';
  return 'flights';
}

function isTravelJourneyPath(pathname = '/') {
  if (pathname === '/') return true;

  return [
    '/search',
    '/hotels',
    '/car-rentals',
    '/booking',
    '/return-flight',
    '/payment',
    '/authorize',
    '/confirmation',
    '/booking-confirmed',
    '/flight-',
    '/routes/',
    '/book/',
    '/changes/',
    '/cancellation/',
    '/travel-assistance',
    '/booking-for-parents',
    '/urgent-travel',
    '/senior-travel',
  ].some((prefix) => pathname.startsWith(prefix));
}

function portalConfigForPath(pathname = '/') {
  if (pathname === '/') {
    return {
      selector: '#inquiry .flights-inquiry-card',
      theme: 'flights',
      mode: 'card',
      className: 'support-call-cta--flight-search-portal',
    };
  }

  if (pathname === '/search') {
    return {
      selector: '.tfs-results-heading-row',
      theme: 'flights',
      mode: 'inline',
      className: 'support-call-cta--results-portal',
      title: 'Want help comparing these flights?',
      subtitle: 'A flight specialist can help by phone',
    };
  }

  if (pathname === '/hotels/results') {
    return {
      selector: '.hotel-results-header',
      theme: 'hotels',
      mode: 'inline',
      className: 'support-call-cta--results-portal',
      title: 'Want help choosing a hotel?',
      subtitle: 'A hotel specialist can help by phone',
    };
  }

  if (pathname === '/car-rentals/results') {
    return {
      selector: '.car-controls-bar',
      theme: 'cars',
      mode: 'inline',
      className: 'support-call-cta--results-portal',
      title: 'Want help comparing these rentals?',
      subtitle: 'A rental specialist can help by phone',
    };
  }

  return null;
}

function usePortalTarget(selector, pathname) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    setTarget(null);
    if (!selector || typeof document === 'undefined') return undefined;

    let current = null;
    const locate = () => {
      const next = document.querySelector(selector);
      if (next !== current) {
        current = next;
        setTarget(next || null);
      }
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [selector, pathname]);

  return target;
}

export default function SupportCallLayer() {
  const { pathname } = useLocation();
  const theme = productThemeForPath(pathname);
  const showSticky = isTravelJourneyPath(pathname);
  const portalConfig = useMemo(() => portalConfigForPath(pathname), [pathname]);
  const portalTarget = usePortalTarget(portalConfig?.selector, pathname);

  if (!showSticky && !portalTarget) return null;

  return (
    <>
      {portalTarget && portalConfig && createPortal(
        <SupportCallCTA
          theme={portalConfig.theme}
          mode={portalConfig.mode}
          title={portalConfig.title}
          subtitle={portalConfig.subtitle}
          className={portalConfig.className}
        />,
        portalTarget,
      )}

      {showSticky && (
        <SupportCallCTA
          theme={theme}
          mode="sticky"
          title="Need help booking?"
          subtitle="Talk to a real travel specialist"
          className="support-call-sticky"
        />
      )}
    </>
  );
}
