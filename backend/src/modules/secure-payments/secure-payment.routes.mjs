import crypto from 'crypto';
import express from 'express';
import supabase from '../../integrations/supabase/supabase.client.mjs';
import { getSafeVgsVaultConfig, getVgsAccessToken, getVgsVaultConfig } from './vgs-vault.service.mjs';

const router = express.Router();
const sha256 = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const nowIso = () => new Date().toISOString();

function publicTokenHash(req) {
  return sha256(String(req.params.token || '').trim());
}

function validPublicWindow(row) {
  return row && (!row.public_token_expires_at || new Date(row.public_token_expires_at).getTime() > Date.now());
}

function looksLikeVaultAlias(value) {
  const text = String(value || '').trim();
  if (text.length < 8 || text.length > 512) return false;
  return /^tok_[A-Za-z0-9_-]+$/.test(text) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(text) || /^alias_[A-Za-z0-9_-]+$/.test(text);
}

function safeAuthorization(row) {
  const method = Array.isArray(row.vaulted_payment_methods) ? row.vaulted_payment_methods[0] : row.vaulted_payment_methods;
  const context = Array.isArray(row.payment_contexts) ? row.payment_contexts[0] : row.payment_contexts;
  return {
    id: row.id,
    authorizationCode: row.authorization_code,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    authorizedAmount: row.authorized_amount,
    currency: row.currency,
    purpose: row.purpose,
    status: row.status,
    termsVersion: row.terms_version,
    linkExpiresAt: row.public_token_expires_at,
    context: context ? { contextCode: context.context_code, entityType: context.entity_type, entityCode: context.entity_code } : null,
    paymentMethod: method ? {
      provider: method.provider,
      cardBrand: method.card_brand,
      last4: method.last4,
      panStatus: method.pan_status,
      cvvStatus: method.cvv_status,
      cvvExpiresAt: method.cvv_expires_at,
    } : null,
    recollectionOnly: row.status === 'RECOLLECTION_REQUIRED',
  };
}

async function findByToken(req) {
  const { data, error } = await supabase.from('payment_authorizations')
    .select('id,authorization_code,payment_context_id,customer_name,customer_email,customer_phone,authorized_amount,currency,purpose,status,public_token_expires_at,terms_version,signature_name,authorized_at,payment_contexts(id,context_code,entity_type,entity_id,entity_code),vaulted_payment_methods(id,provider,card_brand,last4,pan_status,cvv_status,cvv_expires_at)')
    .eq('public_token_hash', publicTokenHash(req)).maybeSingle();
  if (error) throw error;
  return data;
}

router.get('/authorizations/:token', async (req, res, next) => {
  try {
    const row = await findByToken(req);
    if (!row || !validPublicWindow(row)) return res.status(404).json({ success: false, error: { code: 'SECURE_AUTH_NOT_FOUND', message: 'This secure authorization link is invalid or expired.' } });
    if (['REVOKED','CANCELLED','EXPIRED'].includes(row.status)) return res.status(410).json({ success: false, error: { code: 'SECURE_AUTH_UNAVAILABLE', message: 'This authorization is no longer available.' } });
    if (row.status === 'SENT') {
      await supabase.from('payment_authorizations').update({ status: 'OPENED', updated_at: nowIso() }).eq('id', row.id);
      await supabase.from('payment_authorization_events').insert({ authorization_id: row.id, event_type: 'CUSTOMER_OPENED', metadata: {} });
      row.status = 'OPENED';
    }
    res.json({ success: true, data: { authorization: safeAuthorization(row), vault: getSafeVgsVaultConfig() } });
  } catch (error) { next(error); }
});

router.get('/authorizations/:token/collect-config', async (req, res, next) => {
  try {
    const row = await findByToken(req);
    if (!row || !validPublicWindow(row)) return res.status(404).json({ success: false, error: { code: 'SECURE_AUTH_NOT_FOUND', message: 'This secure authorization link is invalid or expired.' } });
    const safe = getSafeVgsVaultConfig();
    if (!safe.configured) return res.status(503).json({ success: false, error: { code: 'VGS_NOT_CONFIGURED', message: 'Secure card collection is not configured yet.' } });
    if (!safe.ttlReady) return res.status(503).json({ success: false, error: { code: 'VGS_CVV_TTL_NOT_CONFIRMED', message: `The requested ${safe.targetCvvTtlHours}-hour CVV vault window has not yet been confirmed for this VGS vault.` } });
    const accessToken = await getVgsAccessToken();
    res.json({ success: true, data: { ...safe, accessToken } });
  } catch (error) { next(error); }
});

