from pathlib import Path
import re

ROOT = Path('.')

def read(p): return (ROOT / p).read_text()
def write(p, s): (ROOT / p).write_text(s)

def rep(s, old, new, label, count=1):
    found = s.count(old)
    if found < count:
        raise SystemExit(f'{label}: expected >= {count}, found {found}')
    return s.replace(old, new, count)

# ── booking.service: canonical payment status incl. legacy AUTHORIZED input ───
p = 'backend/src/modules/bookings/booking.service.mjs'
s = read(p)
s = rep(
    s,
    "    const ALLOWED_PAY_STATUS = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'AUTHORIZED', 'PROCESSING'];\n",
    "    const ALLOWED_PAY_STATUS = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED'];\n",
    'canonical payment statuses'
)
s = rep(
    s,
    "    const targetStatus = (paymentState || paymentStatus || booking.payment_status || 'pending').toUpperCase();\n",
    "    const requestedPaymentStatus = (paymentState || paymentStatus || booking.payment_status || 'PENDING').toUpperCase();\n    const targetStatus = requestedPaymentStatus === 'AUTHORIZED' ? 'PROCESSING' : requestedPaymentStatus;\n",
    'normalize legacy authorized payment status'
)
write(p, s)

# ── booking.repository: persistence correctness + rollback + audit/email ──────
p = 'backend/src/modules/bookings/booking.repository.mjs'
s = read(p)

old_create = """    if (data?.id) {
      const fullRecord = { ...data, client_request_id: clientReqId };
      bookingsMemoryStore.set(data.id, fullRecord);
      if (data.confirmation_code) bookingsMemoryStore.set(data.confirmation_code, fullRecord);
      if (clientReqId) bookingsMemoryStore.set(clientReqId, fullRecord);
      return fullRecord;
    }

    if (error) {
      const insertError = new Error(`Booking record insert failed: ${error.message}`);
      insertError.code = 'BOOKING_INSERT_FAILED';
      throw insertError;
    }
    if (data) {
      if (data.id) bookingsMemoryStore.set(data.id, data);
      if (data.confirmation_code) bookingsMemoryStore.set(data.confirmation_code, data);
    }
    await bookingRepository.recordAuditLog({
      bookingId: data.id || dbRow.id,
      action: 'BOOKING_CREATED',
      oldValue: null,
      newValue: data,
      actor: dbRow.created_by || 'customer'
    });
    return data;
"""
new_create = """    if (error) {
      const insertError = new Error(`Booking record insert failed: ${error.message}`);
      insertError.code = 'BOOKING_INSERT_FAILED';
      throw insertError;
    }
    if (!data?.id) {
      const insertError = new Error('Booking record insert failed: database returned no persisted booking.');
      insertError.code = 'BOOKING_INSERT_FAILED';
      throw insertError;
    }

    const fullRecord = { ...data, client_request_id: clientReqId };
    bookingsMemoryStore.set(data.id, fullRecord);
    if (data.confirmation_code) bookingsMemoryStore.set(data.confirmation_code, fullRecord);
    if (clientReqId) bookingsMemoryStore.set(clientReqId, fullRecord);

    await bookingRepository.recordAuditLog({
      bookingId: data.id,
      action: 'BOOKING_CREATED',
      oldValue: null,
      newValue: { confirmation_code: data.confirmation_code, status: data.status, payment_status: data.payment_status },
      actor: dbRow.created_by || 'customer'
    });
    return fullRecord;
"""
s = rep(s, old_create, new_create, 'booking insert audit reachability')

# Never change a payment-method primary key when updating an existing record.
s = rep(
    s,
    "      id: payload.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),\n      booking_id: bookingId,",
    "      booking_id: bookingId,",
    'payment method generated primary key removal'
)
s = rep(
    s,
    "        id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,\n        booking_id: bookingId,",
    "        booking_id: bookingId,",
    'billing update invalid uuid removal'
)

# Persist audit logs using DB-generated UUIDs; never send audit_* text into UUID id.
old_audit_head = """    const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id: logId,
      booking_id: bookingId,
"""
new_audit_head = """    const record = {
      booking_id: bookingId,
"""
s = rep(s, old_audit_head, new_audit_head, 'audit uuid fix')
old_audit_insert = """    const { error } = await supabase
      .from('audit_logs')
      .insert(record);

    if (error) {
      logger.warn(`audit_logs insert notice (stored in memory store): ${error.message}`);
    }

    logger.info(`[AuditLog] Action '${action}' recorded for booking ${bookingId} by actor '${record.actor}'`);
    return record;
"""
new_audit_insert = """    const { data: persistedAudit, error } = await supabase
      .from('audit_logs')
      .insert(record)
      .select('id,booking_id,action,old_value,new_value,actor,ip_address,created_at')
      .single();

    if (error) {
      logger.warn(`audit_logs insert notice: ${error.message}`);
    }

    const finalRecord = persistedAudit || record;
    logger.info(`[AuditLog] Action '${action}' recorded for booking ${bookingId} by actor '${record.actor}'`);
    return finalRecord;
"""
s = rep(s, old_audit_insert, new_audit_insert, 'audit canonical insert')

