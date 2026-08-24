import supabase from '../../integrations/supabase/supabase.client.mjs';
import logger from '../../config/logger.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';
import passengerAuthorizationService from '../authorizations/passenger-authorization.service.mjs';
import {
  loadNormalizedTripAddonSnapshot,
  parseTripAddonsFromInternalNotes,
  publicTripAddonProjection,
} from './trip-addon.repository.mjs';

function snapshotFromBooking(booking = {}) {
  return booking.tripAddons
    || booking.trip_addons
    || parseTripAddonsFromInternalNotes(booking.internal_notes || booking.internalNotes)
    || null;
}

async function resolveSnapshot(booking = {}) {
  if (!booking?.id) return snapshotFromBooking(booking);
  try {
    const normalized = await loadNormalizedTripAddonSnapshot(booking.id);
    return normalized || snapshotFromBooking(booking);
  } catch (error) {
    logger.warn(`[TripAddons] normalized read fallback for ${booking.id}: ${error.message}`);
    return snapshotFromBooking(booking);
  }
}

function evidenceBreakdown(booking = {}, snapshot = {}) {
  const flexPrice = snapshot?.flexAssist?.selected ? Number(snapshot.flexAssist.price || 0) : 0;
  const authorized = Number(booking.customer_price ?? booking.total_amount ?? 0) || 0;
  const ticketComponent = Number(booking.ticket_component_total);
  const ticket = Number.isFinite(ticketComponent) && ticketComponent >= 0
    ? ticketComponent
    : Math.max(0, authorized - flexPrice);
  return {
    ticket: Number(ticket.toFixed(2)),
    flexAssist: Number(flexPrice.toFixed(2)),
    baggageDueNow: 0,
    totalAuthorized: Number(authorized.toFixed(2)),
    currency: String(booking.currency || snapshot?.currency || 'USD').toUpperCase(),
  };
}

function patchRepositoryRead(methodName) {
  const original = bookingRepository?.[methodName];
  if (typeof original !== 'function') return;
  const marker = `__tfsTripAddonNormalized_${methodName}`;
  if (bookingRepository[marker]) return;
  bookingRepository[methodName] = async (...args) => {
    const booking = await original.apply(bookingRepository, args);
    if (!booking?.id) return booking;
    const tripAddons = await resolveSnapshot(booking);
    if (!tripAddons || typeof tripAddons !== 'object') return booking;
    return {
      ...booking,
      tripAddons,
      trip_addons: tripAddons,
      publicTripAddons: publicTripAddonProjection(tripAddons),
    };
  };
  Object.defineProperty(bookingRepository, marker, { value: true, enumerable: false });
}

patchRepositoryRead('getById');
patchRepositoryRead('getCompleteBookingById');

