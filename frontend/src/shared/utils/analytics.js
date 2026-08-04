/**
 * Safe Analytics utility for SEO landing pages and flight search tracking.
 * Strictly avoids transmitting any PII (names, emails, phone numbers, passport numbers, card/billing data).
 */

// Memory set to prevent duplicate conversions in single page app session
const firedConversions = new Set();

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
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(safeData);
  }
};

/**
 * Fires the Google Ads Lead Conversion action tag (AW-18364862445/mIOvCMHyndocEO2fhrVE).
 * Accepts either an options object ({ value, currency, leadId, source, eventCallback }) or positional parameters.
 * Guaranteed safety: gracefully handles missing gtag, ad blockers, and deduplicates lead IDs.
 */
export const trackLeadConversion = (params = {}, secondaryArg = null) => {
  if (typeof window === 'undefined') {
    return false;
  }

  let value = 1.0;
  let currency = 'USD';
  let leadId = null;
  let source = 'lead_form';
  let eventCallback;

  if (typeof params === 'string') {
    source = params;
    if (secondaryArg) leadId = secondaryArg;
  } else if (typeof params === 'object' && params !== null) {
    value = params.value !== undefined ? params.value : 1.0;
    currency = params.currency || 'USD';
    leadId = params.leadId || params.dedupeId || null;
    source = params.source || 'lead_form';
    eventCallback = params.eventCallback;
  }

  const dedupeKey = leadId ? `lead_${leadId}` : `${source}_${Date.now()}`;
  if (leadId && firedConversions.has(dedupeKey)) {
    console.log(`[Google Ads Conversion Skipped]: Duplicate conversion suppressed for leadId: ${leadId}`);
    return false;
  }

  if (firedConversions.has(dedupeKey)) {
    return false;
  }

  firedConversions.add(dedupeKey);
  if (!leadId) {
    setTimeout(() => firedConversions.delete(dedupeKey), 5000);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Google Ads Lead Conversion Triggered]', {
      event: 'conversion',
      send_to: 'AW-18364862445/mIOvCMHyndocEO2fhrVE',
      value,
      currency,
      leadIdPresent: !!leadId,
      source,
    });
  }

  if (typeof window.gtag !== 'function') {
    console.warn('[Google Ads] Lead conversion was not sent because gtag is unavailable.');
    return false;
  }

  try {
    window.gtag('event', 'conversion', {
      send_to: 'AW-18364862445/mIOvCMHyndocEO2fhrVE',
      value,
      currency,
      event_callback: typeof eventCallback === 'function' ? eventCallback : undefined,
    });
    console.log('Google Ads conversion sent: AW-18364862445/mIOvCMHyndocEO2fhrVE');
    return true;
  } catch (err) {
    console.warn('[Google Ads] Conversion event failed safely:', err.message);
    return false;
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
  trackLeadConversion: (source = 'lead_form', dedupeId = null) => trackLeadConversion(source, dedupeId),
  trackMobileHelpTabSelected: (tabName) =>
    trackEvent('mobile_help_tab_selected', { tab_name: tabName }),
  trackMobileHelpCardViewed: (tabName, cardName, cardIndex) =>
    trackEvent('mobile_help_card_viewed', { tab_name: tabName, card_name: cardName, card_index: cardIndex }),
};

export default analytics;

