import supabase from '../../integrations/supabase/supabase.client.mjs';
import logger from '../../config/logger.mjs';

const SNAPSHOT_PREFIXES = ['TFS_TRIP_ADDONS_V2:', 'TFS_TRIP_ADDONS_V1:'];
const WRITE_PREFIX = 'TFS_TRIP_ADDONS_V2:';
const MISSING_RELATION = '42P01';

export function parseTripAddonsFromInternalNotes(value) {
  const notes = String(value || '');
  for (const prefix of SNAPSHOT_PREFIXES) {
    const line = notes.split(/\r?\n/).find((entry) => entry.startsWith(prefix));
    if (!line) continue;
    try {
      return JSON.parse(line.slice(prefix.length)) || {};
    } catch {
      return {};
    }
  }
  return {};
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

function publicBaggageStatus(item = {}) {
  const status = String(item.status || 'REQUESTED').toUpperCase();
  const expiresAt = item.quoteValidUntil ? new Date(item.quoteValidUntil).getTime() : null;
  const expirable = ['PRICE_CONFIRMED', 'OFFER_SENT', 'AWAITING_PAYMENT'].includes(status);
  if (expirable && Number.isFinite(expiresAt) && expiresAt <= Date.now()) return 'PRICE_EXPIRED';
  return status;
}

export function publicTripAddonProjection(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const baggage = Array.isArray(snapshot.baggage)
    ? snapshot.baggage.map((item = {}) => {
        const status = publicBaggageStatus(item);
        const canPay = ['PRICE_CONFIRMED', 'OFFER_SENT', 'AWAITING_PAYMENT'].includes(status);
        return {
          requestId: item.requestId || null,
          addonType: 'CHECKED_BAGGAGE',
          travelerIndex: Number.isInteger(Number(item.travelerIndex)) ? Number(item.travelerIndex) : null,
          direction: item.direction || 'OUTBOUND',
          quantity: Number(item.quantity) || 0,
          weightKg: Number(item.weightKg) || 23,
          currency: item.currency || 'USD',
          status,
          customerPrice: item.customerPrice === null || item.customerPrice === undefined ? null : Number(item.customerPrice),
          quoteValidUntil: item.quoteValidUntil || null,
          paymentUrl: canPay && /^https:\/\//i.test(String(item.paymentUrl || '')) ? item.paymentUrl : null,
          paymentStatus: status === 'PRICE_EXPIRED' ? 'NOT_REQUIRED_YET' : (item.paymentStatus || 'NOT_REQUIRED_YET'),
          supplierReference: status === 'CONFIRMED' ? (item.supplierReference || null) : null,
          requiresSeparatePayment: item.requiresSeparatePayment !== false,
          message: status === 'PRICE_EXPIRED'
            ? 'This baggage price has expired. Please contact us if you still want extra baggage so we can reconfirm the airline fee.'
            : (item.message || 'Baggage is subject to airline availability and separate payment after the reservation.'),
          updatedAt: item.updatedAt || null,
        };
      })
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

function isMissingRelation(error) {
  return error?.code === MISSING_RELATION || /relation .* does not exist/i.test(String(error?.message || ''));
}

function paymentStatusFor(item = {}) {
  const status = String(item.paymentStatus || '').toUpperCase();
  if (['NOT_REQUIRED_YET','AWAITING_PAYMENT','PENDING','PROCESSING','PAID','FAILED','REFUNDED'].includes(status)) return status;
  const workflow = String(item.status || '').toUpperCase();
  if (['PRICE_CONFIRMED','OFFER_SENT','AWAITING_PAYMENT'].includes(workflow)) return 'AWAITING_PAYMENT';
  if (['PAID','PURCHASE_PENDING','CONFIRMED'].includes(workflow)) return 'PAID';
  if (workflow === 'PAYMENT_FAILED') return 'FAILED';
  if (workflow === 'REFUNDED') return 'REFUNDED';
  return 'NOT_REQUIRED_YET';
}

async function persistLegacySnapshot(bookingId, snapshot) {
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
}

async function upsertNormalizedSnapshot(bookingId, snapshot) {
  const { data: travellers, error: travellerError } = await supabase
    .from('travellers')
    .select('id, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });
  if (travellerError) throw travellerError;

  const rows = [];
  if (snapshot?.flexAssist?.selected) {
    rows.push({
      booking_id: bookingId,
      traveller_id: null,
      traveler_index: null,
      addon_type: 'FLEX_ASSIST',
      journey_scope: 'ALL',
      quantity: 1,
      unit_price: Number(snapshot.flexAssist.price || 0),
      total_price: Number(snapshot.flexAssist.price || 0),
      currency: snapshot.currency || 'USD',
      pricing_source: 'FORMULA',
      status: snapshot.flexAssist.status || 'ACTIVE',
      terms_version: snapshot.flexAssist.termsVersion || 'FLEX_V1',
      metadata: snapshot.flexAssist,
      updated_at: new Date().toISOString(),
    });
  }

  for (const item of Array.isArray(snapshot?.baggage) ? snapshot.baggage : []) {
    const travelerIndex = Number(item.travelerIndex);
    const traveller = travellers?.[travelerIndex];
    if (!traveller?.id) continue;
    rows.push({
      booking_id: bookingId,
      traveller_id: traveller.id,
      traveler_index: travelerIndex,
      addon_type: 'CHECKED_BAGGAGE',
      journey_scope: String(item.direction || 'OUTBOUND').toUpperCase(),
      quantity: Math.max(1, Math.min(3, Number(item.quantity) || 1)),
      unit_price: Number(item.customerPrice || 0),
      total_price: Number(item.customerPrice || 0),
      currency: item.currency || snapshot.currency || 'USD',
      pricing_source: item.priceMode || 'POST_RESERVATION_QUOTE',
      status: item.status || 'REQUESTED',
      terms_version: item.termsVersion || 'BAGGAGE_REQUEST_V2',
      metadata: item,
      updated_at: new Date().toISOString(),
    });
  }

  const { data: existing, error: existingError } = await supabase
    .from('booking_addons')
    .select('id, addon_type, traveller_id, journey_scope')
    .eq('booking_id', bookingId);
  if (existingError) throw existingError;

  const desiredKeys = new Set();
  const persisted = [];
  for (const row of rows) {
    const key = row.addon_type === 'FLEX_ASSIST'
      ? 'FLEX_ASSIST'
      : `${row.addon_type}:${row.traveller_id}:${row.journey_scope}`;
    desiredKeys.add(key);
    const current = (existing || []).find((entry) => (
      row.addon_type === 'FLEX_ASSIST'
        ? entry.addon_type === 'FLEX_ASSIST'
        : entry.addon_type === row.addon_type && entry.traveller_id === row.traveller_id && entry.journey_scope === row.journey_scope
    ));

    let saved;
    if (current?.id) {
      const { data, error } = await supabase.from('booking_addons').update(row).eq('id', current.id).select('*').single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase.from('booking_addons').insert(row).select('*').single();
      if (error) throw error;
      saved = data;
    }
    persisted.push(saved);

    if (row.addon_type !== 'CHECKED_BAGGAGE') continue;
    const source = row.metadata || {};
    if (source.customerPrice !== null && source.customerPrice !== undefined || source.supplierCost !== null && source.supplierCost !== undefined) {
      const quoteRow = {
        addon_id: saved.id,
        supplier_cost: source.supplierCost === null || source.supplierCost === undefined ? null : Number(source.supplierCost),
        customer_price: source.customerPrice === null || source.customerPrice === undefined ? null : Number(source.customerPrice),
        currency: source.currency || row.currency || 'USD',
        valid_until: source.quoteValidUntil || null,
        payment_url: source.paymentUrl || null,
        status: publicBaggageStatus(source) === 'PRICE_EXPIRED' ? 'EXPIRED' : (['PAID','PURCHASE_PENDING','CONFIRMED'].includes(String(source.status || '').toUpperCase()) ? 'ACCEPTED' : 'ACTIVE'),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('addon_quotes').upsert(quoteRow, { onConflict: 'addon_id' });
      if (error) throw error;
    }

    const payStatus = paymentStatusFor(source);
    const { error: paymentError } = await supabase.from('addon_payments').upsert({
      addon_id: saved.id,
      amount: Number(source.customerPrice || 0),
      currency: source.currency || row.currency || 'USD',
      payment_provider: source.paymentProvider || 'external',
      provider_transaction_id: source.providerTransactionId || null,
      status: payStatus,
      paid_at: payStatus === 'PAID' ? (source.paidAt || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'addon_id' });
    if (paymentError) throw paymentError;

    if (['PURCHASE_PENDING','CONFIRMED','PURCHASE_FAILED','REFUNDED','CANCELLED'].includes(String(source.status || '').toUpperCase())) {
      const { error: fulfillmentError } = await supabase.from('addon_fulfillments').upsert({
        addon_id: saved.id,
        supplier: source.supplier || null,
        supplier_reference: source.supplierReference || null,
        status: String(source.status).toUpperCase(),
        notes: source.adminNotes || null,
        confirmed_at: String(source.status).toUpperCase() === 'CONFIRMED' ? (source.confirmedAt || new Date().toISOString()) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'addon_id' });
      if (fulfillmentError) throw fulfillmentError;
    }
  }

  for (const current of existing || []) {
    const key = current.addon_type === 'FLEX_ASSIST'
      ? 'FLEX_ASSIST'
      : `${current.addon_type}:${current.traveller_id}:${current.journey_scope}`;
    if (!desiredKeys.has(key)) {
      const { error } = await supabase.from('booking_addons').delete().eq('id', current.id);
      if (error) throw error;
    }
  }

  return persisted;
}

export async function loadNormalizedTripAddonSnapshot(bookingId) {
  if (!bookingId) return null;
  const { data: addons, error } = await supabase
    .from('booking_addons')
    .select('*, quote:addon_quotes(*), payment:addon_payments(*), fulfillment:addon_fulfillments(*)')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  if (!addons?.length) return null;

  const flex = addons.find((row) => row.addon_type === 'FLEX_ASSIST');
  const baggage = addons.filter((row) => row.addon_type === 'CHECKED_BAGGAGE').map((row) => {
    const quote = Array.isArray(row.quote) ? row.quote[0] : row.quote;
    const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment;
    const fulfillment = Array.isArray(row.fulfillment) ? row.fulfillment[0] : row.fulfillment;
    return {
      ...(row.metadata || {}),
      requestId: row.metadata?.requestId || row.id,
      addonType: 'CHECKED_BAGGAGE',
      travelerIndex: row.traveler_index,
      direction: row.journey_scope,
      quantity: row.quantity,
      currency: row.currency,
      status: row.status,
      customerPrice: quote?.customer_price ?? row.metadata?.customerPrice ?? null,
      supplierCost: quote?.supplier_cost ?? row.metadata?.supplierCost ?? null,
      quoteValidUntil: quote?.valid_until ?? row.metadata?.quoteValidUntil ?? null,
      paymentUrl: quote?.payment_url ?? row.metadata?.paymentUrl ?? null,
      paymentStatus: payment?.status ?? row.metadata?.paymentStatus ?? 'NOT_REQUIRED_YET',
      supplierReference: fulfillment?.supplier_reference ?? row.metadata?.supplierReference ?? null,
      supplier: fulfillment?.supplier ?? row.metadata?.supplier ?? null,
      confirmedAt: fulfillment?.confirmed_at ?? row.metadata?.confirmedAt ?? null,
    };
  });

  return {
    version: 'TRIP_ADDONS_V2',
    currency: flex?.currency || baggage[0]?.currency || 'USD',
    flexAssist: flex ? {
      ...(flex.metadata || {}),
      addonType: 'FLEX_ASSIST',
      selected: true,
      rate: Number(flex.metadata?.rate) || 0.10,
      price: Number(flex.total_price || 0),
      status: flex.status || 'ACTIVE',
      termsVersion: flex.terms_version || 'FLEX_V1',
    } : { addonType: 'FLEX_ASSIST', selected: false, rate: 0.10, price: 0, status: 'NOT_SELECTED', termsVersion: 'FLEX_V1' },
    baggage,
  };
}

export async function persistTripAddonSnapshot(bookingId, snapshot) {
  if (!bookingId || !snapshot) return false;
  let relationalSaved = false;
  try {
    await upsertNormalizedSnapshot(bookingId, snapshot);
    relationalSaved = true;
  } catch (error) {
    if (!isMissingRelation(error)) logger.warn(`[TripAddons] Normalized persistence warning: ${error.message}`);
  }

  let legacySaved = false;
  try {
    legacySaved = await persistLegacySnapshot(bookingId, snapshot);
  } catch (error) {
    logger.warn(`[TripAddons] Legacy snapshot persistence warning: ${error.message}`);
  }
  return relationalSaved || legacySaved;
}

export default {
  persistTripAddonSnapshot,
  loadNormalizedTripAddonSnapshot,
  parseTripAddonsFromInternalNotes,
  stripTripAddonSnapshotFromNotes,
  serializeTripAddonSnapshot,
  publicTripAddonProjection,
};