router.post('/authorizations/:token/complete', async (req, res, next) => {
  try {
    const row = await findByToken(req);
    if (!row || !validPublicWindow(row)) return res.status(404).json({ success: false, error: { code: 'SECURE_AUTH_NOT_FOUND', message: 'This secure authorization link is invalid or expired.' } });
    const config = getVgsVaultConfig();
    if (!config.configured || !config.ttlReady) return res.status(503).json({ success: false, error: { code: 'VGS_CVV_TTL_NOT_CONFIRMED', message: 'Secure card collection is disabled until the requested volatile CVV TTL is available for this VGS environment.' } });

    const body = req.body || {};
    const recollectionOnly = row.status === 'RECOLLECTION_REQUIRED';
    if (!looksLikeVaultAlias(body.cvvAlias)) return res.status(400).json({ success: false, error: { code: 'INVALID_VAULT_ALIAS', message: 'A VGS volatile CVV alias is required.' } });
    if (!recollectionOnly && (!looksLikeVaultAlias(body.panAlias) || !looksLikeVaultAlias(body.expirationAlias))) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_VAULT_ALIAS', message: 'VGS aliases are required for card number and expiration.' } });
    }
    if (!recollectionOnly && !String(body.signatureName || '').trim()) return res.status(400).json({ success: false, error: { code: 'SIGNATURE_REQUIRED', message: 'Cardholder authorization name is required.' } });

    const collectedAt = new Date();
    const cvvExpiresAt = new Date(collectedAt.getTime() + config.effectiveCvvTtlHours * 60 * 60 * 1000);
    const existing = await supabase.from('vaulted_payment_methods').select('*').eq('authorization_id', row.id).maybeSingle();
    if (existing.error) throw existing.error;
    const methodPayload = {
      authorization_id: row.id,
      provider: 'VGS',
      cvv_alias: String(body.cvvAlias).trim(),
      cvv_status: 'AVAILABLE',
      cvv_collected_at: collectedAt.toISOString(),
      cvv_expires_at: cvvExpiresAt.toISOString(),
      updated_at: nowIso(),
    };
    if (!recollectionOnly) {
      methodPayload.pan_alias = String(body.panAlias).trim();
      methodPayload.expiration_alias = String(body.expirationAlias).trim();
      methodPayload.pan_status = 'AVAILABLE';
      methodPayload.card_brand = String(body.cardBrand || '').slice(0, 32) || null;
      methodPayload.last4 = /^\d{4}$/.test(String(body.last4 || '')) ? String(body.last4) : null;
      methodPayload.cardholder_name = String(body.cardholderName || body.signatureName || '').slice(0, 180) || null;
      methodPayload.billing_address = body.billingAddress && typeof body.billingAddress === 'object' ? body.billingAddress : {};
    }
    let method;
    if (existing.data) {
      const updated = await supabase.from('vaulted_payment_methods').update(methodPayload).eq('id', existing.data.id).select('id,provider,card_brand,last4,pan_status,cvv_status,cvv_expires_at').single();
      if (updated.error) throw updated.error;
      method = updated.data;
    } else {
      const inserted = await supabase.from('vaulted_payment_methods').insert(methodPayload).select('id,provider,card_brand,last4,pan_status,cvv_status,cvv_expires_at').single();
      if (inserted.error) throw inserted.error;
      method = inserted.data;
    }

    const signatureName = String(body.signatureName || row.signature_name || '').trim().slice(0, 180) || null;
    const termsHash = sha256(`${row.terms_version}|${row.authorization_code}|${row.authorized_amount}|${row.currency}|${row.purpose}|${signatureName || ''}`);
    const update = {
      status: 'CARD_READY',
      signature_name: signatureName,
      terms_snapshot_hash: termsHash,
      authorized_at: row.authorized_at || nowIso(),
      customer_ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 120) || null,
      customer_user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
      updated_at: nowIso(),
    };
    const saved = await supabase.from('payment_authorizations').update(update).eq('id', row.id).select('id,authorization_code,status').single();
    if (saved.error) throw saved.error;
    await supabase.from('payment_authorization_events').insert({ authorization_id: row.id, event_type: recollectionOnly ? 'CVV_RECOLLECTED' : 'CARD_VAULTED', metadata: { provider: 'VGS', effectiveCvvTtlHours: config.effectiveCvvTtlHours, usesSandboxDefaultTtl: config.usesSandboxDefaultTtl } });
    res.json({ success: true, data: { authorizationCode: saved.data.authorization_code, status: saved.data.status, paymentMethod: method, cvvExpiresAt: method.cvv_expires_at } });
  } catch (error) { next(error); }
});

export default router;
export { router as securePaymentPublicRouter };
