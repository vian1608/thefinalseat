import tripAddonWorkflowService from './trip-addon-workflow.service.mjs';

function error(message, code, status = 409) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function find(snapshot, requestId) {
  return (snapshot?.baggage || []).find((item) => item.requestId === requestId) || null;
}

if (!tripAddonWorkflowService.__tfsBaggageSafetyHardening) {
  const originalUpdate = tripAddonWorkflowService.updateRequest?.bind(tripAddonWorkflowService);
  const originalSend = tripAddonWorkflowService.sendOfferEmail?.bind(tripAddonWorkflowService);

  if (originalUpdate) {
    tripAddonWorkflowService.updateRequest = async (reference, requestId, patch = {}, actor = 'admin') => {
      const loaded = await tripAddonWorkflowService.loadSnapshot(reference);
      const current = find(loaded?.snapshot, requestId);
      if (!current) return originalUpdate(reference, requestId, patch, actor);

      const supplierCost = patch.supplierCost !== undefined && patch.supplierCost !== '' && patch.supplierCost !== null
        ? Number(patch.supplierCost)
        : Number(current.supplierCost);
      const customerPrice = patch.customerPrice !== undefined && patch.customerPrice !== '' && patch.customerPrice !== null
        ? Number(patch.customerPrice)
        : Number(current.customerPrice);
      if (Number.isFinite(supplierCost) && Number.isFinite(customerPrice) && customerPrice < supplierCost) {
        throw error('Customer baggage price cannot be lower than supplier cost.', 'BAGGAGE_NEGATIVE_MARGIN', 400);
      }

      const nextStatus = String(patch.status || current.status || 'REQUESTED').toUpperCase();
      const validUntil = patch.quoteValidUntil !== undefined ? patch.quoteValidUntil : current.quoteValidUntil;
      if (validUntil && ['OFFER_SENT','AWAITING_PAYMENT','PAID','PURCHASE_PENDING','CONFIRMED'].includes(nextStatus)) {
        const expiry = new Date(validUntil).getTime();
        if (Number.isFinite(expiry) && expiry <= Date.now()) {
          if (current.status !== 'PRICE_EXPIRED') {
            await originalUpdate(reference, requestId, { status: 'PRICE_EXPIRED' }, actor).catch(() => null);
          }
          throw error('This baggage quote has expired. Confirm a fresh supplier price before continuing.', 'BAGGAGE_QUOTE_EXPIRED');
        }
      }

      if (nextStatus === 'PURCHASE_PENDING' && String(current.status).toUpperCase() !== 'PAID') {
        throw error('Record the separate baggage payment before starting supplier purchase.', 'BAGGAGE_PAYMENT_REQUIRED');
      }
      if (nextStatus === 'CONFIRMED') {
        if (!['PAID','PURCHASE_PENDING'].includes(String(current.status).toUpperCase())) {
          throw error('Baggage cannot be confirmed until the separate payment has been received.', 'BAGGAGE_PAYMENT_REQUIRED');
        }
        const supplierReference = patch.supplierReference !== undefined ? patch.supplierReference : current.supplierReference;
        if (!String(supplierReference || '').trim()) {
          throw error('Supplier confirmation/reference is required before baggage can be marked confirmed.', 'BAGGAGE_SUPPLIER_REFERENCE_REQUIRED', 400);
        }
      }
      return originalUpdate(reference, requestId, patch, actor);
    };
  }

  if (originalSend) {
    tripAddonWorkflowService.sendOfferEmail = async (reference, requestId, actor = 'admin') => {
      const loaded = await tripAddonWorkflowService.loadSnapshot(reference);
      const current = find(loaded?.snapshot, requestId);
      if (current?.quoteValidUntil) {
        const expiry = new Date(current.quoteValidUntil).getTime();
        if (Number.isFinite(expiry) && expiry <= Date.now()) {
          if (originalUpdate) await originalUpdate(reference, requestId, { status: 'PRICE_EXPIRED' }, actor).catch(() => null);
          throw error('This baggage quote has expired. Create a fresh quote before sending the offer.', 'BAGGAGE_QUOTE_EXPIRED');
        }
      }
      const supplier = Number(current?.supplierCost);
      const customer = Number(current?.customerPrice);
      if (Number.isFinite(supplier) && Number.isFinite(customer) && customer < supplier) {
        throw error('Customer baggage price cannot be lower than supplier cost.', 'BAGGAGE_NEGATIVE_MARGIN', 400);
      }
      return originalSend(reference, requestId, actor);
    };
  }

  Object.defineProperty(tripAddonWorkflowService, '__tfsBaggageSafetyHardening', { value: true, enumerable: false });
}

export default tripAddonWorkflowService;
