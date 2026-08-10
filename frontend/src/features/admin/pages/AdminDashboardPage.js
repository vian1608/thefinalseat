import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminAPI } from '../../../shared/api/api';
import AdminDashboardPageV2 from './AdminDashboardPageV2';
import AdminBookingWorkspace from '../components/AdminBookingWorkspace';
import AdminBookingAddressPanel from '../components/AdminBookingAddressPanel';
import './AdminDashboardEnhancements.css';

const ADMIN_BOOKINGS_PAGE_SIZE = 20;

// AdminDashboardPageV2 historically asks for 25 records. Keep the existing page
// implementation stable while enforcing the dashboard contract at the API boundary:
// 20 bookings per page, with the backend returning pagination totals for that size.
if (!adminAPI.__tfsTwentyBookingPages) {
  const originalGetBookings = adminAPI.getBookings.bind(adminAPI);
  adminAPI.getBookings = (params = {}) => originalGetBookings({
    ...params,
    pageSize: ADMIN_BOOKINGS_PAGE_SIZE
  });
  Object.defineProperty(adminAPI, '__tfsTwentyBookingPages', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
}

// Public route wrapper for the rebuilt dashboard. Besides keeping the route/import
// stable, this provides a last-resort visible error surface for any admin API or
// asynchronous UI failure that escapes a section-level handler.
export default function AdminDashboardPage() {
  const { code } = useParams();
  const isBookingDetailRoute = Boolean(code);
  const [globalFailure, setGlobalFailure] = useState(null);

  useEffect(() => {
    const onAdminApiError = event => {
      const detail = event?.detail || {};
      setGlobalFailure({
        title: 'Admin action failed',
        message: detail.message || 'The admin request failed. Please retry.',
        path: detail.path || null,
        code: detail.code || null,
        at: detail.at || new Date().toISOString()
      });
    };

    const onUnhandledRejection = event => {
      const reason = event?.reason;
      const message = reason?.userMessage || reason?.message || 'An unexpected admin action failed.';
      setGlobalFailure({
        title: 'Unexpected admin error',
        message,
        path: null,
        code: reason?.code || 'UNHANDLED_ADMIN_PROMISE',
        at: new Date().toISOString()
      });
    };

    const onWindowError = event => {
      setGlobalFailure({
        title: 'Dashboard error',
        message: event?.message || 'An unexpected dashboard error occurred. Refresh and retry.',
        path: null,
        code: 'ADMIN_UI_ERROR',
        at: new Date().toISOString()
      });
    };

    // Keep the booking list tab open while the selected booking opens in a direct,
    // dedicated booking-editor route in a second tab.
    const onViewEditBooking = event => {
      if (isBookingDetailRoute) return;

      const target = event?.target;
      const button = target instanceof Element ? target.closest('button') : null;
      if (!button || button.textContent?.trim() !== 'View / Edit') return;

      const row = button.closest('tr');
      const reference = row?.querySelector('.adv2-ref')?.textContent?.trim();

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

      if (!reference) {
        setGlobalFailure({
          title: 'Unable to open booking',
          message: 'The selected row does not contain a booking reference. Refresh the dashboard and try again.',
          path: null,
          code: 'BOOKING_REFERENCE_MISSING',
          at: new Date().toISOString()
        });
        return;
      }

      const bookingUrl = `/admin/bookings/${encodeURIComponent(reference)}`;
      const newTab = window.open(bookingUrl, '_blank');

      if (!newTab) {
        setGlobalFailure({
          title: 'New tab blocked',
          message: 'Your browser blocked the booking tab. Allow pop-ups for The Final Seat and click View / Edit again.',
          path: bookingUrl,
          code: 'ADMIN_BOOKING_TAB_BLOCKED',
          at: new Date().toISOString()
        });
        return;
      }

      try {
        newTab.opener = null;
        newTab.focus();
      } catch {
        // Opening succeeded; focus/opener hardening is best-effort only.
      }
    };

    window.addEventListener('admin-api-error', onAdminApiError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);
    document.addEventListener('click', onViewEditBooking, true);

    return () => {
      window.removeEventListener('admin-api-error', onAdminApiError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
      document.removeEventListener('click', onViewEditBooking, true);
    };
  }, [isBookingDetailRoute]);

  useEffect(() => {
    if (isBookingDetailRoute) return undefined;

    let frame = 0;

    const findBookingsCard = () => Array.from(document.querySelectorAll('.adv2-card')).find(card => (
      card.querySelector('.adv2-card__header h2')?.textContent?.trim() === 'Customer Bookings'
    ));

    const currentPage = card => {
      const text = card?.querySelector('.adv2-pagination .adv2-muted')?.textContent || '';
      const match = text.match(/Page\s+(\d+)\s+of/i);
      const parsed = Number(match?.[1] || 1);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };

    const decorateBookingsTable = () => {
      frame = 0;
      const card = findBookingsCard();
      if (!card) return;

      const tableWrap = card.querySelector('.adv2-table-wrap');
      const table = tableWrap?.querySelector('.adv2-table');
      const headerRow = table?.tHead?.rows?.[0];
      const body = table?.tBodies?.[0];
      if (!tableWrap || !table || !headerRow || !body) return;

      tableWrap.classList.add('adv2-bookings-scroll');
      table.setAttribute('data-page-size', String(ADMIN_BOOKINGS_PAGE_SIZE));
      table.setAttribute('aria-label', 'Customer bookings, 20 bookings per page');

      let serialHeader = headerRow.querySelector('.adv2-serial-header');
      if (!serialHeader) {
        serialHeader = document.createElement('th');
        serialHeader.className = 'adv2-serial-header';
        serialHeader.scope = 'col';
        serialHeader.textContent = '#';
        headerRow.insertBefore(serialHeader, headerRow.children[1] || null);
      }

      const pageNumber = currentPage(card);
      Array.from(body.rows).forEach((row, rowIndex) => {
        let serialCell = row.querySelector('.adv2-serial-cell');
        if (!serialCell) {
          serialCell = document.createElement('td');
          serialCell.className = 'adv2-serial-cell';
          row.insertBefore(serialCell, row.children[1] || null);
        }
        const serial = ((pageNumber - 1) * ADMIN_BOOKINGS_PAGE_SIZE) + rowIndex + 1;
        if (serialCell.textContent !== String(serial)) serialCell.textContent = String(serial);
        row.dataset.bookingSerial = String(serial);
      });
    };

    const scheduleDecorate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(decorateBookingsTable);
    };

    scheduleDecorate();
    const observer = new MutationObserver(scheduleDecorate);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [isBookingDetailRoute]);

  useEffect(() => {
    if (isBookingDetailRoute) return undefined;

    const updateHeaderState = () => {
      const header = document.querySelector('.adv2-header');
      if (!header) return;
      header.classList.toggle('adv2-header--compact', window.scrollY > 36);
    };

    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });
    window.addEventListener('resize', updateHeaderState, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateHeaderState);
      window.removeEventListener('resize', updateHeaderState);
    };
  }, [isBookingDetailRoute]);

  return (
    <div className={isBookingDetailRoute ? 'admin-booking-detail-route' : undefined}>
      {isBookingDetailRoute && (
        <style>{`
          /* /admin/bookings/:code is a dedicated booking workspace, not the dashboard list. */
          .admin-booking-detail-route .adv2-header,
          .admin-booking-detail-route .adv2-toolbar,
          .admin-booking-detail-route .adv2-kpis,
          .admin-booking-detail-route .adv2-card {
            display: none !important;
          }

          .admin-booking-detail-route .adv2-page {
            min-height: 0;
            background: transparent;
          }

          .admin-booking-detail-route .adv2-shell {
            padding-top: 10px;
          }

          .admin-booking-detail-route .adv2-detail {
            margin-top: 0;
            box-shadow: 0 2px 10px rgba(15,39,70,.05);
          }
        `}</style>
      )}

      {globalFailure && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            top: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20000,
            width: 'min(760px, calc(100vw - 28px))',
            background: '#fff1f2',
            color: '#991b1b',
            border: '1px solid #fecdd3',
            borderRadius: '12px',
            boxShadow: '0 16px 45px rgba(15, 23, 42, 0.24)',
            padding: '14px 16px'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>⚠ {globalFailure.title}</div>
              <div style={{ fontSize: '13px', lineHeight: 1.45 }}>{globalFailure.message}</div>
              {(globalFailure.code || globalFailure.path) && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#9f1239', wordBreak: 'break-word' }}>
                  {globalFailure.code ? `Code: ${globalFailure.code}` : ''}
                  {globalFailure.code && globalFailure.path ? ' · ' : ''}
                  {globalFailure.path ? `Request: ${globalFailure.path}` : ''}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ border: '1px solid #be123c', background: '#be123c', color: '#fff', borderRadius: '8px', padding: '7px 11px', fontWeight: 700, cursor: 'pointer' }}
              >
                Refresh Dashboard
              </button>
              <button
                type="button"
                onClick={() => setGlobalFailure(null)}
                aria-label="Dismiss admin error"
                style={{ border: '1px solid #fda4af', background: '#fff', color: '#9f1239', borderRadius: '8px', padding: '7px 10px', fontWeight: 700, cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {isBookingDetailRoute && <AdminBookingAddressPanel />}
      {isBookingDetailRoute && <AdminBookingWorkspace />}
      <AdminDashboardPageV2 />
    </div>
  );
}