import { bookingAPI } from '../../../shared/api/api';
import journeySessionAPI from '../../../shared/api/journeySessionApi';

const LEGACY_KEY = 'tfsTripAddons';
const FLEX_RATE = 0.10;
const MAX_BAGS = 3;
const publicAddonCache = new Map();
let originalJourneyUpdate = null;
let persistTimer = null;
let frame = null;
let adminLoading = false;
let confirmationLoading = false;

const money = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readJson(key, fallback = null) {
  try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}

function checkoutToken() {
  return sessionStorage.getItem('checkoutSessionToken')
    || window.location.pathname.match(/^\/booking\/(c_[\w-]+)/)?.[1]
    || null;
}

function storageKey() {
  return `tfsTripAddons:${checkoutToken() || 'legacy'}`;
}

function normalizeSelection(raw = {}) {
  return {
    version: 'TRIP_ADDONS_V2',
    flexAssist: { selected: raw?.flexAssist?.selected === true },
    baggage: (Array.isArray(raw?.baggage) ? raw.baggage : [])
      .map((b) => ({
        travelerIndex: Math.max(0, parseInt(b?.travelerIndex, 10) || 0),
        direction: String(b?.direction || 'OUTBOUND').toUpperCase(),
        quantity: Math.min(MAX_BAGS, Math.max(0, parseInt(b?.quantity, 10) || 0)),
      }))
      .filter((b) => b.quantity > 0 && ['OUTBOUND', 'RETURN'].includes(b.direction)),
  };
}

function selectionState() {
  const scoped = readJson(storageKey(), null);
  if (scoped) return normalizeSelection(scoped);
  const legacy = readJson(LEGACY_KEY, null);
  if (legacy) {
    const migrated = normalizeSelection(legacy);
    saveSelection(migrated);
    try { sessionStorage.removeItem(LEGACY_KEY); } catch { /* best effort */ }
    return migrated;
  }
  return normalizeSelection({});
}

function saveSelection(next) {
  try { sessionStorage.setItem(storageKey(), JSON.stringify(normalizeSelection(next))); } catch { /* best effort */ }
}

function paxCount() {
  const s = readJson('searchParams', {});
  return Math.max(1,
    (parseInt(s?.adults || 1, 10) || 0)
    + (parseInt(s?.children || 0, 10) || 0)
    + (parseInt(s?.infants || 0, 10) || 0));
}

function flightPrice(flight) {
  for (const value of [
    flight?.price?.finalPrice,
    flight?.price?.total,
    flight?.price?.customerPrice,
    flight?.finalPrice,
    flight?.totalPrice,
    flight?.price,
  ]) {
    const n = money(value);
    if (n > 0) return n;
  }
  return 0;
}

function ticketBase() {
  const outbound = readJson('selectedFlight');
  const returned = readJson('returnFlight') || readJson('selectedReturnFlight');
  return money((flightPrice(outbound) + flightPrice(returned)) * paxCount());
}

const hasReturn = () => Boolean(readJson('returnFlight') || readJson('selectedReturnFlight'));

function quote() {
  const selection = selectionState();
  const base = ticketBase();
  const flexPrice = selection.flexAssist.selected ? money(base * FLEX_RATE) : 0;
  return { selection, base, flexPrice, addOnTotal: flexPrice };
}

function ticketDue() {
  const voucher = readJson('tfsAppliedVoucher');
  return money(voucher?.finalPrice) || ticketBase();
}

async function persistSelection() {
  const token = checkoutToken();
  if (!token) return;
  const response = await journeySessionAPI.getCheckout(token);
  const payload = response?.data?.payload || response?.payload || {};
  const updater = originalJourneyUpdate || journeySessionAPI.updateCheckout.bind(journeySessionAPI);
  await updater(token, { payload: { ...payload, addons: selectionState() } });
}

function queuePersist() {
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => persistSelection().catch(() => {}), 450);
}

