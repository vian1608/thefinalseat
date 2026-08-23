import { bookingAPI, adminAPI } from '../../../shared/api/api';
import journeySessionAPI from '../../../shared/api/journeySessionApi';

const STORAGE_KEY = 'tfsTripAddons';
const FLEX_RATE = 0.10;
const MAX_BAGS = 3;
let originalJourneyUpdate = null;
let persistTimer = null;

function money(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function readJson(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeState(state) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* best effort */ }
}

function passengerCount() {
  const search = readJson('searchParams', {});
  const total = (parseInt(search?.adults || 1, 10) || 0)
    + (parseInt(search?.children || 0, 10) || 0)
    + (parseInt(search?.infants || 0, 10) || 0);
  return Math.max(1, total);
}

function flightPrice(flight) {
  const candidates = [flight?.price?.finalPrice, flight?.price?.total, flight?.price?.customerPrice, flight?.finalPrice, flight?.totalPrice, flight?.price];
  for (const value of candidates) {
    const n = money(value);
    if (n > 0) return n;
  }
  return 0;
}

function ticketBase() {
  const out = readJson('selectedFlight', null);
  const ret = readJson('returnFlight', null) || readJson('selectedReturnFlight', null);
  return money((flightPrice(out) + flightPrice(ret)) * passengerCount());
}

function hasReturn() {
  return Boolean(readJson('returnFlight', null) || readJson('selectedReturnFlight', null));
}

function normalizeState(raw = null) {
  const source = raw || readJson(STORAGE_KEY, {}) || {};
  const baggage = Array.isArray(source.baggage) ? source.baggage : [];
  return {
    version: 'TRIP_ADDONS_V1',
    flexAssist: { selected: source?.flexAssist?.selected === true },
    baggage: baggage
      .map((item) => ({
        travelerIndex: Math.max(0, parseInt(item?.travelerIndex, 10) || 0),
        direction: String(item?.direction || 'OUTBOUND').toUpperCase(),
        quantity: Math.min(MAX_BAGS, Math.max(0, parseInt(item?.quantity, 10) || 0)),
      }))
      .filter((item) => item.quantity > 0 && ['OUTBOUND', 'RETURN'].includes(item.direction)),
  };
}

function currentQuote() {
  const state = normalizeState();
  const base = ticketBase();
  const flexPrice = state.flexAssist.selected ? money(base * FLEX_RATE) : 0;
  return { state, base, flexPrice, addOnTotal: flexPrice };
}

function currentTicketDue() {
  const voucher = readJson('tfsAppliedVoucher', null);
  const voucherFinal = money(voucher?.finalPrice);
  return voucherFinal > 0 ? voucherFinal : ticketBase();
}

function checkoutToken() {
  return sessionStorage.getItem('checkoutSessionToken') || window.location.pathname.match(/^\/booking\/(c_[A-Za-z0-9_-]+)/)?.[1] || null;
}

function setBaggageQuantity(travelerIndex, direction, quantity) {
  const state = normalizeState();
  const key = `${travelerIndex}:${direction}`;
  const map = new Map(state.baggage.map((item) => [`${item.travelerIndex}:${item.direction}`, item]));
  const q = Math.min(MAX_BAGS, Math.max(0, parseInt(quantity, 10) || 0));
  if (q > 0) map.set(key, { travelerIndex, direction, quantity: q });
  else map.delete(key);
  state.baggage = Array.from(map.values());
  writeState(state);
  schedulePersist();
  renderCheckoutPanel();
  syncTotals();
}

function setFlex(selected) {
  const state = normalizeState();
  state.flexAssist.selected = Boolean(selected);
  writeState(state);
  schedulePersist();
  renderCheckoutPanel();
  syncTotals();
}

async function persistNow() {
  const token = checkoutToken();
  if (!token) return;
  const response = await journeySessionAPI.getCheckout(token);
  const payload = response?.data?.payload || response?.payload || {};
  const updater = originalJourneyUpdate || journeySessionAPI.updateCheckout.bind(journeySessionAPI);
  await updater(token, { payload: { ...payload, addons: normalizeState() } });
}

