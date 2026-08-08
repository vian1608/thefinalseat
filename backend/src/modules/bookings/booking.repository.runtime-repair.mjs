import supabase from '../../integrations/supabase/supabase.client.mjs';
import logger from '../../config/logger.mjs';
import bookingRepository from './booking.repository.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`);
      error.code = 'REPOSITORY_QUERY_TIMEOUT';
      reject(error);
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

function isOptionalTableError(error) {
  const text = String(error?.message || error || '').toLowerCase();
  return text.includes('schema cache') || text.includes('does not exist') || text.includes('relation') || text.includes('not found');
}

function moneyToCents(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

function splitTotalCents(splits = []) {
  return (Array.isArray(splits) ? splits : []).reduce(
    (sum, split) => sum + moneyToCents(split?.amount),
    0
  );
}

function reconcileAuthorizationAmount(booking, splits = []) {
  if (!booking) return booking;

  const splitCents = splitTotalCents(splits);
  const bookingCents = moneyToCents(
    booking.customer_price ??
    booking.total_amount ??
    booking.pricing?.customerTotal ??
    0
  );

  // A saved split breakdown is authoritative only when it matches the current
  // customer total. This prevents a stale/partial split edit from silently
  // changing an authorization amount.
  if (splitCents <= 0 || bookingCents <= 0 || splitCents !== bookingCents) {
    return booking;
  }

  const canonicalAmount = splitCents / 100;
  const currentAuthorizedCents = moneyToCents(
    booking.authorized_amount ?? booking.authorization?.authorizedAmount ?? 0
  );

  if (currentAuthorizedCents === splitCents) return booking;

  return {
    ...booking,
    authorized_amount: canonicalAmount,
    authorization: {
      ...(booking.authorization || {}),
      authorizedAmount: canonicalAmount
    }
  };
}

async function resolveBookingKeys(input) {
  const raw = String(input || '').trim();
  if (!raw) return { realId: null, refCode: null };

  if (UUID_RE.test(raw)) {
    return { realId: raw, refCode: raw };
  }

  try {
    const result = await withTimeout(
      supabase.from('bookings').select('id, confirmation_code').eq('confirmation_code', raw).maybeSingle(),
      3500,
      'resolve booking reference for payment splits'
    );
    if (!result?.error && result?.data?.id) {
      return {
        realId: result.data.id,
        refCode: result.data.confirmation_code || raw
      };
    }
  } catch (error) {
    logger.warn(`[RepositoryRepair] Could not resolve booking reference '${raw}': ${error.message}`);
  }

  return { realId: raw, refCode: raw };
}

async function querySplitsTable(table, identifiers) {
  if (!identifiers.length) return [];
  try {
    const result = await withTimeout(
      supabase.from(table).select('*').in('booking_id', identifiers),
      4000,
      `load ${table}`
    );
    if (result?.error) {
      if (!isOptionalTableError(result.error)) {
        logger.warn(`[RepositoryRepair] ${table} lookup failed: ${result.error.message}`);
      }
      return [];
    }
    return Array.isArray(result?.data) ? result.data : [];
  } catch (error) {
    logger.warn(`[RepositoryRepair] ${table} lookup failed: ${error.message}`);
    return [];
  }
}

async function persistCanonicalAuthorizationAmount(bookingId, amount) {
  if (!bookingId || !Number.isFinite(amount) || amount <= 0) return;

  try {
    const result = await withTimeout(
      supabase
        .from('bookings')
        .update({ authorized_amount: amount })
        .eq('id', bookingId)
        .select('id, authorized_amount')
        .maybeSingle(),
      4000,
      'synchronize booking authorized amount'
    );

    if (result?.error) {
      logger.warn(`[RepositoryRepair] Could not persist authorized_amount for ${bookingId}: ${result.error.message}`);
    }
  } catch (error) {
    logger.warn(`[RepositoryRepair] Could not persist authorized_amount for ${bookingId}: ${error.message}`);
  }

  // Keep any already-created authorization record consistent too. The existing
  // repository transaction already updates the quote snapshot/splits; this is
  // an additional defensive sync for legacy/stale rows.
  try {
    const result = await withTimeout(
      supabase
        .from('passenger_authorizations')
        .update({ authorized_amount: amount, updated_at: new Date().toISOString() })
        .eq('booking_id', bookingId),
      4000,
      'synchronize passenger authorization amount'
    );

    if (result?.error && !isOptionalTableError(result.error)) {
      logger.warn(`[RepositoryRepair] Could not synchronize passenger authorization amount for ${bookingId}: ${result.error.message}`);
    }
  } catch (error) {
    if (!isOptionalTableError(error)) {
      logger.warn(`[RepositoryRepair] Could not synchronize passenger authorization amount for ${bookingId}: ${error.message}`);
    }
  }
}

export function installBookingRepositoryRuntimeRepairs() {
  if (bookingRepository.__runtimeRepairInstalled) return bookingRepository;

  const originalGetCompleteBookingById = bookingRepository.getCompleteBookingById.bind(bookingRepository);
  const originalUpdatePaymentSplitsAndTotal = bookingRepository.updatePaymentSplitsAndTotal.bind(bookingRepository);

  /*
   * Critical recursion fix:
   *
   * OLD PATH
   * getRelations -> getPaymentSplits -> getById -> getRelations -> ...
   *
   * getPaymentSplits must never hydrate a complete booking. It only needs the
   * booking UUID/reference and the split rows, so resolve those directly.
   */
  bookingRepository.getPaymentSplits = async (bookingIdInput) => {
    if (!bookingIdInput) return [];

    const { realId, refCode } = await resolveBookingKeys(bookingIdInput);
    const identifiers = [...new Set([realId, refCode].filter(Boolean))];

    const canonicalRows = await querySplitsTable('payment_authorization_splits', identifiers);
    if (canonicalRows.length > 0) return canonicalRows;

    // Legacy fallback kept for existing records created before the canonical table.
    return querySplitsTable('payment_splits', identifiers);
  };

  /*
   * Legacy-data repair:
   *
   * A booking can have a current customer total + saved split total of $700,
   * while an older bookings.authorized_amount still says $741. The authorization
   * email protection correctly rejects that mismatch, even though the latest
   * payment edit itself was valid.
   *
   * When the saved splits exactly equal the current booking total, expose that
   * total as the canonical authorization amount. This makes existing records
   * usable immediately without weakening the financial mismatch protection.
   */
  bookingRepository.getCompleteBookingById = async (bookingIdInput) => {
    const booking = await originalGetCompleteBookingById(bookingIdInput);
    if (!booking?.id) return booking;

    const splits = Array.isArray(booking.payment_splits) && booking.payment_splits.length > 0
      ? booking.payment_splits
      : await bookingRepository.getPaymentSplits(booking.id);

    const repaired = reconcileAuthorizationAmount(booking, splits);
    if (repaired !== booking) {
      logger.warn(
        `[RepositoryRepair] Reconciled stale authorized amount for booking ${booking.id}: ` +
        `authorized=$${Number(booking.authorized_amount || 0).toFixed(2)} -> $${Number(repaired.authorized_amount || 0).toFixed(2)}`
      );
    }
    return repaired;
  };

  /*
   * Write-path repair:
   * Saving payment splits must synchronize all three financial values used by
   * the authorization workflow: customer_price, total_amount and authorized_amount.
   * The base repository already owns the transaction for prices/splits; this
   * wrapper persists the missing authorized_amount and then returns a verified,
   * reconciled booking snapshot.
   */
  bookingRepository.updatePaymentSplitsAndTotal = async (...args) => {
    const result = await originalUpdatePaymentSplitsAndTotal(...args);
    if (!result?.id) return result;

    const splits = Array.isArray(result.payment_splits) && result.payment_splits.length > 0
      ? result.payment_splits
      : await bookingRepository.getPaymentSplits(result.id);

    const splitCents = splitTotalCents(splits);
    const bookingCents = moneyToCents(
      result.customer_price ?? result.total_amount ?? result.pricing?.customerTotal ?? 0
    );

    if (splitCents > 0 && bookingCents > 0 && splitCents === bookingCents) {
      const canonicalAmount = splitCents / 100;
      await persistCanonicalAuthorizationAmount(result.id, canonicalAmount);

      return reconcileAuthorizationAmount(
        {
          ...result,
          authorized_amount: canonicalAmount,
          authorization: {
            ...(result.authorization || {}),
            authorizedAmount: canonicalAmount
          }
        },
        splits
      );
    }

    // Do not mask a real mismatch. The authorization-email protection layer
    // must continue blocking dispatch until the totals actually agree.
    return result;
  };

  Object.defineProperty(bookingRepository, '__runtimeRepairInstalled', {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false
  });

  logger.info('[RepositoryRepair] Installed non-recursive payment split lookup and authorization amount synchronization.');
  return bookingRepository;
}

installBookingRepositoryRuntimeRepairs();

export default bookingRepository;
