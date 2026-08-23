import journeySessionService from './journey-session.service.mjs';
import {
  buildAuthoritativeTripAddonQuote,
  applyAuthoritativeTripAddonPricing,
} from '../addons/trip-addon-pricing.service.mjs';
import { persistTripAddonSnapshot } from '../addons/trip-addon.repository.mjs';

/**
 * Links a successful booking to its c_ checkout token and returns an r_ read token.
 * Add-on pricing is always rebuilt from the server-side checkout payload so a browser
 * cannot choose its own Flex Assist amount or turn a baggage request into a paid item.
 */
export async function completeJourneySessionAfterBooking(req, res, next) {
  const checkoutToken = String(
    req.body?.checkout_session_token
    || req.body?.checkoutSessionToken
    || ''
  ).trim();

  if (!checkoutToken) return next();

  let checkout;
  let tripAddons;
  try {
    checkout = await journeySessionService.getCheckout(checkoutToken);
    tripAddons = buildAuthoritativeTripAddonQuote(checkout?.payload || {});
    const canonicalPayload = {
      ...(checkout?.payload || {}),
      addons: tripAddons,
      addonQuote: tripAddons,
    };
    await journeySessionService.patchCheckout(checkoutToken, { payload: canonicalPayload });
  } catch (error) {
    const status = Number(error?.status) || 400;
    return res.status(status).json({
      success: false,
      error: {
        code: error?.code || 'CHECKOUT_ADDON_VALIDATION_FAILED',
        message: error?.message || 'Unable to validate this checkout session and its optional trip services.',
      },
    });
  }

  const durableRequestId = `checkout:${checkoutToken}`;
  req.body = applyAuthoritativeTripAddonPricing({
    ...(req.body || {}),
    checkout_session_token: checkoutToken,
    checkoutSessionToken: checkoutToken,
    idempotency_key: durableRequestId,
    idempotencyKey: durableRequestId,
    client_request_id: durableRequestId,
    clientRequestId: durableRequestId,
  }, tripAddons);

  const originalJson = res.json.bind(res);
  let sent = false;

  res.json = (body) => {
    if (sent) return res;

    const bookingId = body?.data?.booking?.id
      || body?.data?.id
      || body?.data?.booking_id
      || body?.booking?.id
      || body?.id
      || null;

    if (!body?.success || !bookingId) {
      sent = true;
      return originalJson(body);
    }

    Promise.allSettled([
      persistTripAddonSnapshot(bookingId, tripAddons),
      journeySessionService.completeCheckout(checkoutToken, bookingId),
    ]).then((results) => {
      if (sent) return;
      sent = true;

      const completion = results[1];
      if (results[0]?.status === 'rejected') {
        console.error('[TripAddons] Non-blocking booking snapshot warning:', results[0].reason?.message);
      }
      if (completion?.status === 'rejected') {
        console.error('[JourneySession] Non-blocking checkout completion warning:', completion.reason?.message);
      }

      const reservationToken = completion?.status === 'fulfilled'
        ? completion.value?.reservationToken
        : null;
      const existingData = body?.data && typeof body.data === 'object' ? body.data : {};

      return originalJson({
        ...body,
        data: {
          ...existingData,
          tripAddons,
          ...(reservationToken ? { reservationReadToken: reservationToken } : {}),
        },
        tripAddons,
        ...(reservationToken ? { reservationReadToken: reservationToken } : {}),
      });
    });

    return res;
  };

  return next();
}

export default completeJourneySessionAfterBooking;
