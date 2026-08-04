// eslint-disable-next-line import/first
import { trackGoogleAdsLeadConversion } from '../../utils/googleAds.js';

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
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(safeData);
  }
};

export { trackGoogleAdsLeadConversion };

/**
 * Fires the Google Ads Lead Conversion action tag (AW-18364862445/mIOvCMHyndocEO2fhrVE).
 * Accepts either an options object ({ value, currency, leadId, source, eventCallback }) or positional parameters.
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

