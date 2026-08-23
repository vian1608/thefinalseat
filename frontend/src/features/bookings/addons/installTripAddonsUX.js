import { bookingAPI, adminAPI } from '../../../shared/api/api';
import journeySessionAPI from '../../../shared/api/journeySessionApi';

const KEY = 'tfsTripAddons';
const FLEX_RATE = 0.10;
let originalJourneyUpdate = null;
let persistTimer = null;

const money = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

function readJson(key, fallback = null) {
  try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}

function state(raw = readJson(KEY, {})) {
  return {
    version: 'TRIP_ADDONS_V1',
    flexAssist: { selected: raw?.flexAssist?.selected === true },
    baggage: (Array.isArray(raw?.baggage) ? raw.baggage : [])
      .map((b) => ({
        travelerIndex: Math.max(0, parseInt(b?.travelerIndex, 10) || 0),
        direction: String(b?.direction || 'OUTBOUND').toUpperCase(),
        quantity: Math.min(3, Math.max(0, parseInt(b?.quantity, 10) || 0)),
      }))
      .filter((b) => b.quantity > 0 && ['OUTBOUND', 'RETURN'].includes(b.direction)),
  };
}

function save(next) { try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* best effort */ } }

function paxCount() {
  const s = readJson('searchParams', {});
  return Math.max(1, (parseInt(s?.adults || 1, 10) || 0) + (parseInt(s?.children || 0, 10) || 0) + (parseInt(s?.infants || 0, 10) || 0));
}

function flightPrice(f) {
  for (const value of [f?.price?.finalPrice, f?.price?.total, f?.price?.customerPrice, f?.finalPrice, f?.totalPrice, f?.price]) {
    const n = money(value); if (n > 0) return n;
  }
  return 0;
}

function ticketBase() {
  const out = readJson('selectedFlight');
  const ret = readJson('returnFlight') || readJson('selectedReturnFlight');
  return money((flightPrice(out) + flightPrice(ret)) * paxCount());
}

const hasReturn = () => Boolean(readJson('returnFlight') || readJson('selectedReturnFlight'));
const token = () => sessionStorage.getItem('checkoutSessionToken') || window.location.pathname.match(/^\/booking\/(c_[\w-]+)/)?.[1] || null;

function quote() {
  const selection = state();
  const base = ticketBase();
  const flexPrice = selection.flexAssist.selected ? money(base * FLEX_RATE) : 0;
  return { selection, base, flexPrice, addOnTotal: flexPrice };
}

function ticketDue() {
  const voucher = readJson('tfsAppliedVoucher');
  return money(voucher?.finalPrice) || ticketBase();
}

async function persist() {
  const checkoutToken = token();
  if (!checkoutToken) return;
  const response = await journeySessionAPI.getCheckout(checkoutToken);
  const payload = response?.data?.payload || response?.payload || {};
  const updater = originalJourneyUpdate || journeySessionAPI.updateCheckout.bind(journeySessionAPI);
  await updater(checkoutToken, { payload: { ...payload, addons: state() } });
}

function queuePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => persist().catch(() => {}), 450);
}