# Write email activity to the canonical table/columns instead of an alias view.
old_email_write = """    try {
      const { error } = await supabase.from('email_logs').insert(logRecord);
      if (error) {
        logger.warn(`[saveEmailActivity] email_logs insert notice: ${error.message}`);
      }
    } catch (err) {
      logger.warn(`[saveEmailActivity] Supabase notice: ${err.message}`);
    }
"""
new_email_write = """    try {
      const { error } = await supabase.from('email_deliveries').insert({
        booking_id: realId,
        confirmation_code: refCode,
        email_type: templateType,
        recipient,
        provider: emailData.provider || 'RESEND',
        provider_message_id: providerMessageId,
        status,
        error_message: errorMsg,
        sent_at: sentAt,
        expires_at: templateType.includes('AUTH') ? expiresAt : null,
        last_attempt_at: sentAt,
        created_at: sentAt,
        updated_at: sentAt
      });
      if (error) {
        logger.warn(`[saveEmailActivity] email_deliveries insert notice: ${error.message}`);
      }
    } catch (err) {
      logger.warn(`[saveEmailActivity] Supabase notice: ${err.message}`);
    }
"""
s = rep(s, old_email_write, new_email_write, 'canonical email activity insert')

# Make ticket snapshot/audit reachable.
s = rep(
    s,
    "    return await bookingRepository.getCompleteBookingById(realId);\n\n    // Create Immutable Append-Only Ticket Snapshot\n",
    "    // Create Immutable Append-Only Ticket Snapshot\n",
    'remove unreachable ticket return'
)

# Admin save must persist canonical uppercase payment state.
s = rep(
    s,
    "        bookingUpdateFields.payment_status = targetPaymentStatus.toLowerCase();",
    "        bookingUpdateFields.payment_status = targetPaymentStatus;",
    'admin payment status uppercase'
)
s = rep(
    s,
    "      const targetPaymentStatus = (paymentState || paymentMetadata.paymentStatus || booking.payment_status || 'pending').toLowerCase();",
    "      const requestedPaymentStatus = (paymentState || paymentMetadata.paymentStatus || booking.payment_status || 'PENDING').toUpperCase();\n      const targetPaymentStatus = requestedPaymentStatus === 'AUTHORIZED' ? 'PROCESSING' : requestedPaymentStatus;",
    'payment transaction uppercase'
)

# Canonical admin filters: aliases map into actual DB status values, never obsolete values.
s = rep(
    s,
    "        if (s === 'CONFIRMED') s = 'RESERVATION_CONFIRMED';\n        if (s === 'DONE') s = 'COMPLETED';",
    "        if (s === 'CONFIRMED' || s === 'COMPLETED') s = 'DONE';",
    'admin booking status filter aliases'
)

# updateStatus must not report a memory-only success when Postgres rejects the write.
start = s.find("    if (error) {\n      logger.warn(`Supabase schema notice: ${error.message}.`);")
if start == -1:
    raise SystemExit('updateStatus error block not found')
end_marker = "\n    const finalRec = data ? { ...updatedMem, ...data } : updatedMem;"
end = s.find(end_marker, start)
if end == -1:
    raise SystemExit('updateStatus final record marker not found')
new_error_block = """    if (error) {
      logger.error(`Booking update failed for ${id}: ${error.message}`);
      const updateError = new Error(`BOOKING_UPDATE_FAILED: ${error.message}`);
      updateError.code = 'BOOKING_UPDATE_FAILED';
      throw updateError;
    }
"""
s = s[:start] + new_error_block + s[end:]

# Collapse rollback/delete into one FK-cascade booking delete plus non-FK audit cleanup.
pattern = re.compile(r"  deleteBooking:\s*async\s*\(id\)\s*=>\s*\{[\s\S]*?\n  \},\n", re.M)
m = pattern.search(s)
if not m:
    raise SystemExit('deleteBooking method not found')
new_delete = """  deleteBooking: async (id) => {
    const base = await bookingRepository.findBaseBookingRecord(String(id));
    const realId = base?.id || id;

    // audit_logs predates the cascade FK contract; remove it explicitly.
    await supabase.from('audit_logs').delete().eq('booking_id', realId);

    // Core relations (travellers, contacts, flights, payments, payment methods,
    // itinerary, authorizations, snapshots, journey sessions, etc.) are protected
    // by ON DELETE CASCADE. One parent delete is both safer and substantially cheaper.
    const { error } = await supabase.from('bookings').delete().eq('id', realId);
    if (error) {
      const deleteError = new Error(`BOOKING_DELETE_FAILED: ${error.message}`);
      deleteError.code = 'BOOKING_DELETE_FAILED';
      throw deleteError;
    }

    const confirmationCode = base?.confirmation_code || null;
    [realId, confirmationCode].filter(Boolean).forEach((key) => {
      bookingsMemoryStore.delete(key);
      segmentsMemoryStore.delete(key);
      splitsMemoryStore.delete(key);
      ticketSnapshotsMemoryStore.delete(key);
      authSnapshotsMemoryStore.delete(key);
      auditLogsMemoryStore.delete(key);
      paymentMethodsMemoryStore.delete(key);
      emailDeliveriesMemoryStore.delete(key);
    });
    return true;
  },
"""
s = s[:m.start()] + new_delete + s[m.end():]