function patchCheckoutApis() {
  if (!journeySessionAPI.__tfsTripAddonsPersistence) {
    originalJourneyUpdate = journeySessionAPI.updateCheckout.bind(journeySessionAPI);
    journeySessionAPI.updateCheckout = (token, patch = {}) => {
      if (!patch?.payload || typeof patch.payload !== 'object') return originalJourneyUpdate(token, patch);
      return originalJourneyUpdate(token, { ...patch, payload: { ...patch.payload, addons: selectionState() } });
    };
    Object.defineProperty(journeySessionAPI, '__tfsTripAddonsPersistence', { value: true });
  }

  if (!bookingAPI.__tfsTripAddonsSubmit) {
    const originalCreate = bookingAPI.create.bind(bookingAPI);
    bookingAPI.create = async (data = {}) => {
      if (!checkoutToken() || !window.location.pathname.startsWith('/booking')) return originalCreate(data);
      await persistSelection();
      const q = quote();
      const ticketComponent = money(data.customer_price || data.customerPrice || data.displayedWebsitePrice || q.base);
      const total = money(ticketComponent + q.addOnTotal);
      return originalCreate({
        ...data,
        customer_price: total,
        customerPrice: total,
        total_amount: total,
        amount: total,
        price: total,
        displayedWebsitePrice: total,
        displayedPrice: total,
        ticket_component_total: ticketComponent,
        add_on_total: q.addOnTotal,
        flex_assist_fee: q.flexPrice,
        trip_addons: q.selection,
      });
    };
    Object.defineProperty(bookingAPI, '__tfsTripAddonsSubmit', { value: true });
  }
}

function updateBag(travelerIndex, direction, quantity) {
  const next = selectionState();
  const map = new Map(next.baggage.map((b) => [`${b.travelerIndex}:${b.direction}`, b]));
  const qty = Math.min(MAX_BAGS, Math.max(0, parseInt(quantity, 10) || 0));
  const key = `${travelerIndex}:${direction}`;
  if (qty) map.set(key, { travelerIndex, direction, quantity: qty });
  else map.delete(key);
  next.baggage = [...map.values()];
  saveSelection(next);
  queuePersist();
  renderCheckout(true);
  syncCheckoutTotals(true);
}

function updateFlex(selected) {
  const next = selectionState();
  next.flexAssist.selected = Boolean(selected);
  saveSelection(next);
  queuePersist();
  renderCheckout(true);
  syncCheckoutTotals(true);
}