function patchApis() {
  if (!journeySessionAPI.__tfsTripAddonsPersistence) {
    originalJourneyUpdate = journeySessionAPI.updateCheckout.bind(journeySessionAPI);
    journeySessionAPI.updateCheckout = (checkoutToken, patch = {}) => {
      if (!patch?.payload || typeof patch.payload !== 'object') return originalJourneyUpdate(checkoutToken, patch);
      return originalJourneyUpdate(checkoutToken, { ...patch, payload: { ...patch.payload, addons: state() } });
    };
    Object.defineProperty(journeySessionAPI, '__tfsTripAddonsPersistence', { value: true });
  }

  if (!bookingAPI.__tfsTripAddonsSubmit) {
    const originalCreate = bookingAPI.create.bind(bookingAPI);
    bookingAPI.create = async (data = {}) => {
      if (!token() || !window.location.pathname.startsWith('/booking')) return originalCreate(data);
      await persist();
      const q = quote();
      const ticketComponent = money(data.customer_price || data.customerPrice || data.displayedWebsitePrice || q.base);
      const total = money(ticketComponent + q.addOnTotal);
      return originalCreate({
        ...data,
        customer_price: total, customerPrice: total, total_amount: total, amount: total, price: total,
        displayedWebsitePrice: total, displayedPrice: total,
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
  const next = state();
  const map = new Map(next.baggage.map((b) => [`${b.travelerIndex}:${b.direction}`, b]));
  const q = Math.min(3, Math.max(0, parseInt(quantity, 10) || 0));
  const k = `${travelerIndex}:${direction}`;
  if (q) map.set(k, { travelerIndex, direction, quantity: q }); else map.delete(k);
  next.baggage = [...map.values()]; save(next); queuePersist(); render(true); syncTotals(true);
}

function updateFlex(selected) {
  const next = state(); next.flexAssist.selected = Boolean(selected); save(next); queuePersist(); render(true); syncTotals(true);
}

function bagRows(selection) {
  const dirs = hasReturn() ? ['OUTBOUND', 'RETURN'] : ['OUTBOUND'];
  let html = '';
  for (let p = 0; p < paxCount(); p += 1) dirs.forEach((direction) => {
    const qty = selection.baggage.find((b) => b.travelerIndex === p && b.direction === direction)?.quantity || 0;
    html += `<div class="tfs-addon-bag-row"><div><strong>Passenger #${p + 1}</strong><span>${direction === 'RETURN' ? 'Return' : 'Outbound'} · up to 23 kg / 50 lb per requested bag</span></div><label>Checked bags <select data-p="${p}" data-d="${direction}">${[0,1,2,3].map((n) => `<option value="${n}"${n === qty ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>`;
  });
  return html;
}

function ensureHost() {
  let host = document.getElementById('tfs-trip-addons-host');
  if (host?.isConnected) return host;
  const payment = document.getElementById('accordion-header-payment')?.closest('.accordion-section');
  if (!payment?.parentElement) return null;
  host = document.createElement('section');
  host.id = 'tfs-trip-addons-host'; host.className = 'accordion-section accordion-section--open tfs-trip-addons';
  payment.parentElement.insertBefore(host, payment); return host;
}

function render(force = false) {
  if (!window.location.pathname.startsWith('/booking')) return;
  const host = ensureHost(); if (!host) return;
  const q = quote();
  const signature = JSON.stringify([q.selection, q.base, paxCount(), hasReturn()]);
  if (!force && host.dataset.signature === signature) return;
  host.dataset.signature = signature;
  host.innerHTML = `<div class="tfs-trip-addons__header"><span class="accordion-step-badge">4</span><div><span class="tfs-trip-addons__eyebrow">OPTIONAL TRIP SERVICES</span><h2>Customize Your Trip</h2></div></div>
  <div class="tfs-trip-addons__body">
    <article class="tfs-addon-card tfs-addon-card--flex"><div class="tfs-addon-card__top"><div><span class="tfs-addon-icon">↻</span><h3>Flex Assist</h3></div><strong>$${money(q.base * FLEX_RATE).toFixed(2)}</strong></div><p>Additional help with eligible date or flight changes and available alternatives.</p><ul><li>Priority change assistance</li><li>Alternative-flight and date support</li><li>Dedicated rebooking servicing</li></ul><div class="tfs-addon-warning"><strong>Important:</strong> This is an agency service, not travel insurance or an airline flexible fare. Airline fare differences, taxes, penalties, availability and fare rules may still apply. Changes are not guaranteed.</div><label class="tfs-addon-toggle"><input id="tfs-flex-toggle" type="checkbox" ${q.selection.flexAssist.selected ? 'checked' : ''}><span><strong>Add Flex Assist</strong><small>10% of ticket selling price ($${q.base.toFixed(2)} × 10%)</small></span><b>+$${money(q.base * FLEX_RATE).toFixed(2)}</b></label></article>
    <article class="tfs-addon-card"><div class="tfs-addon-card__top"><div><span class="tfs-addon-icon">🧳</span><h3>Checked Baggage Request</h3></div><strong>$0.00 now</strong></div><p>Request additional checked baggage by traveler and journey. We will confirm airline eligibility and the exact supplier fee before ticketing.</p><div class="tfs-addon-warning tfs-addon-warning--neutral">A baggage request is not a confirmed purchase. No baggage fee is charged until a reliable airline/supplier price is confirmed.</div><div class="tfs-addon-bags">${bagRows(q.selection)}</div></article>
    <div class="tfs-trip-addons__summary"><span>Optional services added now</span><strong>$${q.addOnTotal.toFixed(2)} USD</strong></div>
  </div>`;
  host.querySelector('#tfs-flex-toggle')?.addEventListener('change', (e) => updateFlex(e.target.checked));
  host.querySelectorAll('[data-p]').forEach((el) => el.addEventListener('change', () => updateBag(parseInt(el.dataset.p, 10), el.dataset.d, el.value)));
}

function setText(node, text) { if (node && String(node.textContent || '').replace(/\s+/g, ' ').trim() !== text) node.textContent = text; }

function syncTotals(force = false) {
  if (!window.location.pathname.startsWith('/booking')) return;
  const q = quote(); const grand = money(ticketDue() + q.addOnTotal); const final = `$${grand.toFixed(2)} USD`;
  const totalRow = document.querySelector('.price-breakdown-section .price-row--total');
  if (totalRow?.parentElement) {
    let host = document.getElementById('tfs-trip-addons-sidebar');
    if (!host) { host = document.createElement('div'); host.id = 'tfs-trip-addons-sidebar'; totalRow.parentElement.insertBefore(host, totalRow); }
    const bagCount = q.selection.baggage.reduce((sum, b) => sum + b.quantity, 0);
    const sidebar = `${q.selection.flexAssist.selected ? `<div class="price-row tfs-addon-price-row"><span>Flex Assist (10%)</span><strong>+$${q.flexPrice.toFixed(2)}</strong></div>` : ''}${bagCount ? `<div class="price-row tfs-addon-price-row"><span>Checked baggage request (${bagCount})</span><strong>$0.00 now</strong></div>` : ''}`;
    if (force || host.dataset.signature !== sidebar) { host.dataset.signature = sidebar; host.innerHTML = sidebar; }
  }
  document.querySelectorAll('.price-total-amount,.booking-itinerary-pricing-summary__discounted').forEach((n) => setText(n, final));
  const mobile = document.querySelector('.mobile-summary-toggle-bar strong'); if (mobile && !String(mobile.textContent || '').includes(final)) setText(mobile, final);
  const button = document.querySelector('.amtrak-btn.amtrak-btn--cta.amtrak-btn--full');
  if (button && !/Securing|Processing/i.test(button.textContent || '')) setText(button.querySelector('span') || button, `🔒 Complete Secure Booking — ${final}`);
  const paymentHeader = document.getElementById('accordion-header-payment'); setText(paymentHeader?.querySelector('.accordion-section-title'), '5. Review & Payment');
  const badge = paymentHeader?.querySelector('.accordion-step-badge:not(.accordion-step-badge--complete)'); setText(badge, '5');
}

function parseSnapshot(notes) {
  const line = String(notes || '').split(/\r?\n/).find((x) => x.startsWith('TFS_TRIP_ADDONS_V1:'));
  try { return line ? JSON.parse(line.slice(19)) : null; } catch { return null; }
}

function summary(snapshot) {
  const bags = Array.isArray(snapshot?.baggage) ? snapshot.baggage : [];
  return `<div class="tfs-addon-admin-grid"><div><span>Flex Assist</span><strong>${snapshot?.flexAssist?.selected ? `ACTIVE · $${money(snapshot.flexAssist.price).toFixed(2)}` : 'Not selected'}</strong></div><div><span>Checked baggage</span><strong>${bags.length ? bags.map((b) => `P${b.travelerIndex + 1} ${b.direction}: ${b.quantity} requested`).join(' · ') : 'No request'}</strong></div></div>`;
}

async function adminSummary() {
  const m = window.location.pathname.match(/^\/admin\/bookings\/([^/]+)$/); const root = document.querySelector('.admin-booking-detail-route');
  if (!m || !root || document.getElementById('tfs-admin-trip-addons')) return;
  try {
    const r = await adminAPI.getBookingById(decodeURIComponent(m[1])); const b = r?.data?.booking || r?.booking || r?.data || r;
    const snap = b?.tripAddons || b?.trip_addons || parseSnapshot(b?.internal_notes || b?.internalNotes); if (!snap) return;
    const host = document.createElement('section'); host.id = 'tfs-admin-trip-addons'; host.className = 'tfs-admin-trip-addons'; host.innerHTML = `<h2>Trip Add-ons</h2>${summary(snap)}<p>Baggage marked REQUESTED still requires airline price and availability confirmation.</p>`; root.insertBefore(host, root.children[1] || null);
  } catch { /* no-op */ }
}

function confirmationSummary() {
  if (!window.location.pathname.startsWith('/booking-confirmed') || document.getElementById('tfs-confirmation-trip-addons')) return;
  const s = state(); if (!s.flexAssist.selected && !s.baggage.length) return; const target = document.querySelector('main .container'); if (!target) return;
  const q = quote(); const host = document.createElement('section'); host.id = 'tfs-confirmation-trip-addons'; host.className = 'tfs-confirmation-trip-addons'; host.innerHTML = `<h2>Your Trip Add-ons</h2>${summary({ ...s, flexAssist: { ...s.flexAssist, price: q.flexPrice } })}<p>Airline/supplier rules still apply. Baggage requests remain pending until confirmed.</p>`; target.appendChild(host);
}

let frame = null;
function schedule() {
  if (frame !== null) return;
  frame = requestAnimationFrame(() => { frame = null; render(); syncTotals(); adminSummary(); confirmationSummary(); });
}

export function installTripAddonsUX() {
  if (typeof window === 'undefined' || window.__tfsTripAddonsInstalled) return;
  window.__tfsTripAddonsInstalled = true; patchApis(); save(state()); schedule();
  const observer = new MutationObserver(schedule); observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => { setTimeout(syncTotals, 0); setTimeout(syncTotals, 120); }, true);
  document.addEventListener('change', () => { setTimeout(syncTotals, 0); setTimeout(syncTotals, 120); }, true);
}

export default installTripAddonsUX;
