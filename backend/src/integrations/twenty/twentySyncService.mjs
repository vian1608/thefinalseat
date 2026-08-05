import { twentyClient } from './twentyClient.mjs';
import {
  mapBookingToTwenty,
  mapFlightSegmentToTwenty,
  mapPaymentSplitToTwenty,
} from './bookingMapper.mjs';

const objectNames = {
  bookings: process.env.TWENTY_BOOKINGS_OBJECT || 'tfsBookings',
  flightSegments: process.env.TWENTY_FLIGHT_SEGMENTS_OBJECT || 'tfsFlightSegments',
  paymentSplits: process.env.TWENTY_PAYMENT_SPLITS_OBJECT || 'tfsPaymentSplits',
};

const assertArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Phase-one CRM sync.
 *
 * The object names are environment-driven because Twenty generates endpoints
 * from the actual workspace schema. The setup script/guide creates matching
 * objects before this service is enabled.
 */
export const syncBookingToTwenty = async ({ booking, flightSegments = [], paymentSplits = [] }) => {
  const bookingRecord = mapBookingToTwenty(booking);

  const createdBooking = await twentyClient.create(objectNames.bookings, bookingRecord);

  const segmentResults = [];
  for (const segment of assertArray(flightSegments)) {
    segmentResults.push(
      await twentyClient.create(
        objectNames.flightSegments,
        mapFlightSegmentToTwenty(segment, bookingRecord.bookingReference),
      ),
    );
  }

  const splitResults = [];
  for (const split of assertArray(paymentSplits)) {
    splitResults.push(
      await twentyClient.create(
        objectNames.paymentSplits,
        mapPaymentSplitToTwenty(split, bookingRecord.bookingReference),
      ),
    );
  }

  return {
    booking: createdBooking,
    flightSegments: segmentResults,
    paymentSplits: splitResults,
    syncedAt: new Date().toISOString(),
  };
};

export const getTwentyConfigurationStatus = () => ({
  enabled: String(process.env.TWENTY_SYNC_ENABLED || 'false').toLowerCase() === 'true',
  configured: twentyClient.isConfigured,
  baseUrlHost: (() => {
    try {
      return twentyClient.baseUrl ? new URL(twentyClient.baseUrl).host : null;
    } catch {
      return null;
    }
  })(),
  objectNames,
});
