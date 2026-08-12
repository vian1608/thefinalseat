import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Booking from '../pages/BookingPage';
import { bookingAPI } from '../../../shared/api/api';
import { voucherAPI } from '../../../shared/api/voucherApi';
import { formatUsd, getCheckoutBasePricing } from './voucherCheckoutPricing';
import './BookingVoucherPage.css';

let currentVoucher = null;
let bookingApiPatched = false;

function lastFour(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function stripSensitivePaymentFields(source = {}) {
  const {
    cardNumber,
    card_number,
    pan,
    cvv,
    cvc,
    cch,
    securityCode,
    security_code,
    ...safe
  } = source || {};
  return safe;
}

function ensureBookingApiVoucherBridge() {
  if (bookingApiPatched) return;
  const originalCreate = bookingAPI.create.bind(bookingAPI);

  bookingAPI.create = (bookingData = {}) => {
    const safeBookingData = stripSensitivePaymentFields(bookingData);
    const safePaymentMethod = stripSensitivePaymentFields(safeBookingData.paymentMethod || {});
    const resolvedLast4 = lastFour(
      safePaymentMethod.cardLast4
      || safePaymentMethod.card_last4
      || safeBookingData.cardLast4
      || safeBookingData.card_last4,
    );

    const voucherAdjustedPrice = currentVoucher?.finalPrice;
    const hasVoucherPrice = Number.isFinite(Number(voucherAdjustedPrice));

    return originalCreate({
      ...safeBookingData,
      ...(hasVoucherPrice ? {
        customer_price: Number(voucherAdjustedPrice).toFixed(2),
        displayedWebsitePrice: Number(voucherAdjustedPrice).toFixed(2),
        price_before_voucher: Number(currentVoucher.priceBeforeVoucher || 0).toFixed(2),
        voucher_discount: Number(currentVoucher.appliedDiscount || 0).toFixed(2),
      } : {}),
      cardLast4: resolvedLast4,
      card_last4: resolvedLast4,
      paymentMethod: {
        ...safePaymentMethod,
        cardLast4: resolvedLast4,
        card_last4: resolvedLast4,
      },
      voucher_code: currentVoucher?.code || null,
    });
  };

  bookingApiPatched = true;
}

function findContactEmail() {
  const input = document.getElementById('contact-email')
    || document.querySelector('input[type="email"]');
  return String(input?.value || '').trim().toLowerCase();
}

function ensurePortalHost(id, beforeSelector, fallbackSelector) {
  let host = document.getElementById(id);
  if (host?.isConnected) return host;

  const before = document.querySelector(beforeSelector);
  const fallback = document.querySelector(fallbackSelector);
  const parent = before?.parentElement || fallback;
  if (!parent) return null;

  host = document.createElement('div');
  host.id = id;
  host.className = 'tfs-voucher-portal-host';
  if (before?.parentElement) before.parentElement.insertBefore(host, before);
  else fallback.appendChild(host);
  return host;
}

function setTextIfChanged(node, value) {
  if (!node || node.textContent === value) return;
  node.textContent = value;
}

function syncDisplayedTotals(basePricing, appliedVoucher) {
  if (!basePricing) return;
  const finalPrice = appliedVoucher?.finalPrice ?? basePricing.priceBeforeVoucher;
  const finalText = `${formatUsd(finalPrice)} USD`;

  document.querySelectorAll('.booking-itinerary-pricing-summary__discounted').forEach((node) => {
    setTextIfChanged(node, finalText);
  });

  document.querySelectorAll('.price-total-amount').forEach((node) => {
    setTextIfChanged(node, finalText);
  });

  const mobileTotal = document.querySelector('.mobile-summary-toggle-bar strong');
  if (mobileTotal) {
    const icon = mobileTotal.querySelector('i');
    const iconClass = icon?.className || '';
    setTextIfChanged(mobileTotal, finalText);
    if (iconClass) {
      const restoredIcon = document.createElement('i');
      restoredIcon.className = iconClass;
      mobileTotal.append(' ', restoredIcon);
    }
  }

  const completeButton = document.querySelector('.amtrak-btn.amtrak-btn--cta.amtrak-btn--full');
  if (completeButton && !/Processing/i.test(completeButton.textContent || '')) {
    const desired = `🔒 Complete Secure Booking — ${formatUsd(finalPrice)} USD`;
    const labelNode = completeButton.querySelector('span') || completeButton;
    setTextIfChanged(labelNode, desired);
  }
}

function VoucherCheckoutPanel({ basePricing, appliedVoucher, onApplied, onRemoved }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleApply = async () => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setError('Enter your voucher code.');
      return;
    }
    const email = findContactEmail();
    if (!email) {
      setError('Enter the primary contact email first so we can verify voucher eligibility and usage.');
      return;
    }
    if (!basePricing || basePricing.priceBeforeVoucher < 150) {
      setError('Vouchers require a booking amount of at least $150.00 after the standard website discount.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await voucherAPI.validate({
        code: normalizedCode,
        supplierPrice: basePricing.supplierPrice,
        priceBeforeVoucher: basePricing.priceBeforeVoucher,
        email,
      });
      const voucher = response?.data;
      if (!response?.success || !voucher) throw new Error('Voucher could not be validated.');
      onApplied({ ...voucher, validatedEmail: email });
      setMessage(voucher.message || `Voucher applied: ${formatUsd(voucher.appliedDiscount)} off.`);
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.error?.message
        || requestError?.userMessage
        || requestError?.message
        || 'This voucher could not be applied.';
      setError(apiMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tfs-voucher-checkout" aria-label="Voucher or coupon">
      <div className="tfs-voucher-checkout__header">
        <div>
          <span className="tfs-voucher-checkout__eyebrow">Have a voucher?</span>
          <h4>Voucher / Coupon</h4>
        </div>
        <i className="fas fa-ticket-alt" aria-hidden="true" />
      </div>

      {!appliedVoucher ? (
        <>
          <div className="tfs-voucher-checkout__controls">
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Enter voucher code"
              autoComplete="off"
              maxLength={40}
              aria-label="Voucher code"
            />
            <button type="button" onClick={handleApply} disabled={busy}>
              {busy ? <><i className="fas fa-circle-notch fa-spin" /> Checking…</> : 'Apply'}
            </button>
          </div>
          <p className="tfs-voucher-checkout__rule">
            Vouchers apply on bookings of <strong>$150+</strong>. Your final payment is protected at a minimum of <strong>60% of the ticket value</strong>.
          </p>
        </>
      ) : (
        <div className="tfs-voucher-applied">
          <div>
            <span className="tfs-voucher-applied__code">{appliedVoucher.code}</span>
            <strong>{formatUsd(appliedVoucher.appliedDiscount)} off</strong>
            <small>{appliedVoucher.capped ? 'Voucher capped by the 60% minimum-payment rule.' : 'Voucher successfully applied.'}</small>
          </div>
          <button type="button" onClick={onRemoved}>Remove</button>
        </div>
      )}

      {message && !error && <p className="tfs-voucher-message tfs-voucher-message--success">{message}</p>}
      {error && <p className="tfs-voucher-message tfs-voucher-message--error" role="alert">{error}</p>}

      {appliedVoucher && (
        <div className="tfs-voucher-price-example">
          <span>Price before voucher <strong>{formatUsd(appliedVoucher.priceBeforeVoucher)}</strong></span>
          <span>Voucher <strong>−{formatUsd(appliedVoucher.appliedDiscount)}</strong></span>
          <span className="tfs-voucher-price-example__final">Amount due <strong>{formatUsd(appliedVoucher.finalPrice)}</strong></span>
        </div>
      )}
    </section>
  );
}

