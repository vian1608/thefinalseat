import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const CANONICAL_ORIGIN = 'https://www.thefinalseat.com';

const INDEXABLE_EXACT = new Set([
  '/',
  '/car-rentals',
  '/contact',
  '/terms',
  '/privacy-policy',
  '/refund-policy',
  '/travel-assistance',
  '/booking-for-parents',
  '/urgent-travel',
  '/senior-travel/flight-deals',
  '/flight-nyc-to-mia',
  '/flight-lax-to-jfk',
  '/train-nyc-to-dc',
  '/train-dc-to-nyc',
  '/train-philly-to-nyc',
  '/train-boston-to-nyc',
]);

const INDEXABLE_PREFIXES = [
  '/routes/',
  '/book/',
  '/changes/',
  '/cancellation/',
];

const CANONICAL_ALIASES = {
  '/senior-travel': '/senior-travel/flight-deals',
  '/privacy': '/privacy-policy',
  '/privacypolicy': '/privacy-policy',
  '/refund': '/refund-policy',
  '/refundpolicy': '/refund-policy',
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
  const canonicalPath = CANONICAL_ALIASES[normalizedPath] || normalizedPath;
  const indexable =
    INDEXABLE_EXACT.has(canonicalPath) ||
    INDEXABLE_PREFIXES.some((prefix) => canonicalPath.startsWith(prefix));

  const canonicalUrl = `${CANONICAL_ORIGIN}${canonicalPath === '/' ? '/' : canonicalPath}`;
  const robotsValue = indexable
    ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    : 'noindex, nofollow, noarchive';

  return (
    <Helmet>
      <meta name="robots" content={robotsValue} />
      <meta name="googlebot" content={robotsValue} />
      {indexable && <link rel="canonical" href={canonicalUrl} />}
      {indexable && <meta property="og:url" content={canonicalUrl} />}
    </Helmet>
  );
}