if (!passengerAuthorizationService.__tfsTripAddonEvidenceHardening) {
  const originalCreate = passengerAuthorizationService.createAuthorizationToken?.bind(passengerAuthorizationService);
  const originalAccept = passengerAuthorizationService.acceptAuthorization?.bind(passengerAuthorizationService);
  const originalEvidence = passengerAuthorizationService.generateAuditEvidenceExport?.bind(passengerAuthorizationService);

  if (originalCreate) {
    passengerAuthorizationService.createAuthorizationToken = async (...args) => {
      const result = await originalCreate(...args);
      try {
        const bookingId = result?.booking_id || result?.bookingId || (typeof args[0] === 'object' ? args[0]?.id : null);
        const booking = bookingId ? await bookingRepository.getById(bookingId) : null;
        const tripAddons = booking ? await resolveSnapshot(booking) : null;
        if (!result?.token || !tripAddons || (!tripAddons?.flexAssist?.selected && !tripAddons?.baggage?.length)) return result;

        const { data: authRecord } = await supabase
          .from('passenger_authorizations')
          .select('quote_snapshot')
          .eq('token', result.token)
          .maybeSingle();
        const quoteSnapshot = {
          ...(authRecord?.quote_snapshot || result.quote_snapshot || {}),
          tripAddons,
          trip_addons: tripAddons,
          addOnEvidence: {
            flexSelected: tripAddons?.flexAssist?.selected === true,
            flexTermsVersion: tripAddons?.flexAssist?.termsVersion || 'FLEX_V1',
            flexPrice: Number(tripAddons?.flexAssist?.price || 0),
            baggage: (tripAddons?.baggage || []).map((item) => ({
              requestId: item.requestId,
              travelerIndex: item.travelerIndex,
              direction: item.direction,
              quantity: item.quantity,
              termsVersion: item.termsVersion || 'BAGGAGE_REQUEST_V2',
              amountDueNow: 0,
              status: item.status || 'REQUESTED',
            })),
          },
          priceBreakdown: evidenceBreakdown(booking, tripAddons),
        };
        await supabase.from('passenger_authorizations').update({ quote_snapshot: quoteSnapshot }).eq('token', result.token);
        return { ...result, quote_snapshot: quoteSnapshot, quoteSnapshot };
      } catch (error) {
        logger.warn(`[TripAddons] authorization quote evidence warning: ${error.message}`);
        return result;
      }
    };
  }

  if (originalAccept) {
    passengerAuthorizationService.acceptAuthorization = async (...args) => {
      const result = await originalAccept(...args);
      try {
        const params = args[0] || {};
        const token = typeof params === 'string' ? params : params.token;
        const bookingId = result?.bookingId || result?.booking_id;
        const booking = bookingId ? await bookingRepository.getById(bookingId) : null;
        const tripAddons = booking ? await resolveSnapshot(booking) : null;
        if (!token || !tripAddons || (!tripAddons?.flexAssist?.selected && !tripAddons?.baggage?.length)) return result;

        const mergedSnapshot = {
          ...(result.authorizationSnapshot || result.authorization_snapshot || {}),
          trip_addons: tripAddons,
          tripAddons,
          price_breakdown: evidenceBreakdown(booking, tripAddons),
          add_on_terms: {
            flex: tripAddons?.flexAssist?.selected ? (tripAddons.flexAssist.termsVersion || 'FLEX_V1') : null,
            baggage: [...new Set((tripAddons?.baggage || []).map((item) => item.termsVersion || 'BAGGAGE_REQUEST_V2'))],
          },
        };

        await supabase.from('passenger_authorizations').update({ authorization_snapshot: mergedSnapshot }).eq('token', token);
        await supabase.from('authorization_snapshots').update({ snapshot_data: mergedSnapshot }).eq('token', token);
        return { ...result, authorizationSnapshot: mergedSnapshot, authorization_snapshot: mergedSnapshot };
      } catch (error) {
        logger.warn(`[TripAddons] accepted authorization evidence warning: ${error.message}`);
        return result;
      }
    };
  }

  if (originalEvidence) {
    passengerAuthorizationService.generateAuditEvidenceExport = async (...args) => {
      const evidence = await originalEvidence(...args);
      try {
        const bookingId = args[0] || evidence?.booking?.id;
        const booking = bookingId ? await bookingRepository.getById(bookingId) : null;
        const tripAddons = booking ? await resolveSnapshot(booking) : null;
        if (!tripAddons) return evidence;
        return {
          ...evidence,
          tripAddons: publicTripAddonProjection(tripAddons),
          addOnEvidence: {
            fullSnapshot: tripAddons,
            priceBreakdown: evidenceBreakdown(booking, tripAddons),
            flexTermsVersion: tripAddons?.flexAssist?.termsVersion || null,
            baggageTermsVersions: [...new Set((tripAddons?.baggage || []).map((item) => item.termsVersion || 'BAGGAGE_REQUEST_V2'))],
          },
        };
      } catch (error) {
        logger.warn(`[TripAddons] audit export add-on evidence warning: ${error.message}`);
        return evidence;
      }
    };
  }

  Object.defineProperty(passengerAuthorizationService, '__tfsTripAddonEvidenceHardening', {
    value: true,
    enumerable: false,
  });
}

export { resolveSnapshot, evidenceBreakdown };
