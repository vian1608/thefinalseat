const FLEX_TYPES = [
  ['TRAVEL_DATE', 'Travel date'],
  ['FLIGHT_TIME', 'Flight time'],
  ['FLIGHT', 'Flight'],
  ['DESTINATION', 'Destination'],
  ['OTHER', 'Other'],
];
const ADMIN_STATUSES = ['REQUESTED','REVIEWING','OPTION_FOUND','CUSTOMER_APPROVAL','REBOOKING','COMPLETED','DECLINED','CANCELLED'];
const cache = new Map();
let observer = null;
let timer = null;

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function readEmail() {
  const candidates = ['contactInfo','contact','bookingContact','travelerContact'];
  for (const key of candidates) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const value = JSON.parse(raw);
      const email = value?.email || value?.contactEmail;
      if (email) return String(email).trim();
    } catch { /* continue */ }
  }
  return '';
}

async function publicAddons(reference) {
  if (!cache.has(reference)) {
    cache.set(reference, fetch(`/api/bookings/${encodeURIComponent(reference)}/trip-addons`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => ok && body?.success ? (body.data || body.tripAddons) : null)
      .catch(() => null));
  }
  return cache.get(reference);
}

function statusLabel(status) {
  return String(status || 'REQUESTED').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

async function loadCustomerRequests(reference, email) {
  if (!email) return [];
  const response = await fetch(`/api/bookings/${encodeURIComponent(reference)}/trip-addons/flex/change-requests?email=${encodeURIComponent(email)}`, { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.success) return [];
  return Array.isArray(body.data) ? body.data : [];
}

function requestListHtml(rows = []) {
  if (!rows.length) return '<p class="tfs-flex-empty">No Flex Assist change requests yet.</p>';
  return `<div class="tfs-flex-request-list">${rows.map((row) => `<div class="tfs-flex-request-row"><div><strong>${escapeHtml(statusLabel(row.requestType))}</strong><span>${escapeHtml(row.requestedDetails?.notes || row.requestedDetails?.requestedDate || 'Change request')}</span></div><b>${escapeHtml(statusLabel(row.status))}</b></div>`).join('')}</div>`;
}

async function enhanceMyBookings() {
  if (!window.location.pathname.startsWith('/my-bookings')) return;
  const cards = [...document.querySelectorAll('.booking-card-item')];
  for (const card of cards) {
    if (card.dataset.tfsFlexEnhanced === 'done' || card.dataset.tfsFlexEnhanced === 'loading') continue;
    const reference = String(card.querySelector('.ref-value')?.textContent || '').trim();
    if (!reference || reference === 'N/A') continue;
    card.dataset.tfsFlexEnhanced = 'loading';
    const addons = await publicAddons(reference);
    if (!addons?.flexAssist?.selected) { card.dataset.tfsFlexEnhanced = 'done'; continue; }

    const body = card.querySelector('.booking-card-body') || card;
    const host = document.createElement('section');
    host.className = 'tfs-flex-my-booking';
    host.innerHTML = `<div class="tfs-flex-my-booking__head"><div><i class="fas fa-retweet"></i><strong>Flex Assist</strong><span>${escapeHtml(statusLabel(addons.flexAssist.status || 'ACTIVE'))} · $${Number(addons.flexAssist.price || 0).toFixed(2)}</span></div><button type="button" class="tfs-flex-request-button">Request a Change</button></div>
      <p>Priority change and rebooking assistance is active. Airline fare differences, penalties, taxes, availability and fare rules may still apply.</p>
      <div class="tfs-flex-request-panel" hidden>
        <label>Booking email<input type="email" name="email" value="${escapeHtml(readEmail())}" placeholder="Email used for this booking" autocomplete="email"></label>
        <label>What would you like to change?<select name="requestType">${FLEX_TYPES.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label>Requested change<textarea name="notes" rows="3" placeholder="Example: Move my departure from Aug 28 to Aug 30"></textarea></label>
        <div class="tfs-flex-request-actions"><button type="button" data-flex-submit>Submit Flex Request</button><button type="button" data-flex-cancel>Cancel</button></div>
        <span class="tfs-flex-request-message" aria-live="polite"></span>
        <div class="tfs-flex-existing-requests"></div>
      </div>`;
    body.appendChild(host);
    const panel = host.querySelector('.tfs-flex-request-panel');
    const emailInput = host.querySelector('[name="email"]');
    const existing = host.querySelector('.tfs-flex-existing-requests');
    const message = host.querySelector('.tfs-flex-request-message');

    const refresh = async () => {
      const rows = await loadCustomerRequests(reference, emailInput.value.trim());
      existing.innerHTML = requestListHtml(rows);
    };
    host.querySelector('.tfs-flex-request-button').addEventListener('click', async () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) await refresh();
    });
    host.querySelector('[data-flex-cancel]').addEventListener('click', () => { panel.hidden = true; });
    host.querySelector('[data-flex-submit]').addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const requestType = host.querySelector('[name="requestType"]').value;
      const notes = host.querySelector('[name="notes"]').value.trim();
      if (!email || !notes) { message.textContent = 'Enter the booking email and requested change.'; return; }
      message.textContent = 'Submitting…';
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(reference)}/trip-addons/flex/change-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email, requestType, requestedDetails: { notes } }),
        });
        const bodyJson = await response.json().catch(() => ({}));
        if (!response.ok || !bodyJson?.success) throw new Error(bodyJson?.error?.message || 'Unable to submit Flex request.');
        host.querySelector('[name="notes"]').value = '';
        message.textContent = 'Flex Assist change request submitted.';
        await refresh();
      } catch (error) { message.textContent = error.message; }
    });
    emailInput.addEventListener('change', refresh);
    card.dataset.tfsFlexEnhanced = 'done';
  }
}