# Pricing writes are not successful unless the DB update succeeds.
old_pricing_db = """    // Update DB
    try {
      await supabase.from('bookings').update(updateFields).eq('id', base.id);
    } catch (dbErr) {
      logger.warn(`[updatePricingAtomic] Supabase update warning for ${base.id}:`, dbErr.message);
    }
"""
new_pricing_db = """    // Update DB and verify the write instead of reporting a memory-only success.
    const { error: pricingUpdateError } = await supabase.from('bookings').update(updateFields).eq('id', base.id);
    if (pricingUpdateError) {
      throw new Error(`PRICING_UPDATE_FAILED: ${pricingUpdateError.message}`);
    }
"""
s = rep(s, old_pricing_db, new_pricing_db, 'pricing fail closed')

write(p, s)

# ── Authorization service: dual-write current schema and fail closed in prod ──
p = 'backend/src/modules/authorizations/passenger-authorization.service.mjs'
s = read(p)
s = rep(
    s,
    "      booking_id: bookingId,\n      token,\n      status: 'pending',\n      authorized_amount: authorizedAmountNum,",
    "      booking_id: bookingId,\n      token,\n      authorization_token: token,\n      status: 'pending',\n      authorization_status: 'AWAITING_AUTHORIZATION',\n      authorized_amount: authorizedAmountNum,\n      booking_amount: authorizedAmountNum,",
    'authorization dual token/amount'
)
s = rep(
    s,
    "      card_brand: vaultData.cardBrand || vaultData.brand || completeBooking.paymentMethod?.card_brand || null,\n      card_last4:",
    "      card_brand: vaultData.cardBrand || vaultData.brand || completeBooking.paymentMethod?.card_brand || null,\n      payment_card_brand: vaultData.cardBrand || vaultData.brand || completeBooking.paymentMethod?.card_brand || null,\n      card_last4:",
    'authorization dual brand'
)
# Add legacy last4, expiry aliases after the IIFE closes by anchoring quote_snapshot.
s = rep(
    s,
    "      quote_snapshot: quoteSnapshot,\n      itinerary_snapshot: itinerarySnapshot,",
    "      payment_card_last4: (() => {\n        const raw = String(vaultData.cardLast4 || vaultData.last4 || completeBooking.paymentMethod?.card_last4 || '').replace(/\\D/g, '');\n        return /^\\d{4}$/.test(raw) ? raw : null;\n      })(),\n      quote_snapshot: quoteSnapshot,\n      itinerary_snapshot: itinerarySnapshot,",
    'authorization dual last4'
)
s = rep(
    s,
    "      expires_at: expiresAt,\n      created_at: new Date().toISOString()",
    "      expires_at: expiresAt,\n      authorization_expires_at: expiresAt,\n      created_at: new Date().toISOString()",
    'authorization dual expiry'
)
old_auth_insert = """      if (error) {
        logger.warn(`[Auth] Supabase table insert warning: ${error.message}. Saving to resilience memory store.`);
        memoryAuthStore.set(token, authRecord);
      } else {
        memoryAuthStore.set(token, data);
      }
    } catch (e) {
      memoryAuthStore.set(token, authRecord);
    }
"""
new_auth_insert = """      if (error) {
        if (process.env.NODE_ENV === 'test') {
          logger.warn(`[Auth] Supabase table insert warning in test mode: ${error.message}.`);
          memoryAuthStore.set(token, authRecord);
        } else {
          throw new Error(`AUTHORIZATION_PERSISTENCE_FAILED: ${error.message}`);
        }
      } else {
        memoryAuthStore.set(token, data);
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'test') memoryAuthStore.set(token, authRecord);
      else throw e;
    }
"""
s = rep(s, old_auth_insert, new_auth_insert, 'authorization fail closed')
old_accept = """    if (paError) {
      logger.warn(`[Auth] passenger_authorizations update notice (non-fatal): ${paError.message}`);
    }
"""
new_accept = """    if (paError) {
      if (process.env.NODE_ENV === 'test') {
        logger.warn(`[Auth] passenger_authorizations update notice in test mode: ${paError.message}`);
      } else {
        throw new Error(`AUTHORIZATION_ACCEPT_PERSISTENCE_FAILED: ${paError.message}`);
      }
    }
"""
s = rep(s, old_accept, new_accept, 'authorization acceptance fail closed')
write(p, s)

print('production booking runtime cleanup applied')