function VoucherSidebarRow({ appliedVoucher }) {
  if (!appliedVoucher) return null;
  return (
    <div className="price-row tfs-voucher-sidebar-row">
      <span>Voucher {appliedVoucher.code}</span>
      <strong>−{formatUsd(appliedVoucher.appliedDiscount)}</strong>
    </div>
  );
}

function VoucherEnhancement() {
  const [paymentHost, setPaymentHost] = useState(null);
  const [sidebarHost, setSidebarHost] = useState(null);
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const basePricing = useMemo(() => getCheckoutBasePricing(), []);

  useEffect(() => {
    ensureBookingApiVoucherBridge();
    currentVoucher = null;
    sessionStorage.removeItem('tfsAppliedVoucher');

    const installHosts = () => {
      const payment = ensurePortalHost(
        'tfs-voucher-checkout-host',
        '.verification-block',
        '.card-payment-container',
      );
      const totalRow = document.querySelector('.price-breakdown-section .price-row--total');
      let sidebar = document.getElementById('tfs-voucher-sidebar-host');
      if (!sidebar?.isConnected && totalRow?.parentElement) {
        sidebar = document.createElement('div');
        sidebar.id = 'tfs-voucher-sidebar-host';
        totalRow.parentElement.insertBefore(sidebar, totalRow);
      }
      if (payment) setPaymentHost((current) => current === payment ? current : payment);
      if (sidebar) setSidebarHost((current) => current === sidebar ? current : sidebar);
    };

    installHosts();
    const observer = new MutationObserver(() => {
      installHosts();
      syncDisplayedTotals(basePricing, currentVoucher);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const clearOnEmailChange = (event) => {
      if (!currentVoucher) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.id !== 'contact-email') return;
      const currentEmail = String(target.value || '').trim().toLowerCase();
      if (currentEmail !== currentVoucher.validatedEmail) {
        currentVoucher = null;
        setAppliedVoucher(null);
        sessionStorage.removeItem('tfsAppliedVoucher');
      }
    };

    const resyncAfterInput = () => {
      window.requestAnimationFrame(() => syncDisplayedTotals(basePricing, currentVoucher));
    };

    document.addEventListener('input', clearOnEmailChange, true);
    document.addEventListener('change', resyncAfterInput, true);
    document.addEventListener('click', resyncAfterInput, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('input', clearOnEmailChange, true);
      document.removeEventListener('change', resyncAfterInput, true);
      document.removeEventListener('click', resyncAfterInput, true);
      currentVoucher = null;
      sessionStorage.removeItem('tfsAppliedVoucher');
    };
  }, [basePricing]);

  useEffect(() => {
    syncDisplayedTotals(basePricing, appliedVoucher);
  }, [basePricing, appliedVoucher]);

  const applyVoucher = (voucher) => {
    currentVoucher = voucher;
    setAppliedVoucher(voucher);
    sessionStorage.setItem('tfsAppliedVoucher', JSON.stringify(voucher));
    syncDisplayedTotals(basePricing, voucher);
  };

  const removeVoucher = () => {
    currentVoucher = null;
    setAppliedVoucher(null);
    sessionStorage.removeItem('tfsAppliedVoucher');
    syncDisplayedTotals(basePricing, null);
  };

  return (
    <>
      {paymentHost && createPortal(
        <VoucherCheckoutPanel
          basePricing={basePricing}
          appliedVoucher={appliedVoucher}
          onApplied={applyVoucher}
          onRemoved={removeVoucher}
        />,
        paymentHost,
      )}
      {sidebarHost && createPortal(<VoucherSidebarRow appliedVoucher={appliedVoucher} />, sidebarHost)}
    </>
  );
}

export default function BookingVoucherPage() {
  return (
    <>
      <Booking />
      <VoucherEnhancement />
    </>
  );
}
