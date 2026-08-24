import supabase from '../../integrations/supabase/supabase.client.mjs';
import bookingRepository from '../bookings/booking.repository.mjs';
import { loadNormalizedTripAddonSnapshot } from './trip-addon.repository.mjs';

const REQUEST_TYPES = new Set(['TRAVEL_DATE','FLIGHT_TIME','FLIGHT','DESTINATION','OTHER']);
const STATUSES = new Set(['REQUESTED','REVIEWING','OPTION_FOUND','CUSTOMER_APPROVAL','REBOOKING','COMPLETED','DECLINED','CANCELLED']);

function flowError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

async function getBooking(reference) {
  const booking = await bookingRepository.getById(reference);
  if (!booking) throw flowError('Booking not found.', 'BOOKING_NOT_FOUND', 404);
  return booking;
}

async function getFlexAddon(bookingId) {
  const { data, error } = await supabase
    .from('booking_addons')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('addon_type', 'FLEX_ASSIST')
    .maybeSingle();
  if (error) {
    if (error.code === '42P01') throw flowError('Flex change-request storage is not available yet.', 'FLEX_WORKFLOW_STORAGE_NOT_READY', 503);
    throw error;
  }
  return data || null;
}

function publicRequest(row = {}) {
  return {
    id: row.id,
    requestType: row.request_type,
    requestedDetails: row.requested_details || {},
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function verifyCustomer(booking, email) {
  const expected = String(booking?.email || '').trim().toLowerCase();
  const provided = String(email || '').trim().toLowerCase();
  if (!expected || !provided || expected !== provided) {
    throw flowError('The booking email is required to submit or view Flex Assist change requests.', 'BOOKING_EMAIL_VERIFICATION_FAILED', 403);
  }
}

export const tripAddonFlexService = {
  REQUEST_TYPES: [...REQUEST_TYPES],
  STATUSES: [...STATUSES],

  async create(reference, input = {}) {
    const booking = await getBooking(reference);
    await verifyCustomer(booking, input.email);
    const snapshot = await loadNormalizedTripAddonSnapshot(booking.id).catch(() => null);
    if (!snapshot?.flexAssist?.selected) throw flowError('Flex Assist is not active on this booking.', 'FLEX_ASSIST_NOT_ACTIVE', 409);
    const flexAddon = await getFlexAddon(booking.id);
    if (!flexAddon || String(flexAddon.status || '').toUpperCase() !== 'ACTIVE') {
      throw flowError('Flex Assist is not active on this booking.', 'FLEX_ASSIST_NOT_ACTIVE', 409);
    }

    const requestType = String(input.requestType || '').trim().toUpperCase();
    if (!REQUEST_TYPES.has(requestType)) throw flowError('Choose a valid change request type.', 'INVALID_FLEX_REQUEST_TYPE');
    const requestedDetails = input.requestedDetails && typeof input.requestedDetails === 'object'
      ? input.requestedDetails
      : { notes: String(input.notes || '').trim() };

    const { data, error } = await supabase.from('flex_change_requests').insert({
      booking_addon_id: flexAddon.id,
      booking_id: booking.id,
      request_type: requestType,
      requested_details: requestedDetails,
      status: 'REQUESTED',
    }).select('*').single();
    if (error) throw error;

    await bookingRepository.recordAuditLog?.({
      bookingId: booking.id,
      action: 'FLEX_CHANGE_REQUESTED',
      oldValue: null,
      newValue: { requestId: data.id, requestType, status: 'REQUESTED' },
      actor: 'customer',
    });
    return publicRequest(data);
  },

  async listCustomer(reference, email) {
    const booking = await getBooking(reference);
    await verifyCustomer(booking, email);
    const { data, error } = await supabase
      .from('flex_change_requests')
      .select('*')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01') return [];
      throw error;
    }
    return (data || []).map(publicRequest);
  },

  async listAdmin(reference) {
    const booking = await getBooking(reference);
    const { data, error } = await supabase
      .from('flex_change_requests')
      .select('*')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  },

  async update(reference, requestId, input = {}, actor = 'admin') {
    const booking = await getBooking(reference);
    const status = String(input.status || '').trim().toUpperCase();
    if (!STATUSES.has(status)) throw flowError('Invalid Flex change-request status.', 'INVALID_FLEX_STATUS');
    const patch = {
      status,
      admin_notes: input.adminNotes === undefined ? undefined : String(input.adminNotes || '').trim() || null,
      updated_at: new Date().toISOString(),
    };
    Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);
    const { data, error } = await supabase
      .from('flex_change_requests')
      .update(patch)
      .eq('id', requestId)
      .eq('booking_id', booking.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw flowError('Flex change request not found.', 'FLEX_REQUEST_NOT_FOUND', 404);

    if (status === 'COMPLETED') {
      const flexAddon = await getFlexAddon(booking.id);
      if (flexAddon) await supabase.from('booking_addons').update({ status: 'USED', updated_at: new Date().toISOString() }).eq('id', flexAddon.id);
    }
    await bookingRepository.recordAuditLog?.({
      bookingId: booking.id,
      action: 'FLEX_CHANGE_REQUEST_UPDATED',
      oldValue: null,
      newValue: { requestId, status, adminNotes: patch.admin_notes || null },
      actor,
    });
    return data;
  },
};

export default tripAddonFlexService;