function schedulePersist() {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => persistNow().catch(() => {/* submit bridge will retry */}), 450);
}

function patchJourneyPersistence() {
  if (journeySessionAPI.__tfsTripAddonsPersistence) return;
  originalJourneyUpdate = journeySessionAPI.updateCheckout.bind(journeySessionAPI);
  journeySessionAPI.updateCheckout = (token, patch = {}) => {
    if (!patch?.payload || typeof patch.payload !== 'object') return originalJourneyUpdate(token, patch);
    return originalJourneyUpdate(token, { ...patch, payload: { ...patch.payload, addons: normalizeState() } });
  };
  Object.defineProperty(journeySessionAPI, '__tfsTripAddonsPersistence', { value: true });
}

function patchBookingSubmit() {
  if (bookingAPI.__tfsTripAddonsSubmit) return;
  const originalCreate = bookingAPI.create.bind(bookingAPI);
  bookingAPI.create = async (bookingData = {}) => {
    const token = checkoutToken();
    if (!token || !window.location.pathname.startsWith('/booking')) return originalCreate(bookingData);

    await persistNow();
    const quote = currentQuote();
    const ticketComponent = money(bookingData.customer_price || bookingData.customerPrice || bookingData.displayedWebsitePrice || quote.base);
    const finalTotal = money(ticketComponent + quote.addOnTotal);

    return originalCreate({
      ...bookingData,
      customer_price: finalTotal,
      customerPrice: finalTotal,
      displayedWebsitePrice: finalTotal,
      displayedPrice: finalTotal,
      price: finalTotal,
      total_amount: finalTotal,
      ticket_component_total: ticketComponent,
      add_on_total: quote.addOnTotal,
      flex_assist_fee: quote.flexPrice,
      trip_addons: quote.state,
    });
  };
  Object.defineProperty(bookingAPI, '__tfsTripAddonsSubmit', { value: true });
}

function quantityFor(state, travelerIndex, direction) {
  return state.baggage.find((item) => item.travelerIndex === travelerIndex && item.direction === direction)?.quantity || 0;
}

function bagRows(state) {
  const directions = hasReturn() ? ['OUTBOUND', 'RETURN'] : ['OUTBOUND'];
  let html = '';
  for (let traveler = 0; traveler < passengerCount(); traveler += 1) {
    directions.forEach((direction) => {
      const q = quantityFor(state, traveler, direction);
      html += `<div class="tfs-addon-bag-row">
        <div><strong>Passenger #${traveler + 1}</strong><span>${direction === 'RETURN' ? 'Return journey' : 'Outbound journey'} · up to 23 kg / 50 lb per requested bag</span></div>
        <label>Checked bags
          <select data-tfs-bag-traveler="${traveler}" data-tfs-bag-direction="${direction}">
            ${[0,1,2,3].map((value) => `<option value="${value}"${q === value ? ' selected' : ''}>${value}</option>`).join('')}
          </select>
        </label>
      </div>`;
    });
  }
  return html;
}

