import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const CANONICAL_ORIGIN = 'https://www.thefinalseat.com';

const NOINDEX_EXACT = new Set([
  '/search',
  '/payment',
  '/booking',
  '/my-bookings',
  '/signin',
  '/signup',
  '/return-flight',
  '/car-rentals/search',
  '/car-rentals/results',
]);

const NOINDEX_PREFIXES = [
  '/admin',
  '/authorize/',
  '/confirmation/',
  '/booking-confirmed',
];

const CANONICAL_ALIASES = {
  '/senior-travel': '/senior-travel/flight-deals',
  '/privacy': '/privacy-policy',
  '/privacypolicy': '/privacy-policy',
  '/refund': '/refund-policy',
  '/refundpolicy': '/refund-policy',
  '/pay': '/payment',
  '/amtrak': '/car-rentals',
  '/amtrak-assistance': '/car-rentals',
};

const normalizePath = (pathname) => {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
};

export default function SeoRouteGuard() {
  const { pathname } = useLocation();
  const normalizedPath = normalizePath(pathname);
  const noindex =
    NOINDEX_EXACT.has(normalizedPath) ||
    NOINDEX_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(prefix));

  const canonicalPath = CANONICAL_ALIASES[normalizedPath] || normalizedPath;
  const canonicalUrl = `${CANONICAL_ORIGIN}${canonicalPath === '/' ? '/' : canonicalPath}`;
  const robotsValue = noindex
    ? 'noindex, nofollow, noarchive'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  return (
    <Helmet>
      <meta name="robots" content={robotsValue} />
      <meta name="googlebot" content={robotsValue} />
      {!noindex && <link rel="canonical" href={canonicalUrl} />}
      {!noindex && <meta property="og:url" content={canonicalUrl} />}
    </Helmet>
  );
}