function adminHeaders() {
  const token = localStorage.getItem('token');
  return { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function enhanceAdmin() {
  const match = window.location.pathname.match(/^\/admin\/bookings\/([^/]+)$/);
  if (!match || document.getElementById('tfs-flex-admin-workflow')) return;
  const root = document.querySelector('.admin-booking-detail-route');
  if (!root) return;
  const reference = decodeURIComponent(match[1]);
  const addonResponse = await fetch(`/api/admin/bookings/${encodeURIComponent(reference)}/trip-addons`, { headers: adminHeaders() }).catch(() => null);
  const addonBody = addonResponse ? await addonResponse.json().catch(() => ({})) : {};
  const addons = addonBody?.data?.tripAddons || addonBody?.data || {};
  if (!addons?.flexAssist?.selected) return;

  const requestResponse = await fetch(`/api/admin/bookings/${encodeURIComponent(reference)}/trip-addons/flex/change-requests`, { headers: adminHeaders() }).catch(() => null);
  const requestBody = requestResponse ? await requestResponse.json().catch(() => ({})) : {};
  const rows = Array.isArray(requestBody?.data) ? requestBody.data : [];
  const host = document.createElement('section');
  host.id = 'tfs-flex-admin-workflow';
  host.className = 'tfs-flex-admin-workflow';
  host.innerHTML = `<div class="tfs-flex-admin-head"><div><span>FLEX ASSIST</span><h2>Change Requests</h2></div><strong>${escapeHtml(statusLabel(addons.flexAssist.status || 'ACTIVE'))} · $${Number(addons.flexAssist.price || 0).toFixed(2)}</strong></div>
    ${rows.length ? rows.map((row) => `<article class="tfs-flex-admin-row" data-flex-id="${escapeHtml(row.id)}"><div><strong>${escapeHtml(statusLabel(row.request_type))}</strong><p>${escapeHtml(row.requested_details?.notes || 'No details')}</p><small>${escapeHtml(new Date(row.created_at).toLocaleString())}</small></div><label>Status<select>${ADMIN_STATUSES.map((s) => `<option value="${s}"${s === row.status ? ' selected' : ''}>${statusLabel(s)}</option>`).join('')}</select></label><label>Admin notes<textarea rows="2">${escapeHtml(row.admin_notes || '')}</textarea></label><button type="button">Save</button><span></span></article>`).join('') : '<p>No Flex Assist change requests have been submitted.</p>'}`;
  const anchor = document.getElementById('tfs-admin-trip-addons');
  if (anchor?.nextSibling) root.insertBefore(host, anchor.nextSibling); else root.appendChild(host);

  host.querySelectorAll('[data-flex-id]').forEach((row) => row.querySelector('button').addEventListener('click', async () => {
    const message = row.querySelector('span');
    message.textContent = 'Saving…';
    const response = await fetch(`/api/admin/bookings/${encodeURIComponent(reference)}/trip-addons/flex/change-requests/${encodeURIComponent(row.dataset.flexId)}`, {
      method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ status: row.querySelector('select').value, adminNotes: row.querySelector('textarea').value }),
    });
    const bodyJson = await response.json().catch(() => ({}));
    message.textContent = response.ok && bodyJson?.success ? 'Saved.' : (bodyJson?.error?.message || 'Unable to save.');
  }));
}

function schedule() {
  clearTimeout(timer);
  timer = window.setTimeout(() => { enhanceMyBookings().catch(() => {}); enhanceAdmin().catch(() => {}); }, 120);
}

export function installFlexAssistWorkflowUX() {
  if (typeof window === 'undefined' || window.__tfsFlexAssistWorkflowInstalled) return;
  window.__tfsFlexAssistWorkflowInstalled = true;
  schedule();
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export default installFlexAssistWorkflowUX;
