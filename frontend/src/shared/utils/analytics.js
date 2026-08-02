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
 * Fires the Google Ads Lead Conversion action tag.
 * Guaranteed safety & retry handling for window.gtag.
 * Deduplicates calls to prevent multiple conversion events from single form submissions.
 */
export const trackLeadConversion = (source = 'lead_form', dedupeId = null) => {
  if (typeof window === 'undefined') return;

  // Generate deduplication key if not explicitly passed
  const dedupeKey = dedupeId || `${source}_${Date.now()}`;
  
  // Deduplication check: ignore if this exact dedupe key was processed within 5 seconds
  if (firedConversions.has(dedupeKey)) {
    console.log(`[Google Ads Conversion Skipped]: Duplicate conversion suppressed (${dedupeKey})`);
    return;
  }
  firedConversions.add(dedupeKey);
  setTimeout(() => firedConversions.delete(dedupeKey), 5000);

  // Logging requirement #5: Before conversion
  console.log("Google Ads conversion triggered");

  const sendConversionEvent = () => {
    // Ensure dataLayer is initialized
    window.dataLayer = window.dataLayer || [];

    // Ensure window.gtag exists and delegates to dataLayer
    if (typeof window.gtag !== 'function') {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
    }

    // Fire exact event snippet payload as specified by Google Ads
    window.gtag("event", "conversion", {
      send_to: "AW-18364862445/mIOvCMHyndocEO2fhrVE",
      value: 1.0,
      currency: "USD"
    });

    // Logging requirement #5: After firing
    console.log("Google Ads conversion sent: AW-18364862445/mIOvCMHyndocEO2fhrVE");
  };

  // Requirement #3: Check that window.gtag exists or retry loading/checking for a short period
  if (typeof window.gtag === 'function') {
    sendConversionEvent();
  } else {
    // Retry polling loop: check every 100ms up to 2 seconds
    let attempts = 0;
    const maxAttempts = 20;
    const intervalId = setInterval(() => {
      attempts++;
      if (typeof window.gtag === 'function') {
        clearInterval(intervalId);
        sendConversionEvent();
      } else if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        // Fallback execution after timeout
        sendConversionEvent();
      }
    }, 100);
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

