import React, { useEffect, useState } from 'react';
import AdminDashboardPageV2 from './AdminDashboardPageV2';

// Public route wrapper for the rebuilt dashboard. Besides keeping the route/import
// stable, this provides a last-resort visible error surface for any admin API or
// asynchronous UI failure that escapes a section-level handler.
export default function AdminDashboardPage() {
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
      // Do not expose stack traces or implementation details to the UI.
      setGlobalFailure({
        title: 'Dashboard error',
        message: event?.message || 'An unexpected dashboard error occurred. Refresh and retry.',
        path: null,
        code: 'ADMIN_UI_ERROR',
        at: new Date().toISOString()
      });
    };

    window.addEventListener('admin-api-error', onAdminApiError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);

    return () => {
      window.removeEventListener('admin-api-error', onAdminApiError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
    };
  }, []);

  return (
    <>
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
      <AdminDashboardPageV2 />
    </>
  );
}
