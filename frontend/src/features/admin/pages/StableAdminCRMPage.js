import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import './StableAdminCRMPage.css';

const emptyPricing = {
  supplierFare: '0.00',
  taxes: '0.00',
  customerTotal: '0.00',
  reason: ''
};

const emptyTicket = {
  airlineName: '',
  airlineCode: '',
  airlineConfirmationNumber: '',
  ticketNumber: '',
  ticketIssuedAt: '',
  ticketNotes: '',
  supplierConfirmation: ''
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const money = (value, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: (currency || 'USD').toUpperCase()
}).format(toNumber(value));

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};

const friendlyStatus = (status) => String(status || 'NOT_SENT')
  .toLowerCase()
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getApiError = (payload, fallback) => (
  payload?.error?.message || payload?.message || fallback
);

async function crmRequest(path, options = {}) {
  const token = localStorage.getItem('token');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs || 20000);

  try {
    const response = await fetch(path, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });

    const rawText = await response.text();
    let payload = null;
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.success) {
      const reference = payload?.requestId ? ` Reference: ${payload.requestId}` : '';
      throw new Error(`${getApiError(payload, `CRM request failed with HTTP ${response.status}.`)}${reference}`);
    }

    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The CRM request timed out after 20 seconds. No automatic retry was sent.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function ResultMessage({ result }) {
  if (!result?.message) return null;
  return (
    <div className={`stable-result stable-result--${result.type || 'info'}`} role="status">
      {result.message}
    </div>
  );
}

function EmailCard({ title, activity, type, disabledReason, onSend, loading }) {
  const status = activity?.status || 'NOT_SENT';
  const wasSent = ['SENT', 'DELIVERED', 'ACCEPTED', 'AWAITING_PASSENGER'].includes(String(status).toUpperCase());
  const buttonText = loading
    ? `Sending ${title}…`
    : `${wasSent ? 'Resend' : 'Send'} ${title}`;

  return (
    <article className="stable-email-card">
      <div className="stable-email-card__header">
        <h4>{title}</h4>
        <span className={`stable-status stable-status--${String(status).toLowerCase()}`}>
          {friendlyStatus(status)}
        </span>
      </div>
      <dl className="stable-email-meta">
        <div><dt>Recipient</dt><dd>{activity?.recipient || 'N/A'}</dd></div>
        <div><dt>Sent</dt><dd>{formatDateTime(activity?.sentAt)}</dd></div>
        {'expiresAt' in (activity || {}) && (
          <div><dt>Expires</dt><dd>{formatDateTime(activity?.expiresAt)}</dd></div>
        )}
        <div><dt>Provider ID</dt><dd>{activity?.providerMessageId || 'N/A'}</dd></div>
      </dl>
      {activity?.error && <div className="stable-inline-error">{activity.error}</div>}
      <button
        type="button"
        className="stable-btn stable-btn--primary stable-btn--full"
        onClick={() => onSend(type, wasSent)}
        disabled={loading || Boolean(disabledReason)}
        aria-busy={loading}
      >
        {buttonText}
      </button>
      {disabledReason && <p className="stable-help">{disabledReason}</p>}
    </article>
  );
}

