import supabase from '../../integrations/supabase/supabase.client.mjs';
import logger from '../../config/logger.mjs';

const SNAPSHOT_PREFIX = 'TFS_TRIP_ADDONS_V1:';

export function parseTripAddonsFromInternalNotes(value) {
  const notes = String(value || '');
  const line = notes.split(/\r?\n/).find((entry) => entry.startsWith(SNAPSHOT_PREFIX));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(SNAPSHOT_PREFIX.length));
  } catch {
    return null;
  }
}

function withoutOldSnapshot(value) {
  return String(value || '')
    .split(/\r?\n/)
    .filter((entry) => entry && !entry.startsWith(SNAPSHOT_PREFIX))
    .join('\n')
    .trim();
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

    const preserved = withoutOldSnapshot(data?.internal_notes);
    const serialized = `${SNAPSHOT_PREFIX}${JSON.stringify(snapshot)}`;
    const internalNotes = [preserved, serialized].filter(Boolean).join('\n');

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ internal_notes: internalNotes })
      .eq('id', bookingId);
    if (updateError) throw updateError;
    return true;
  } catch (error) {
    // Add-on snapshot persistence must never turn a successfully created reservation
    // into a duplicate-prone browser retry. The completed checkout payload is also kept.
    logger.warn(`[TripAddons] Non-blocking booking snapshot persistence warning: ${error.message}`);
    return false;
  }
}

export default {
  persistTripAddonSnapshot,
  parseTripAddonsFromInternalNotes,
};