function ensureCheckoutHost() {
  if (!window.location.pathname.startsWith('/booking')) return null;
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

function renderCheckoutPanel() {
  const host = ensureCheckoutHost();
  if (!host) return;
  const quote = currentQuote();
  const state = quote.state;
  host.innerHTML = `
    <div class="tfs-trip-addons__header">
      <span class="accordion-step-badge">4</span>
      <div><span class="tfs-trip-addons__eyebrow">OPTIONAL TRIP SERVICES</span><h2>Customize Your Trip</h2></div>
    </div>
    <div class="tfs-trip-addons__body">
      <article class="tfs-addon-card tfs-addon-card--flex">
        <div class="tfs-addon-card__top"><div><span class="tfs-addon-icon">↻</span><h3>Flex Assist</h3></div><strong>+ $${quote.flexPrice.toFixed(2)}</strong></div>
        <p>Get additional help if your travel plans change. We will actively assist with eligible date or flight changes and available alternatives.</p>
        <ul><li>Priority change assistance</li><li>Alternative-flight and date support</li><li>Dedicated rebooking servicing</li></ul>
        <div class="tfs-addon-warning"><strong>Important:</strong> Flex Assist is an agency service, not travel insurance and not an airline flexible fare. Airline fare differences, taxes, penalties, availability and fare rules may still apply. Changes are not guaranteed.</div>
        <label class="tfs-addon-toggle"><input id="tfs-flex-assist-toggle" type="checkbox" ${state.flexAssist.selected ? 'checked' : ''}><span><strong>Add Flex Assist</strong><small>10% of the ticket selling price (${quote.base.toFixed(2)} × 10%)</small></span><b>$${money(quote.base * FLEX_RATE).toFixed(2)}</b></label>
      </article>

      <article class="tfs-addon-card">
        <div class="tfs-addon-card__top"><div><span class="tfs-addon-icon">🧳</span><h3>Checked Baggage Request</h3></div><strong>$0.00 now</strong></div>
        <p>Tell us how many additional checked bags you would like. We will confirm airline eligibility and the exact supplier baggage fee before ticketing.</p>
        <div class="tfs-addon-warning tfs-addon-warning--neutral">No baggage fee is charged at this step because the current flight source does not provide a reliable ancillary price. A request is not a confirmed baggage purchase.</div>
        <div class="tfs-addon-bags">${bagRows(state)}</div>
      </article>

      <div class="tfs-trip-addons__summary"><span>Optional services added now</span><strong>$${quote.addOnTotal.toFixed(2)} USD</strong></div>
    </div>`;

  host.querySelector('#tfs-flex-assist-toggle')?.addEventListener('change', (event) => setFlex(event.target.checked));
  host.querySelectorAll('[data-tfs-bag-traveler]').forEach((select) => {
    select.addEventListener('change', () => setBaggageQuantity(
      parseInt(select.dataset.tfsBagTraveler, 10),
      select.dataset.tfsBagDirection,
      select.value,
    ));
  });
}

function ensureSidebarRows() {
  const totalRow = document.querySelector('.price-breakdown-section .price-row--total');
  if (!totalRow?.parentElement) return null;
  let host = document.getElementById('tfs-trip-addons-sidebar');
  if (!host?.isConnected) {
    host = document.createElement('div');
    host.id = 'tfs-trip-addons-sidebar';
    totalRow.parentElement.insertBefore(host, totalRow);
  }
  return host;
}

function syncTotals() {
  if (!window.location.pathname.startsWith('/booking')) return;
  const quote = currentQuote();
  const ticketDue = currentTicketDue();
  const grand = money(ticketDue + quote.addOnTotal);
  const finalText = `$${grand.toFixed(2)} USD`;

  const host = ensureSidebarRows();
  if (host) {
    const requestedBags = quote.state.baggage.reduce((sum, item) => sum + item.quantity, 0);
    host.innerHTML = `${quote.state.flexAssist.selected ? `<div class="price-row tfs-addon-price-row"><span>Flex Assist (10%)</span><strong>+$${quote.flexPrice.toFixed(2)}</strong></div>` : ''}
      ${requestedBags ? `<div class="price-row tfs-addon-price-row"><span>Checked baggage request (${requestedBags})</span><strong>$0.00 now</strong></div>` : ''}`;
  }

  document.querySelectorAll('.price-total-amount, .booking-itinerary-pricing-summary__discounted').forEach((node) => { node.textContent = finalText; });
  const mobile = document.querySelector('.mobile-summary-toggle-bar strong');
  if (mobile) {
    const icon = mobile.querySelector('i')?.cloneNode(true) || null;
    mobile.textContent = finalText;
    if (icon) mobile.append(' ', icon);
  }
  const button = document.querySelector('.amtrak-btn.amtrak-btn--cta.amtrak-btn--full');
  if (button && !/Securing|Processing/i.test(button.textContent || '')) {
    const label = button.querySelector('span') || button;
    label.textContent = `🔒 Complete Secure Booking — ${finalText}`;
  }

  const paymentHeader = document.getElementById('accordion-header-payment');
  const title = paymentHeader?.querySelector('.accordion-section-title');
  if (title) title.textContent = '5. Review & Payment';
  const badge = paymentHeader?.querySelector('.accordion-step-badge:not(.accordion-step-badge--complete)');
  if (badge) badge.textContent = '5';
}

function parseSnapshot(notes) {
  const line = String(notes || '').split(/\r?\n/).find((item) => item.startsWith('TFS_TRIP_ADDONS_V1:'));
  if (!line) return null;
  try { return JSON.parse(line.slice('TFS_TRIP_ADDONS_V1:'.length)); } catch { return null; }
}

function addonSummaryHtml(snapshot) {
  if (!snapshot) return '';
  const flex = snapshot?.flexAssist?.selected;
  const bags = Array.isArray(snapshot?.baggage) ? snapshot.baggage : [];
  return `<div class="tfs-addon-admin-grid">
    <div><span>Flex Assist</span><strong>${flex ? `ACTIVE · $${money(snapshot.flexAssist.price).toFixed(2)}` : 'Not selected'}</strong></div>
    <div><span>Checked baggage</span><strong>${bags.length ? bags.map((b) => `P${b.travelerIndex + 1} ${b.direction}: ${b.quantity} requested`).join(' · ') : 'No request'}</strong></div>
  </div>`;
}

async function installAdminSummary() {
  const match = window.location.pathname.match(/^\/admin\/bookings\/([^/]+)$/);
  if (!match || document.getElementById('tfs-admin-trip-addons')) return;
  const root = document.querySelector('.admin-booking-detail-route');
  if (!root) return;
  try {
    const response = await adminAPI.getBookingById(decodeURIComponent(match[1]));
    const booking = response?.data?.booking || response?.booking || response?.data || response;
    const snapshot = booking?.tripAddons || booking?.trip_addons || parseSnapshot(booking?.internal_notes || booking?.internalNotes);
    if (!snapshot) return;
    const host = document.createElement('section');
    host.id = 'tfs-admin-trip-addons';
    host.className = 'tfs-admin-trip-addons';
    host.innerHTML = `<h2>Trip Add-ons</h2>${addonSummaryHtml(snapshot)}<p>Baggage marked REQUESTED still requires airline price/availability confirmation before purchase.</p>`;
    root.insertBefore(host, root.children[1] || null);
  } catch { /* existing admin panels remain authoritative */ }
}

function installConfirmationSummary() {
  if (!window.location.pathname.startsWith('/booking-confirmed') || document.getElementById('tfs-confirmation-trip-addons')) return;
  const state = normalizeState();
  if (!state.flexAssist.selected && !state.baggage.length) return;
  const target = document.querySelector('main .container');
  if (!target) return;
  const quote = currentQuote();
  const host = document.createElement('section');
  host.id = 'tfs-confirmation-trip-addons';
  host.className = 'tfs-confirmation-trip-addons';
  host.innerHTML = `<h2>Your Trip Add-ons</h2>${addonSummaryHtml({ ...state, flexAssist: { ...state.flexAssist, price: quote.flexPrice } })}<p>Flex Assist terms and airline/supplier rules continue to apply. Baggage requests are not confirmed until we provide the airline fee and confirmation.</p>`;
  target.appendChild(host);
}

function scheduleSync() {
  window.requestAnimationFrame(() => {
    renderCheckoutPanel();
    syncTotals();
    installAdminSummary();
    installConfirmationSummary();
  });
}

export function installTripAddonsUX() {
  if (typeof window === 'undefined' || window.__tfsTripAddonsInstalled) return;
  window.__tfsTripAddonsInstalled = true;
  patchJourneyPersistence();
  patchBookingSubmit();
  writeState(normalizeState());

  scheduleSync();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => { window.setTimeout(syncTotals, 0); window.setTimeout(syncTotals, 120); }, true);
  document.addEventListener('change', () => { window.setTimeout(syncTotals, 0); window.setTimeout(syncTotals, 120); }, true);
}

export default installTripAddonsUX;