function StableAdminCRMPage() {
  const navigate = useNavigate();
  const { code } = useParams();

  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const [pricingForm, setPricingForm] = useState(emptyPricing);
  const [paymentStatus, setPaymentStatus] = useState('PENDING');
  const [paymentSplits, setPaymentSplits] = useState([]);
  const [transactionReference, setTransactionReference] = useState('');
  const [statusForm, setStatusForm] = useState({ status: 'PENDING', internalNotes: '' });
  const [ticketForm, setTicketForm] = useState(emptyTicket);

  const [saving, setSaving] = useState({ pricing: false, payment: false, status: false, ticket: false });
  const [results, setResults] = useState({});
  const [emailLoading, setEmailLoading] = useState({});

  const hydrateForms = useCallback((booking) => {
    const pricing = booking?.pricing || {};
    setPricingForm({
      supplierFare: toNumber(pricing.supplierFare ?? booking?.supplier_fare).toFixed(2),
      taxes: toNumber(pricing.taxes ?? booking?.taxes_and_fees).toFixed(2),
      customerTotal: toNumber(pricing.customerTotal ?? booking?.customer_price ?? booking?.total_amount).toFixed(2),
      reason: ''
    });

    const splits = booking?.paymentSplits || booking?.payment_splits || [];
    setPaymentSplits(splits.length > 0
      ? splits.map((split, index) => ({
          id: split.id || `split-${index}`,
          merchantName: split.merchantName || split.merchant_name || '',
          amount: toNumber(split.amount).toFixed(2)
        }))
      : [{ id: `split-${Date.now()}`, merchantName: '', amount: '' }]);

    setPaymentStatus(String(booking?.payment_status || booking?.payment?.status || 'PENDING').toUpperCase());
    setTransactionReference(booking?.transaction_reference || booking?.payment?.transactionReference || '');
    setStatusForm({
      status: String(booking?.status || 'PENDING').toUpperCase(),
      internalNotes: booking?.internal_notes || booking?.internalNotes || ''
    });
    setTicketForm({
      airlineName: booking?.airline_name || booking?.airlineName || '',
      airlineCode: booking?.airline_code || booking?.airlineCode || '',
      airlineConfirmationNumber: booking?.airline_confirmation_number || booking?.airlineConfirmationNumber || booking?.pnr || '',
      ticketNumber: booking?.ticket_number || booking?.ticketNumber || '',
      ticketIssuedAt: booking?.ticket_issued_at ? String(booking.ticket_issued_at).slice(0, 10) : '',
      ticketNotes: booking?.ticket_notes || booking?.ticketNotes || '',
      supplierConfirmation: booking?.supplier_confirmation || booking?.supplierConfirmation || ''
    });
  }, []);

  const loadBookings = useCallback(async ({ targetPage = page, term = search } = {}) => {
    setLoadingList(true);
    setListError('');
    try {
      const payload = await crmRequest(`/api/admin/stable/bookings?page=${targetPage}&pageSize=25&search=${encodeURIComponent(term)}`);
      setBookings(payload.bookings || payload.data?.bookings || []);
      setPagination(payload.pagination || payload.data?.pagination || { page: targetPage, totalPages: 1, total: 0 });
    } catch (error) {
      setListError(error.message);
      if (/401|unauthorized|token/i.test(error.message)) navigate('/admin/login');
    } finally {
      setLoadingList(false);
    }
  }, [navigate, page, search]);

  const loadBooking = useCallback(async (identifier, { quiet = false } = {}) => {
    if (!identifier) return;
    if (!quiet) setLoadingBooking(true);
    setResults({});
    try {
      const payload = await crmRequest(`/api/admin/stable/bookings/${encodeURIComponent(identifier)}`);
      const booking = payload.booking || payload.data;
      setSelectedBooking(booking);
      hydrateForms(booking);
      setBookings((current) => current.map((row) => row.id === booking.id ? { ...row, ...booking } : row));
    } catch (error) {
      setResults({ general: { type: 'error', message: error.message } });
    } finally {
      if (!quiet) setLoadingBooking(false);
    }
  }, [hydrateForms]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const session = sessionStorage.getItem('adminSession');
    if (!token || !session) {
      navigate('/admin/login');
      return;
    }
    loadBookings({ targetPage: 1 });
  }, [loadBookings, navigate]);

  useEffect(() => {
    if (code) loadBooking(code);
  }, [code, loadBooking]);

  const agencyMarkup = useMemo(() => (
    toNumber(pricingForm.customerTotal) - toNumber(pricingForm.supplierFare) - toNumber(pricingForm.taxes)
  ), [pricingForm]);

  const splitTotal = useMemo(() => paymentSplits.reduce(
    (sum, split) => sum + toNumber(split.amount),
    0
  ), [paymentSplits]);

  const bookingTotal = toNumber(selectedBooking?.pricing?.customerTotal ?? selectedBooking?.customer_price ?? selectedBooking?.total_amount);
  const currency = selectedBooking?.currency || selectedBooking?.pricing?.currency || 'USD';

  const updateResult = (section, type, message) => {
    setResults((current) => ({ ...current, [section]: { type, message } }));
  };

  const saveSection = async (section, path, body, successMessage) => {
    if (!selectedBooking?.id || saving[section]) return;
    setSaving((current) => ({ ...current, [section]: true }));
    updateResult(section, 'info', 'Saving and verifying with Supabase…');
    try {
      const payload = await crmRequest(`/api/admin/stable/bookings/${selectedBooking.id}/${path}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      const booking = payload.booking || payload.data;
      setSelectedBooking(booking);
      hydrateForms(booking);
      setBookings((current) => current.map((row) => row.id === booking.id ? { ...row, ...booking } : row));
      updateResult(section, 'success', successMessage || payload.message || 'Saved and verified.');
    } catch (error) {
      updateResult(section, 'error', error.message);
    } finally {
      setSaving((current) => ({ ...current, [section]: false }));
    }
  };

  const handleSavePricing = () => saveSection('pricing', 'pricing', {
    supplierFare: toNumber(pricingForm.supplierFare),
    taxesAndFees: toNumber(pricingForm.taxes),
    agencyMarkup,
    customerTotal: toNumber(pricingForm.customerTotal),
    currency,
    reason: pricingForm.reason
  }, 'Pricing saved permanently to Supabase and verified.');

  const handleSavePayment = () => saveSection('payment', 'payment', {
    paymentState: paymentStatus,
    transactionReference,
    splits: paymentSplits.map((split) => ({
      merchantName: split.merchantName.trim(),
      amount: toNumber(split.amount),
      currency
    }))
  }, 'Payment splits saved permanently to Supabase and verified.');

  const handleSaveStatus = () => saveSection('status', 'status', statusForm, 'Booking status and notes saved.');

  const handleSaveTicket = () => saveSection('ticket', 'ticket', ticketForm, 'Ticket details saved and verified.');

  const handleEmail = async (type, wasSent) => {
    if (!selectedBooking?.id || emailLoading[type]) return;
    setEmailLoading((current) => ({ ...current, [type]: true }));
    updateResult(`email-${type}`, 'info', 'Sending email and checking delivery record…');
    try {
      const payload = await crmRequest(`/api/admin/stable/bookings/${selectedBooking.id}/emails/${type}`, {
        method: 'POST',
        body: JSON.stringify({ force: wasSent })
      });
      const booking = payload.booking || payload.data;
      setSelectedBooking(booking);
      hydrateForms(booking);
      updateResult(`email-${type}`, 'success', payload.message || 'Email sent and verified.');
    } catch (error) {
      updateResult(`email-${type}`, 'error', error.message);
    } finally {
      setEmailLoading((current) => ({ ...current, [type]: false }));
    }
  };

  const addSplit = () => setPaymentSplits((current) => [
    ...current,
    { id: `split-${Date.now()}-${current.length}`, merchantName: '', amount: '' }
  ]);

  const updateSplit = (id, field, value) => setPaymentSplits((current) => current.map(
    (split) => split.id === id ? { ...split, [field]: value } : split
  ));

  const removeSplit = (id) => setPaymentSplits((current) => current.length === 1
    ? current
    : current.filter((split) => split.id !== id));

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setPage(1);
    loadBookings({ targetPage: 1, term: search });
  };

  const goToPage = (nextPage) => {
    const bounded = Math.max(1, Math.min(pagination.totalPages || 1, nextPage));
    setPage(bounded);
    loadBookings({ targetPage: bounded });
  };

  const logout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('adminSession');
    navigate('/admin/login');
  };

  const emailActivity = selectedBooking?.emailActivity || {};
  const itinerarySegments = selectedBooking?.flights || selectedBooking?.itinerary_segments || [];
  const pnr = ticketForm.airlineConfirmationNumber.trim();
  const integrity = selectedBooking?.financialIntegrity;

  return (
    <div className="stable-crm">
      <Helmet><title>Stable CRM | The Final Seat</title></Helmet>

      <header className="stable-crm__topbar">
        <div>
          <p className="stable-eyebrow">THE FINAL SEAT</p>
          <h1>Booking CRM</h1>
          <p>Database-first editing with independent verified saves.</p>
        </div>
        <div className="stable-topbar-actions">
          <button type="button" className="stable-btn stable-btn--secondary" onClick={() => navigate('/admin/legacy-dashboard')}>Legacy Dashboard</button>
          <button type="button" className="stable-btn stable-btn--secondary" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="stable-crm__layout">
        <aside className="stable-booking-list">
          <form className="stable-search" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Reference, passenger, or email"
              aria-label="Search bookings"
            />
            <button type="submit" className="stable-btn stable-btn--primary">Search</button>
          </form>

          <div className="stable-list-heading">
            <strong>{pagination.total || bookings.length} bookings</strong>
            <button type="button" className="stable-link-btn" onClick={() => loadBookings({ targetPage: page })}>Refresh</button>
          </div>

          {listError && <div className="stable-inline-error">{listError}</div>}
          {loadingList ? (
            <div className="stable-loading">Loading bookings…</div>
          ) : (
            <div className="stable-booking-items">
              {bookings.map((booking) => (
                <button
                  type="button"
                  key={booking.id}
                  className={`stable-booking-item ${selectedBooking?.id === booking.id ? 'is-selected' : ''}`}
                  onClick={() => loadBooking(booking.id)}
                >
                  <div className="stable-booking-item__top">
                    <strong>{booking.confirmation_code || booking.confirmationCode}</strong>
                    <span>{money(booking.customer_price ?? booking.total_amount ?? booking.amount, booking.currency)}</span>
                  </div>
                  <span>{booking.passenger_name || booking.customerName || 'Unknown passenger'}</span>
                  <small>{booking.email || 'No email'}</small>
                  <div className="stable-booking-item__statuses">
                    <span>{friendlyStatus(booking.status)}</span>
                    <span>{friendlyStatus(booking.payment_status)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="stable-pagination">
            <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
            <span>Page {page} of {pagination.totalPages || 1}</span>
            <button type="button" disabled={page >= (pagination.totalPages || 1)} onClick={() => goToPage(page + 1)}>Next</button>
          </div>
        </aside>

        <main className="stable-editor">
          {!selectedBooking ? (
            <div className="stable-empty-state">
              <h2>Select a booking</h2>
              <p>Choose a booking from the left to edit pricing, merchant splits, ticket details, and send emails.</p>
            </div>
          ) : loadingBooking ? (
            <div className="stable-loading">Loading complete booking…</div>
          ) : (
            <>
              <section className="stable-booking-hero">
                <div>
                  <p className="stable-eyebrow">BOOKING</p>
                  <h2>{selectedBooking.confirmation_code || selectedBooking.confirmationCode}</h2>
                  <p>{selectedBooking.passenger_name || selectedBooking.customerName} · {selectedBooking.email}</p>
                </div>
                <div className="stable-booking-hero__amount">
                  <span>Customer total</span>
                  <strong>{money(bookingTotal, currency)}</strong>
                  <button type="button" className="stable-link-btn" onClick={() => loadBooking(selectedBooking.id)}>Refresh from Supabase</button>
                </div>
              </section>

              <ResultMessage result={results.general} />

              {integrity && (
                <section className={`stable-integrity ${integrity.ok ? 'is-good' : 'is-warning'}`}>
                  <div>
                    <strong>{integrity.ok ? 'Financial records are synchronized' : 'Financial records need reconciliation'}</strong>
                    <p>Booking {money(integrity.bookingTotal, currency)} · Splits {money(integrity.splitTotal, currency)} · Authorization {money(integrity.authorizationAmount, currency)}</p>
                  </div>
                  <span>{integrity.ok ? 'Verified' : 'Review'}</span>
                </section>
              )}

              <section className="stable-card">
                <div className="stable-card__heading">
                  <div><p className="stable-eyebrow">WORKFLOW</p><h3>Status & Internal Notes</h3></div>
                </div>
                <div className="stable-form-grid stable-form-grid--two">
                  <label>Booking status
                    <select value={statusForm.status} onChange={(event) => setStatusForm((current) => ({ ...current, status: event.target.value }))}>
                      {['PENDING', 'AWAITING_AUTHORIZATION', 'AUTHORIZED', 'READY_FOR_TICKETING', 'TICKETED', 'DONE', 'FAILED', 'CANCELLED'].map((status) => <option key={status} value={status}>{friendlyStatus(status)}</option>)}
                    </select>
                  </label>
                  <label>Internal notes
                    <textarea value={statusForm.internalNotes} onChange={(event) => setStatusForm((current) => ({ ...current, internalNotes: event.target.value }))} rows="3" />
                  </label>
                </div>
                <ResultMessage result={results.status} />
                <button type="button" className="stable-btn stable-btn--primary" onClick={handleSaveStatus} disabled={saving.status}>{saving.status ? 'Saving Status…' : 'Save Status & Notes'}</button>
              </section>

              <section className="stable-card">
                <div className="stable-card__heading">
                  <div><p className="stable-eyebrow">FINANCIALS</p><h3>Pricing</h3></div>
                  <strong>{money(toNumber(pricingForm.customerTotal), currency)}</strong>
                </div>
                <div className="stable-form-grid stable-form-grid--four">
                  <label>Supplier fare
                    <input inputMode="decimal" value={pricingForm.supplierFare} onChange={(event) => setPricingForm((current) => ({ ...current, supplierFare: event.target.value }))} />
                  </label>
                  <label>Taxes & fees
                    <input inputMode="decimal" value={pricingForm.taxes} onChange={(event) => setPricingForm((current) => ({ ...current, taxes: event.target.value }))} />
                  </label>
                  <label>Agency markup
                    <input value={agencyMarkup.toFixed(2)} readOnly />
                  </label>
                  <label>Customer total
                    <input inputMode="decimal" value={pricingForm.customerTotal} onChange={(event) => setPricingForm((current) => ({ ...current, customerTotal: event.target.value }))} />
                  </label>
                </div>
                <label className="stable-full-label">Revision reason
                  <input value={pricingForm.reason} onChange={(event) => setPricingForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Example: Flight change and fare difference" />
                </label>
                <ResultMessage result={results.pricing} />
                <button type="button" className="stable-btn stable-btn--primary" onClick={handleSavePricing} disabled={saving.pricing}>{saving.pricing ? 'Saving & Verifying…' : 'Save Pricing'}</button>
              </section>

              <section className="stable-card">
                <div className="stable-card__heading">
                  <div><p className="stable-eyebrow">PAYMENT</p><h3>Merchant Authorization Splits</h3></div>
                  <strong>{money(splitTotal, currency)}</strong>
                </div>

                <div className="stable-form-grid stable-form-grid--two">
                  <label>Payment state
                    <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
                      {['PENDING', 'PROCESSING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED'].map((status) => <option key={status} value={status}>{friendlyStatus(status)}</option>)}
                    </select>
                  </label>
                  <label>Transaction reference
                    <input value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} placeholder="Required when Paid" />
                  </label>
                </div>

                <div className="stable-splits">
                  {paymentSplits.map((split, index) => (
                    <div className="stable-split-row" key={split.id}>
                      <label>Merchant {index + 1}
                        <input value={split.merchantName} onChange={(event) => updateSplit(split.id, 'merchantName', event.target.value)} placeholder="The Final Seat LLC or airline" />
                      </label>
                      <label>Amount
                        <input inputMode="decimal" value={split.amount} onChange={(event) => updateSplit(split.id, 'amount', event.target.value)} />
                      </label>
                      <button type="button" className="stable-icon-btn" onClick={() => removeSplit(split.id)} disabled={paymentSplits.length === 1} aria-label={`Remove split ${index + 1}`}>×</button>
                    </div>
                  ))}
                </div>

                <div className={`stable-split-check ${Math.round(splitTotal * 100) === Math.round(bookingTotal * 100) ? 'is-good' : 'is-warning'}`}>
                  Booking total {money(bookingTotal, currency)} · Split total {money(splitTotal, currency)}
                </div>
                <div className="stable-action-row">
                  <button type="button" className="stable-btn stable-btn--secondary" onClick={addSplit}>Add Merchant Split</button>
                  <button type="button" className="stable-btn stable-btn--primary" onClick={handleSavePayment} disabled={saving.payment}>{saving.payment ? 'Saving & Verifying…' : 'Save Payment Splits'}</button>
                </div>
                <ResultMessage result={results.payment} />
              </section>

              <section className="stable-card">
                <div className="stable-card__heading">
                  <div><p className="stable-eyebrow">TICKETING</p><h3>Airline Ticket Details</h3></div>
                </div>
                <div className="stable-form-grid stable-form-grid--three">
                  <label>Airline name
                    <input value={ticketForm.airlineName} onChange={(event) => setTicketForm((current) => ({ ...current, airlineName: event.target.value }))} />
                  </label>
                  <label>Airline code
                    <input maxLength="3" value={ticketForm.airlineCode} onChange={(event) => setTicketForm((current) => ({ ...current, airlineCode: event.target.value.toUpperCase() }))} />
                  </label>
                  <label>Airline PNR
                    <input maxLength="6" value={ticketForm.airlineConfirmationNumber} onChange={(event) => setTicketForm((current) => ({ ...current, airlineConfirmationNumber: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} placeholder="6 characters" />
                  </label>
                  <label>Ticket number
                    <input maxLength="13" value={ticketForm.ticketNumber} onChange={(event) => setTicketForm((current) => ({ ...current, ticketNumber: event.target.value.replace(/\D/g, '') }))} />
                  </label>
                  <label>Ticket issued date
                    <input type="date" value={ticketForm.ticketIssuedAt} onChange={(event) => setTicketForm((current) => ({ ...current, ticketIssuedAt: event.target.value }))} />
                  </label>
                  <label>Supplier confirmation
                    <input value={ticketForm.supplierConfirmation} onChange={(event) => setTicketForm((current) => ({ ...current, supplierConfirmation: event.target.value }))} />
                  </label>
                </div>
                <label className="stable-full-label">Ticket notes
                  <textarea rows="3" value={ticketForm.ticketNotes} onChange={(event) => setTicketForm((current) => ({ ...current, ticketNotes: event.target.value }))} />
                </label>
                <ResultMessage result={results.ticket} />
                <button type="button" className="stable-btn stable-btn--primary" onClick={handleSaveTicket} disabled={saving.ticket}>{saving.ticket ? 'Saving Ticket…' : 'Save Ticket Details'}</button>
              </section>

              <section className="stable-card">
                <div className="stable-card__heading">
                  <div><p className="stable-eyebrow">COMMUNICATIONS</p><h3>Email Delivery</h3></div>
                  <strong>{emailActivity.count || 0} Sent</strong>
                </div>
                <div className="stable-email-grid">
                  <div>
                    <EmailCard title="Booking Request Email" activity={emailActivity.bookingRequest || {}} type="booking-request" onSend={handleEmail} loading={Boolean(emailLoading['booking-request'])} />
                    <ResultMessage result={results['email-booking-request']} />
                  </div>
                  <div>
                    <EmailCard title="Authorization Email" activity={emailActivity.authorization || {}} type="authorization" disabledReason={integrity && !integrity.ok ? 'Make the booking total, payment splits, and authorization amount match first.' : ''} onSend={handleEmail} loading={Boolean(emailLoading.authorization)} />
                    <ResultMessage result={results['email-authorization']} />
                  </div>
                  <div>
                    <EmailCard title="Final Ticket Email" activity={emailActivity.finalTicket || {}} type="final-ticket" disabledReason={!/^[A-Z0-9]{6}$/.test(pnr) ? 'Save a valid 6-character PNR first.' : ''} onSend={handleEmail} loading={Boolean(emailLoading['final-ticket'])} />
                    <ResultMessage result={results['email-final-ticket']} />
                  </div>
                </div>
              </section>

              <section className="stable-card">
                <div className="stable-card__heading">
                  <div><p className="stable-eyebrow">ITINERARY</p><h3>Flight Segments</h3></div>
                  <span>{itinerarySegments.length} segment{itinerarySegments.length === 1 ? '' : 's'}</span>
                </div>
                {itinerarySegments.length === 0 ? <p>No itinerary segments recorded.</p> : (
                  <div className="stable-segments">
                    {itinerarySegments.map((segment, index) => (
                      <div key={segment.id || index} className="stable-segment">
                        <strong>{segment.airline_name || segment.airlineName || segment.carrier_name || 'Airline'} {segment.flight_number || segment.flightNumber || ''}</strong>
                        <span>{segment.origin_code || segment.departure_airport || segment.originAirport || '—'} → {segment.destination_code || segment.arrival_airport || segment.destinationAirport || '—'}</span>
                        <small>{segment.departure_date || segment.departureDate || ''} {segment.departure_time || segment.departureTime || ''}</small>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default StableAdminCRMPage;
