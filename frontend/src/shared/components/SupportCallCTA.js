import React from 'react';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../constants/supportContact';
import { analytics } from '../utils/analytics';
import './SupportCallCTA.css';

const COPY = {
  flights: {
    title: 'Prefer booking by phone?',
    subtitle: 'Talk to a flight specialist',
  },
  hotels: {
    title: 'Need help choosing a stay?',
    subtitle: 'Talk to a hotel specialist',
  },
  cars: {
    title: 'Need help with rental options?',
    subtitle: 'Talk to a rental specialist',
  },
};

function normalizeTheme(theme) {
  if (theme === 'hotels' || theme === 'cars') return theme;
  return 'flights';
}

export default function SupportCallCTA({
  theme = 'flights',
  mode = 'card',
  title,
  subtitle,
  className = '',
  compact = false,
  dismissible = false,
  onDismiss,
}) {
  const resolvedTheme = normalizeTheme(theme);
  const copy = COPY[resolvedTheme];
  const resolvedTitle = title || copy.title;
  const resolvedSubtitle = subtitle || copy.subtitle;
  const rootClassName = `support-call-cta support-call-cta--${resolvedTheme} support-call-cta--${mode} ${compact ? 'support-call-cta--compact' : ''} ${dismissible ? 'support-call-cta--dismissible' : ''} ${className}`.trim();

  const handleClick = () => {
    analytics.trackCallCtaClicked(`${resolvedTheme}_${mode}`);
  };

  const content = (
    <>
      <span className="support-call-cta__icon" aria-hidden="true">
        <i className="fas fa-phone-alt" />
      </span>
      <span className="support-call-cta__copy">
        <strong>{resolvedTitle}</strong>
        <small>{resolvedSubtitle}</small>
      </span>
      <span className="support-call-cta__action">
        <strong>Call Now</strong>
        <span>{SUPPORT_PHONE_DISPLAY}</span>
      </span>
    </>
  );

  if (dismissible) {
    return (
      <div
        className={rootClassName}
        role="group"
        aria-label={`Phone booking assistance. Call The Final Seat at ${SUPPORT_PHONE_DISPLAY}.`}
      >
        <a
          href={SUPPORT_PHONE_HREF}
          className="support-call-cta__phone-link"
          onClick={handleClick}
          aria-label={`Call The Final Seat at ${SUPPORT_PHONE_DISPLAY}. ${resolvedTitle}`}
        >
          {content}
        </a>
        <button
          type="button"
          className="support-call-cta__dismiss"
          onClick={onDismiss}
          aria-label="Minimize phone booking assistance"
          title="Minimize"
        >
          <i className="fas fa-times" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <a
      href={SUPPORT_PHONE_HREF}
      className={rootClassName}
      onClick={handleClick}
      aria-label={`Call The Final Seat at ${SUPPORT_PHONE_DISPLAY}. ${resolvedTitle}`}
    >
      {content}
    </a>
  );
}
