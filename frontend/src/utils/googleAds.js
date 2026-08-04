const GOOGLE_ADS_LEAD_DESTINATION = 'AW-18364862445/mIOvCMHyndocEO2fhrVE';
const trackedLeadIds = new Set();

/**
 * Shared Google Ads Lead Conversion Helper.
 * Target: AW-18364862445/mIOvCMHyndocEO2fhrVE
 * Dispatches a conversion event only after backend-confirmed lead success.
 * Deduplicates lead IDs and safely queues to window.dataLayer if gtag is loading asynchronously.
 */
export function trackGoogleAdsLeadConversion({
  leadId,
  value = 1.0,
  currency = 'USD',
} = {}) {
  if (typeof window === 'undefined') {
    return false;
  }

  // Ensure window.dataLayer exists
  window.dataLayer = window.dataLayer || [];

  if (typeof window.gtag !== 'function') {
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }

  // Deduplication guard: ensure single conversion event per lead submission
  const dedupeKey = leadId ? `lead_${leadId}` : `lead_session_${Date.now()}`;
  if (leadId && trackedLeadIds.has(dedupeKey)) {
    console.info('[Google Ads] Duplicate conversion suppressed for leadId:', leadId);
    return false;
  }

  if (trackedLeadIds.has(dedupeKey)) {
    return false;
  }

  trackedLeadIds.add(dedupeKey);
  if (!leadId) {
    setTimeout(() => trackedLeadIds.delete(dedupeKey), 5000);
  }

  console.info('[Google Ads] Dispatching conversion', {
    sendTo: GOOGLE_ADS_LEAD_DESTINATION,
    value: 1.0,
    currency: 'USD',
  });

  try {
    window.gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_LEAD_DESTINATION,
      value: typeof value === 'number' ? value : 1.0,
      currency: currency || 'USD',
    });

    console.info('[Google Ads] Conversion dispatched', {
      destination: GOOGLE_ADS_LEAD_DESTINATION,
      leadIdPresent: Boolean(leadId),
    });

    return true;
  } catch (err) {
    console.warn('[Google Ads] Failed to dispatch lead conversion:', err.message);
    return false;
  }
}

/**
 * Lead ID guard wrapper to prevent duplicate conversion triggers.
 */
export function trackLeadOnce(leadId, options = {}) {
  if (!leadId || trackedLeadIds.has(`lead_${leadId}`)) {
    return false;
  }
  return trackGoogleAdsLeadConversion({ leadId, ...options });
}

export default trackGoogleAdsLeadConversion;