function baggageRows(selection) {
  const directions = hasReturn() ? ['OUTBOUND', 'RETURN'] : ['OUTBOUND'];
  let html = '';
  for (let passenger = 0; passenger < paxCount(); passenger += 1) {
    directions.forEach((direction) => {
      const qty = selection.baggage.find((b) => b.travelerIndex === passenger && b.direction === direction)?.quantity || 0;
      html += `<div class="tfs-addon-bag-row">
        <div><strong>Passenger #${passenger + 1}</strong><span>${direction === 'RETURN' ? 'Return journey' : 'Outbound journey'} · requested allowance up to 23 kg / 50 lb per bag</span></div>
        <label>Extra checked bags
          <select data-tfs-bag-passenger="${passenger}" data-tfs-bag-direction="${direction}">
            ${[0, 1, 2, 3].map((n) => `<option value="${n}"${n === qty ? ' selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
      </div>`;
    });
  }
  return html;
}

function ensureCheckoutHost() {
  let host = document.getElementById('tfs-trip-addons-host');
  if (host?.isConnected) return host;
  const payment = document.getElementById('accordion-header-payment')?.closest('.accordion-section');
  if (!payment?.parentElement) return null;
  host = document.createElement('section');
  host.id = 'tfs-trip-addons-host';
  host.className = 'accordion-section accordion-section--open tfs-trip-addons';
  payment.parentElement.insertBefore(host, payment);
  return host;
}

function renderCheckout(force = false) {
  if (!window.location.pathname.startsWith('/booking')) return;
  const host = ensureCheckoutHost();
  if (!host) return;
  const q = quote();
  const signature = JSON.stringify([q.selection, q.base, paxCount(), hasReturn()]);
  if (!force && host.dataset.signature === signature) return;
  host.dataset.signature = signature;

  host.innerHTML = `<div class="tfs-trip-addons__header">
    <span class="accordion-step-badge">4</span>
    <div><span class="tfs-trip-addons__eyebrow">OPTIONAL TRIP SERVICES</span><h2>Customize Your Trip</h2></div>
  </div>
  <div class="tfs-trip-addons__body">
    <article class="tfs-addon-card tfs-addon-card--flex">
      <div class="tfs-addon-card__top"><div><span class="tfs-addon-icon">↻</span><h3>Flex Assist</h3></div><strong>$${money(q.base * FLEX_RATE).toFixed(2)}</strong></div>
      <p>Get additional agency assistance with eligible date or flight changes and available alternatives.</p>
      <ul><li>Priority change assistance</li><li>Alternative-flight and date support</li><li>Dedicated rebooking servicing</li></ul>
      <div class="tfs-addon-warning"><strong>Important:</strong> Flex Assist is an agency service, not travel insurance or an airline flexible fare. Airline fare differences, taxes, penalties, availability and fare rules may still apply. Changes are not guaranteed.</div>
      <label class="tfs-addon-toggle"><input id="tfs-flex-toggle" type="checkbox" ${q.selection.flexAssist.selected ? 'checked' : ''}><span><strong>Add Flex Assist</strong><small>10% of ticket selling price ($${q.base.toFixed(2)} × 10%)</small></span><b>+$${money(q.base * FLEX_RATE).toFixed(2)}</b></label>
    </article>

    <article class="tfs-addon-card tfs-addon-card--baggage">
      <div class="tfs-addon-card__top"><div><span class="tfs-addon-icon">🧳</span><h3>Extra Checked Baggage Request</h3></div><strong>$0.00 now</strong></div>
      <p>Select the extra checked baggage you would like for each traveler and journey. <strong>This submits a request only.</strong></p>
      <div class="tfs-baggage-request-notice">
        <strong>How baggage works</strong>
        <span>1. Submit your flight reservation with the baggage request.</span>
        <span>2. We confirm baggage availability and the exact airline/supplier fee after the reservation.</span>
        <span>3. If available, we send you the confirmed price. You pay separately only if you approve it.</span>
        <span>4. Extra baggage is added only after the separate payment and supplier confirmation.</span>
      </div>
      <div class="tfs-addon-warning tfs-addon-warning--neutral"><strong>Request only · $0 due now.</strong> Baggage is subject to airline availability, fare rules, weight/size limits and supplier pricing. Selecting baggage here does not purchase or guarantee baggage and does not add a baggage charge to your airfare payment.</div>
      <div class="tfs-addon-bags">${baggageRows(q.selection)}</div>
    </article>

    <div class="tfs-trip-addons__summary"><span>Optional services charged with this reservation</span><strong>$${q.addOnTotal.toFixed(2)} USD</strong></div>
    ${q.selection.baggage.length ? '<div class="tfs-baggage-zero-due"><i class="fas fa-info-circle"></i> Your baggage request will be saved with the reservation. <strong>Baggage due now: $0.00.</strong></div>' : ''}
  </div>`;

  host.querySelector('#tfs-flex-toggle')?.addEventListener('change', (event) => updateFlex(event.target.checked));
  host.querySelectorAll('[data-tfs-bag-passenger]').forEach((select) => {
    select.addEventListener('change', () => updateBag(
      parseInt(select.dataset.tfsBagPassenger, 10),
      select.dataset.tfsBagDirection,
      select.value,
    ));
  });
}

function setText(node, text) {
  if (node && String(node.textContent || '').replace(/\s+/g, ' ').trim() !== text) node.textContent = text;
}

function syncCheckoutTotals(force = false) {
  if (!window.location.pathname.startsWith('/booking')) return;
  const q = quote();
  const grand = money(ticketDue() + q.addOnTotal);
  const finalText = `$${grand.toFixed(2)} USD`;
  const totalRow = document.querySelector('.price-breakdown-section .price-row--total');
  if (totalRow?.parentElement) {
    let host = document.getElementById('tfs-trip-addons-sidebar');
    if (!host) {
      host = document.createElement('div');
      host.id = 'tfs-trip-addons-sidebar';
      totalRow.parentElement.insertBefore(host, totalRow);
    }
    const bagCount = q.selection.baggage.reduce((sum, item) => sum + item.quantity, 0);
    const sidebarHtml = `${q.selection.flexAssist.selected ? `<div class="price-row tfs-addon-price-row"><span>Flex Assist (10%)</span><strong>+$${q.flexPrice.toFixed(2)}</strong></div>` : ''}${bagCount ? `<div class="price-row tfs-addon-price-row tfs-addon-price-row--request"><span>Extra baggage request (${bagCount})</span><strong>$0.00 now</strong></div>` : ''}`;
    if (force || host.dataset.signature !== sidebarHtml) {
      host.dataset.signature = sidebarHtml;
      host.innerHTML = sidebarHtml;
    }
  }
  document.querySelectorAll('.price-total-amount,.booking-itinerary-pricing-summary__discounted').forEach((node) => setText(node, finalText));
  const mobile = document.querySelector('.mobile-summary-toggle-bar strong');
  if (mobile && !String(mobile.textContent || '').includes(finalText)) setText(mobile, finalText);
  const button = document.querySelector('.amtrak-btn.amtrak-btn--cta.amtrak-btn--full');
  if (button && !/Securing|Processing/i.test(button.textContent || '')) setText(button.querySelector('span') || button, `🔒 Complete Secure Booking — ${finalText}`);
  const paymentHeader = document.getElementById('accordion-header-payment');
  setText(paymentHeader?.querySelector('.accordion-section-title'), '5. Review & Payment');
  const badge = paymentHeader?.querySelector('.accordion-step-badge:not(.accordion-step-badge--complete)');
  setText(badge, '5');
}

async function fetchPublicAddons(reference) {
  const key = String(reference || '').trim();
  if (!key) return null;
  if (publicAddonCache.has(key)) return publicAddonCache.get(key);
  const pending = fetch(`/api/bookings/${encodeURIComponent(key)}/trip-addons`, { headers: { Accept: 'application/json' } })
    .then(async (response) => {
      if (response.status === 404) return null;
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success) throw new Error(body?.error?.message || 'Unable to load baggage status.');
      return body?.data || body?.tripAddons || null;
    })
    .catch(() => null);
  publicAddonCache.set(key, pending);
  return pending;
}

function statusPresentation(status) {
  const normalized = String(status || 'REQUESTED').toUpperCase();
  const map = {
    REQUESTED: ['Request received', 'pending', 'We received your baggage request. No baggage fee has been charged.'],
    CHECKING_AVAILABILITY: ['Checking availability', 'pending', 'We are checking the airline or supplier for availability and the exact baggage fee.'],
    AVAILABLE: ['Available', 'info', 'The request appears available. We are confirming the final baggage price.'],
    PRICE_CONFIRMED: ['Price confirmed', 'action', 'The baggage price is confirmed. Baggage is paid separately from airfare.'],
    OFFER_SENT: ['Baggage offer sent', 'action', 'The baggage price is confirmed and ready for separate payment.'],
    AWAITING_PAYMENT: ['Awaiting baggage payment', 'action', 'Pay separately for baggage if you would like us to proceed.'],
    PAID: ['Baggage payment received', 'paid', 'Your separate baggage payment was received. We are completing the purchase.'],
    PURCHASE_PENDING: ['Baggage purchase in progress', 'paid', 'Payment was received and we are completing the baggage purchase with the airline or supplier.'],
    CONFIRMED: ['Baggage confirmed', 'confirmed', 'Your extra baggage has been confirmed.'],
    UNAVAILABLE: ['Baggage unavailable', 'unavailable', 'The airline or supplier could not confirm this baggage request.'],
    DECLINED_BY_CUSTOMER: ['Baggage declined', 'muted', 'You chose not to proceed with this baggage request.'],
    PRICE_EXPIRED: ['Baggage price expired', 'unavailable', 'The previous baggage price expired. Contact us if you still want baggage so we can reconfirm it.'],
    PAYMENT_FAILED: ['Baggage payment failed', 'unavailable', 'The separate baggage payment was not completed.'],
    PURCHASE_FAILED: ['Baggage purchase needs attention', 'unavailable', 'We could not complete the supplier baggage purchase. Our team will assist you.'],
    REFUNDED: ['Baggage payment refunded', 'muted', 'The baggage payment was refunded.'],
    CANCELLED: ['Baggage request cancelled', 'muted', 'This baggage request has been cancelled.'],
  };
  return map[normalized] || [normalized.replaceAll('_', ' '), 'pending', 'Baggage status is being updated.'];
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function baggageCustomerCards(addons, { compact = false } = {}) {
  const baggage = Array.isArray(addons?.baggage) ? addons.baggage : [];
  return baggage.map((item) => {
    const [label, tone, description] = statusPresentation(item.status);
    const price = Number(item.customerPrice);
    const hasPrice = Number.isFinite(price) && price > 0;
    const canPay = ['PRICE_CONFIRMED', 'OFFER_SENT', 'AWAITING_PAYMENT'].includes(String(item.status || '').toUpperCase()) && item.paymentUrl;
    const expiry = formatDateTime(item.quoteValidUntil);
    const payment = canPay
      ? `<a class="tfs-baggage-pay-link" href="${escapeHtml(item.paymentUrl)}" target="_blank" rel="noopener noreferrer">Pay $${price.toFixed(2)} for baggage</a>`
      : '';
    return `<article class="tfs-baggage-status-card tfs-baggage-status-card--${tone}${compact ? ' tfs-baggage-status-card--compact' : ''}">
      <div class="tfs-baggage-status-card__top">
        <div><strong>Passenger #${Number(item.travelerIndex) + 1}</strong><span>${item.direction === 'RETURN' ? 'Return journey' : 'Outbound journey'} · ${Number(item.quantity) || 1} extra checked bag${Number(item.quantity) === 1 ? '' : 's'} · up to ${Number(item.weightKg) || 23} kg / 50 lb each</span></div>
        <span class="tfs-baggage-status-pill tfs-baggage-status-pill--${tone}">${escapeHtml(label)}</span>
      </div>
      ${compact ? '' : `<p>${escapeHtml(description)}</p>`}
      ${hasPrice ? `<div class="tfs-baggage-confirmed-price"><span>Confirmed baggage price</span><strong>$${price.toFixed(2)} ${escapeHtml(item.currency || 'USD')}</strong>${expiry ? `<small>Price valid until ${escapeHtml(expiry)}</small>` : ''}</div>` : '<div class="tfs-baggage-confirmed-price tfs-baggage-confirmed-price--pending"><span>Baggage price</span><strong>Pending airline confirmation</strong></div>'}
      ${item.supplierReference ? `<small class="tfs-baggage-reference">Supplier confirmation: ${escapeHtml(item.supplierReference)}</small>` : ''}
      ${payment}
      ${canPay && !compact ? '<small class="tfs-baggage-separate-note">This payment is separate from your airfare. Baggage will be purchased only after the separate payment is received.</small>' : ''}
    </article>`;
  }).join('');
}

async function renderConfirmationAddons() {
  if (!window.location.pathname.startsWith('/booking-confirmed') || confirmationLoading || document.getElementById('tfs-confirmation-trip-addons')) return;
  const container = document.querySelector('.confirmation-container');
  if (!container) return;
  confirmationLoading = true;
  try {
    const routeRef = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || '');
    let addons = null;
    if (routeRef.startsWith('r_')) {
      const response = await journeySessionAPI.getReservation(routeRef);
      addons = response?.data?.tripAddons || response?.tripAddons || null;
    } else {
      addons = await fetchPublicAddons(routeRef);
    }
    if (!addons || (!addons?.flexAssist?.selected && !(addons?.baggage?.length > 0))) return;

    const host = document.createElement('section');
    host.id = 'tfs-confirmation-trip-addons';
    host.className = 'tfs-confirmation-trip-addons';
    host.innerHTML = `<div class="tfs-customer-addon-heading"><div><span>TRIP OPTIONS</span><h2>Your Trip Add-ons</h2></div><i class="fas fa-suitcase-rolling"></i></div>
      ${addons?.flexAssist?.selected ? `<div class="tfs-flex-confirmation"><strong><i class="fas fa-check-circle"></i> Flex Assist active</strong><span>$${money(addons.flexAssist.price).toFixed(2)} ${escapeHtml(addons.currency || 'USD')} · airline fare rules and fare differences still apply.</span></div>` : ''}
      ${addons?.baggage?.length ? `<div class="tfs-baggage-confirmation-intro"><strong>Extra baggage requests</strong><span>Baggage is handled separately from airfare. Availability and exact pricing are confirmed after the reservation; payment is separate only after you approve the confirmed price.</span></div>${baggageCustomerCards(addons)}` : ''}`;

    const reservationCard = container.querySelector('.reservation-details-card');
    if (reservationCard?.nextSibling) container.insertBefore(host, reservationCard.nextSibling);
    else container.appendChild(host);
  } finally {
    confirmationLoading = false;
  }
}

async function enhanceMyBookings() {
  if (!window.location.pathname.startsWith('/my-bookings')) return;
  const cards = [...document.querySelectorAll('.booking-card-item')];
  cards.forEach(async (card) => {
    if (card.dataset.tfsBaggageEnhanced === 'loading' || card.dataset.tfsBaggageEnhanced === 'done') return;
    const reference = String(card.querySelector('.ref-value')?.textContent || '').trim();
    if (!reference || reference === 'N/A') return;
    card.dataset.tfsBaggageEnhanced = 'loading';
    const addons = await fetchPublicAddons(reference);
    const baggage = Array.isArray(addons?.baggage) ? addons.baggage : [];
    if (baggage.length) {
      const body = card.querySelector('.booking-card-body') || card;
      const host = document.createElement('section');
      host.className = 'tfs-my-booking-baggage';
      host.innerHTML = `<div class="tfs-my-booking-baggage__heading"><i class="fas fa-suitcase"></i><strong>Extra Baggage</strong><span>Separate from airfare</span></div>${baggageCustomerCards(addons, { compact: true })}`;
      body.appendChild(host);
    }
    card.dataset.tfsBaggageEnhanced = 'done';
  });
}

function adminAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function adminRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { ...adminAuthHeaders(), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) throw new Error(body?.error?.message || body?.message || `Request failed (${response.status}).`);
  return body;
}

function datetimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return shifted.toISOString().slice(0, 16);
}

function adminRequestCard(request, statuses) {
  const price = request.customerPrice ?? '';
  const cost = request.supplierCost ?? '';
  const margin = Number(price) > 0 && Number.isFinite(Number(cost)) ? money(Number(price) - Number(cost)) : null;
  return `<form class="tfs-baggage-admin-request" data-request-id="${escapeHtml(request.requestId)}">
    <div class="tfs-baggage-admin-request__head">
      <div><strong>Passenger #${Number(request.travelerIndex) + 1} · ${request.direction === 'RETURN' ? 'Return' : 'Outbound'}</strong><span>${Number(request.quantity) || 1} extra checked bag${Number(request.quantity) === 1 ? '' : 's'} · ${Number(request.weightKg) || 23} kg / 50 lb requested</span></div>
      <span class="tfs-baggage-admin-current">${escapeHtml(request.status || 'REQUESTED')}</span>
    </div>
    <div class="tfs-baggage-admin-grid">
      <label>Status<select name="status">${statuses.map((status) => `<option value="${status}"${status === request.status ? ' selected' : ''}>${status.replaceAll('_', ' ')}</option>`).join('')}</select></label>
      <label>Supplier baggage cost<input name="supplierCost" type="number" min="0" step="0.01" value="${escapeHtml(cost)}" placeholder="e.g. 45.00"></label>
      <label>Customer baggage price<input name="customerPrice" type="number" min="0" step="0.01" value="${escapeHtml(price)}" placeholder="e.g. 69.00"></label>
      <label>Quote valid until<input name="quoteValidUntil" type="datetime-local" value="${escapeHtml(datetimeLocalValue(request.quoteValidUntil))}"></label>
      <label class="tfs-admin-field-wide">Separate payment link (HTTPS)<input name="paymentUrl" type="url" value="${escapeHtml(request.paymentUrl || '')}" placeholder="https://..."></label>
      <label>Supplier confirmation/reference<input name="supplierReference" type="text" value="${escapeHtml(request.supplierReference || '')}" placeholder="After purchase"></label>
      <label class="tfs-admin-field-wide">Admin notes<textarea name="adminNotes" rows="2" placeholder="Internal only">${escapeHtml(request.adminNotes || '')}</textarea></label>
    </div>
    <div class="tfs-baggage-admin-money-summary">
      <span>Airfare charge for baggage: <strong>$0.00</strong></span>
      <span>Separate baggage margin: <strong>${margin === null ? '—' : `$${margin.toFixed(2)}`}</strong></span>
    </div>
    <div class="tfs-baggage-admin-actions">
      <button type="submit" data-action="save"><i class="fas fa-save"></i> Save baggage status</button>
      <button type="submit" data-action="send-offer" class="tfs-admin-offer-button"><i class="fas fa-envelope"></i> Save & Send Baggage Offer</button>
      <span class="tfs-baggage-admin-message" aria-live="polite"></span>
    </div>
  </form>`;
}

function readAdminForm(form) {
  const data = new FormData(form);
  return {
    status: data.get('status'),
    supplierCost: data.get('supplierCost') === '' ? null : data.get('supplierCost'),
    customerPrice: data.get('customerPrice') === '' ? null : data.get('customerPrice'),
    quoteValidUntil: data.get('quoteValidUntil') || null,
    paymentUrl: String(data.get('paymentUrl') || '').trim() || null,
    supplierReference: String(data.get('supplierReference') || '').trim() || null,
    adminNotes: String(data.get('adminNotes') || '').trim(),
  };
}

async function renderAdminWorkflow(force = false) {
  const match = window.location.pathname.match(/^\/admin\/bookings\/([^/]+)$/);
  if (!match || adminLoading) return;
  const root = document.querySelector('.admin-booking-detail-route');
  if (!root) return;
  const existing = document.getElementById('tfs-admin-trip-addons');
  if (existing && !force) return;
  if (existing) existing.remove();
  adminLoading = true;
  try {
    const bookingRef = decodeURIComponent(match[1]);
    const response = await adminRequest(`/admin/bookings/${encodeURIComponent(bookingRef)}/trip-addons`);
    const data = response?.data || {};
    const addons = data.tripAddons || {};
    const baggage = Array.isArray(addons.baggage) ? addons.baggage : [];
    if (!baggage.length && !addons?.flexAssist?.selected) return;

    const host = document.createElement('section');
    host.id = 'tfs-admin-trip-addons';
    host.className = 'tfs-admin-trip-addons';
    host.innerHTML = `<div class="tfs-admin-addon-heading"><div><span>POST-RESERVATION ANCILLARIES</span><h2>Trip Add-ons & Baggage Workflow</h2></div><span class="tfs-admin-baggage-count">${baggage.length} baggage request${baggage.length === 1 ? '' : 's'}</span></div>
      ${addons?.flexAssist?.selected ? `<div class="tfs-admin-flex-summary"><strong>Flex Assist</strong><span>ACTIVE · $${money(addons.flexAssist.price).toFixed(2)}</span></div>` : ''}
      ${baggage.length ? '<p class="tfs-admin-addon-intro">Baggage was requested at $0 during airfare checkout. Confirm supplier availability and cost, set the customer price, add a separate HTTPS payment link, then send the offer. Do not mark CONFIRMED until the supplier purchase is complete.</p>' : '<p class="tfs-admin-addon-intro">No extra baggage was requested with this reservation.</p>'}
      <div class="tfs-baggage-admin-list">${baggage.map((request) => adminRequestCard(request, data.baggageStatuses || [])).join('')}</div>`;

    root.insertBefore(host, root.children[1] || null);

    host.querySelectorAll('.tfs-baggage-admin-request').forEach((form) => {
      let action = 'save';
      form.querySelectorAll('button[type="submit"]').forEach((button) => button.addEventListener('click', () => { action = button.dataset.action || 'save'; }));
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const requestId = form.dataset.requestId;
        const message = form.querySelector('.tfs-baggage-admin-message');
        const buttons = [...form.querySelectorAll('button')];
        buttons.forEach((button) => { button.disabled = true; });
        if (message) { message.textContent = 'Saving…'; message.className = 'tfs-baggage-admin-message'; }
        try {
          const patch = readAdminForm(form);
          if (action === 'send-offer') patch.status = 'PRICE_CONFIRMED';
          await adminRequest(`/admin/bookings/${encodeURIComponent(bookingRef)}/trip-addons/${encodeURIComponent(requestId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
          if (action === 'send-offer') {
            await adminRequest(`/admin/bookings/${encodeURIComponent(bookingRef)}/trip-addons/${encodeURIComponent(requestId)}/send-offer`, { method: 'POST', body: '{}' });
            if (message) { message.textContent = 'Baggage offer sent.'; message.classList.add('tfs-baggage-admin-message--success'); }
          } else if (message) {
            message.textContent = 'Saved.';
            message.classList.add('tfs-baggage-admin-message--success');
          }
          publicAddonCache.clear();
          window.setTimeout(() => renderAdminWorkflow(true), 450);
        } catch (error) {
          if (message) { message.textContent = error.message; message.classList.add('tfs-baggage-admin-message--error'); }
          buttons.forEach((button) => { button.disabled = false; });
        }
      });
    });
  } catch (error) {
    const host = document.createElement('section');
    host.id = 'tfs-admin-trip-addons';
    host.className = 'tfs-admin-trip-addons tfs-admin-trip-addons--error';
    host.innerHTML = `<h2>Trip Add-ons</h2><p>${escapeHtml(error.message)}</p>`;
    root.insertBefore(host, root.children[1] || null);
  } finally {
    adminLoading = false;
  }
}

function schedule() {
  if (frame !== null) return;
  frame = window.requestAnimationFrame(() => {
    frame = null;
    renderCheckout();
    syncCheckoutTotals();
    renderConfirmationAddons();
    enhanceMyBookings();
    renderAdminWorkflow();
  });
}

export function installTripAddonsUX() {
  if (typeof window === 'undefined' || window.__tfsTripAddonsInstalled) return;
  window.__tfsTripAddonsInstalled = true;
  patchCheckoutApis();
  saveSelection(selectionState());
  schedule();

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => { window.setTimeout(syncCheckoutTotals, 0); window.setTimeout(syncCheckoutTotals, 120); }, true);
  document.addEventListener('change', () => { window.setTimeout(syncCheckoutTotals, 0); window.setTimeout(syncCheckoutTotals, 120); }, true);
}

export default installTripAddonsUX;
