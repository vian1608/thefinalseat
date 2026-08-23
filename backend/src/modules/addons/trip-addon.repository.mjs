import supabase from '../../integrations/supabase/supabase.client.mjs';
import logger from '../../config/logger.mjs';

const SNAPSHOT_PREFIXES = ['TFS_TRIP_ADDONS_V2:', 'TFS_TRIP_ADDONS_V1:'];
const WRITE_PREFIX = 'TFS_TRIP_ADDONS_V2:';

export function parseTripAddonsFromInternalNotes(value) {
  const notes = String(value || '');
  for (const prefix of SNAPSHOT_PREFIXES) {
    const line = notes.split(/\r?\n/).find((entry) => entry.startsWith(prefix));
    if (!line) continue;
    try {
      return JSON.parse(line.slice(prefix.length));
    } catch {
      return null;
    }
  }
  return null;
}

export function stripTripAddonSnapshotFromNotes(value) {
  return String(value || '')
    .split(/\r?\n/)
    .filter((entry) => entry && !SNAPSHOT_PREFIXES.some((prefix) => entry.startsWith(prefix)))
    .join('\n')
    .trim();
}

export function serializeTripAddonSnapshot(snapshot) {
  return `${WRITE_PREFIX}${JSON.stringify(snapshot || {})}`;
}

export function publicTripAddonProjection(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const baggage = Array.isArray(snapshot.baggage)
    ? snapshot.baggage.map((item = {}) => ({
        requestId: item.requestId || null,
        addonType: 'CHECKED_BAGGAGE',
        travelerIndex: Number.isInteger(Number(item.travelerIndex)) ? Number(item.travelerIndex) : null,
        direction: item.direction || 'OUTBOUND',
        quantity: Number(item.quantity) || 0,
        weightKg: Number(item.weightKg) || 23,
        currency: item.currency || 'USD',
        status: item.status || 'REQUESTED',
        customerPrice: item.customerPrice === null || item.customerPrice === undefined ? null : Number(item.customerPrice),
        quoteValidUntil: item.quoteValidUntil || null,
        paymentUrl: /^https:\/\//i.test(String(item.paymentUrl || '')) ? item.paymentUrl : null,
        paymentStatus: item.paymentStatus || 'NOT_REQUIRED_YET',
        supplierReference: item.status === 'CONFIRMED' ? (item.supplierReference || null) : null,
        requiresSeparatePayment: item.requiresSeparatePayment !== false,
        message: item.message || 'Baggage is subject to airline availability and separate payment after the reservation.',
        updatedAt: item.updatedAt || null,
      }))
    : [];

  return {
    version: snapshot.version || 'TRIP_ADDONS_V2',
    currency: snapshot.currency || 'USD',
    flexAssist: snapshot.flexAssist ? {
      addonType: 'FLEX_ASSIST',
      selected: snapshot.flexAssist.selected === true,
      rate: Number(snapshot.flexAssist.rate) || 0.10,
      price: Number(snapshot.flexAssist.price) || 0,
      status: snapshot.flexAssist.status || (snapshot.flexAssist.selected ? 'ACTIVE' : 'NOT_SELECTED'),
      termsVersion: snapshot.flexAssist.termsVersion || 'FLEX_V1',
      disclaimer: snapshot.flexAssist.disclaimer || null,
    } : null,
    baggage,
  };
}

export async function persistTripAddonSnapshot(bookingId, snapshot) {
  if (!bookingId || !snapshot) return false;
  try {
    const { data, error: readError } = await supabase
      .from('bookings')
      .select('internal_notes')
      .eq('id', bookingId)
      .maybeSingle();
    if (readError) throw readError;

    const preserved = stripTripAddonSnapshotFromNotes(data?.internal_notes);
    const serialized = serializeTripAddonSnapshot(snapshot);
    const internalNotes = [preserved, serialized].filter(Boolean).join('\n');

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ internal_notes: internalNotes })
      .eq('id', bookingId);
    if (updateError) throw updateError;
    return true;
  } catch (error) {
    logger.warn(`[TripAddons] Non-blocking booking snapshot persistence warning: ${error.message}`);
    return false;
  }
}

export default {
  persistTripAddonSnapshot,
  parseTripAddonsFromInternalNotes,
  stripTripAddonSnapshotFromNotes,
  serializeTripAddonSnapshot,
  publicTripAddonProjection,
};
