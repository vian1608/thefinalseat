/**
 * Safe Analytics utility for SEO landing pages and flight search tracking.
 * Strictly avoids transmitting any PII (names, emails, phone numbers, passport numbers, card/billing data).
 */

export const trackEvent = (eventName, payload = {}) => {
  const safeData = {
    event: eventName,
    page: payload.page || 'unknown',
    timestamp: new Date().toISOString(),
    ...payload,
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics Event]:', safeData);
  }

  // Push to dataLayer if Google Tag Manager / Analytics exists
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push(safeData);
  }
};

export const analytics = {
  trackSeoPageView: (pageId) => trackEvent('seo_page_view', { page: pageId }),
  trackFlightSearchStarted: (pageId, criteria = {}) =>
    trackEvent('flight_search_started', {
      page: pageId,
      tripType: criteria.tripType,
      cabinClass: criteria.cabinClass,
      hasReturn: !!criteria.returnDate,
    }),
  trackFlightSearchSubmitted: (pageId, criteria = {}) =>
    trackEvent('flight_search_submitted', {
      page: pageId,
      tripType: criteria.tripType,
      cabinClass: criteria.cabinClass,
      passengersCount: (criteria.adults || 1) + (criteria.children || 0) + (criteria.infants || 0),
      isBookingForSomeoneElse: !!criteria.isBookingForSomeoneElse,
    }),
  trackFlightSearchFailed: (pageId, errorMsg) =>
    trackEvent('flight_search_failed', { page: pageId, error: errorMsg }),
  trackCallCtaClicked: (pageId) => trackEvent('call_cta_clicked', { page: pageId }),
  trackAssistanceRequested: (pageId) => trackEvent('assistance_requested', { page: pageId }),
};

export default analytics;
