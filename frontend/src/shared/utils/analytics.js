/**
 * Safe Analytics utility for SEO landing pages, flight search, and Google Ads conversion tracking.
 * Strictly avoids transmitting any PII (names, emails, phone numbers, passport numbers, card/billing data).
 *
 * Google Ads Conversion:
 *   Conversion ID: AW-18364862445
 *   Lead Destination: AW-18364862445/mIOvCMHyndocEO2fhrVE
 */

export const GOOGLE_ADS_CONVERSION_ID = 'AW-18364862445';
export const GOOGLE_ADS_LEAD_DESTINATION = 'AW-18364862445/mIOvCMHyndocEO2fhrVE';

// In-memory deduplication set (firedConversions) — guards against duplicate triggers in a single session
const firedConversions = new Set();

/**
 * Fires the Google Ads "Submit lead form" conversion.
 * send_to: AW-18364862445/mIOvCMHyndocEO2fhrVE
 * value: 1.0
 * currency: USD
 *
 * Guaranteed safety:
 * - Gracefully handles missing gtag or ad blockers
 * - Deduplicates by bookingReference/leadId (firedConversions Set + sessionStorage)
 * - Zero PII transmitted: no name, email, phone, card data, passport
 */
export function trackGoogleAdsLeadConversion({
  bookingReference,
  leadId,
  value = 1.0,
  currency = 'USD',
} = {}) {
  const ref = bookingReference || leadId;
  const normalizedReference = String(ref || '').trim();

  if (typeof window === 'undefined') {
    return false;
  }

  // Ensure window.dataLayer and window.gtag are available
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }

  // In-memory deduplication (firedConversions)
  const dedupeKey = normalizedReference ? `lead_${normalizedReference}` : `lead_session_${Date.now()}`;
  if (normalizedReference && firedConversions.has(dedupeKey)) {
    console.info('[Google Ads] Duplicate conversion suppressed for leadId:', normalizedReference);
    return false;
  }

  // Session storage deduplication
  try {
    if (normalizedReference && typeof sessionStorage !== 'undefined') {
      const trackingKey = `google-ads-lead-${normalizedReference}`;
      if (sessionStorage.getItem(trackingKey)) {
        return false;
      }
      sessionStorage.setItem(trackingKey, 'sent');
    }
  } catch (_) {
    // sessionStorage not available (SSR / test env) — proceed without it
  }

  firedConversions.add(dedupeKey);

  // Log Google Ads conversion triggered (non-PII only)
  console.info('Google Ads conversion triggered', {
    destination: GOOGLE_ADS_LEAD_DESTINATION,
    bookingReference: normalizedReference,
    sendTo: GOOGLE_ADS_LEAD_DESTINATION,
    value: typeof value === 'number' ? value : 1.0,
    currency: currency || 'USD',
  });

  const payload = {
    send_to: GOOGLE_ADS_LEAD_DESTINATION,
    value: Number.isFinite(Number(value)) ? Number(value) : 1.0,
    currency: String(currency || 'USD').toUpperCase(),
    event_timeout: 2000,
  };

  if (normalizedReference) {
    payload.transaction_id = normalizedReference;
  }

  try {
    window.gtag('event', 'conversion', payload);
    // Log Google Ads conversion sent
    console.info('Google Ads conversion sent: AW-18364862445/mIOvCMHyndocEO2fhrVE');
    return true;
  } catch (err) {
    console.warn('[Google Ads] Failed to dispatch lead conversion:', err.message);
    return false;
  }
}

export { trackGoogleAdsLeadConversion as trackLeadOnce };

/**
 * Wrapper: accepts string or object params.
 * Guaranteed safety: gracefully handles missing gtag, ad blockers, and deduplicates lead IDs.
 */
export const trackLeadConversion = (params = {}, secondaryArg = null) => {
  if (typeof params === 'string') {
    return trackGoogleAdsLeadConversion({
      leadId: secondaryArg || null,
      value: 1.0,
      currency: 'USD',
    });
  }
  return trackGoogleAdsLeadConversion(params);
};

export const trackEvent = (eventName, payload = {}) => {
  const safeData = {
    event: eventName,
    page: payload.page || 'unknown',
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics Event]:', safeData);
  }

  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
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
  trackLeadConversion: (source = 'lead_form', dedupeId = null) => trackLeadConversion(source, dedupeId),
  trackMobileHelpTabSelected: (tabName) =>
    trackEvent('mobile_help_tab_selected', { tab_name: tabName }),
  trackMobileHelpCardViewed: (tabName, cardName, cardIndex) =>
    trackEvent('mobile_help_card_viewed', { tab_name: tabName, card_name: cardName, card_index: cardIndex }),
};

export default analytics;
