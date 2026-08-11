const ERROR_CLASS = 'tfs-validation-error-field';
const ERROR_WRAPPER_CLASS = 'tfs-validation-error-wrapper';

function normalize(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function clearValidationHighlight(root = document) {
  root.querySelectorAll(`.${ERROR_CLASS}`).forEach((element) => {
    element.classList.remove(ERROR_CLASS);
    element.removeAttribute('aria-invalid');
  });
  root.querySelectorAll(`.${ERROR_WRAPPER_CLASS}`).forEach((element) => {
    element.classList.remove(ERROR_WRAPPER_CLASS);
  });
}

function markInvalid(element) {
  if (!element) return null;

  const focusTarget = element.matches?.('input, select, textarea, button')
    ? element
    : element.querySelector?.('input, select, textarea, button');

  const visualTarget = focusTarget || element;
  visualTarget.classList.add(ERROR_CLASS);
  visualTarget.setAttribute('aria-invalid', 'true');

  const wrapper = visualTarget.closest('.booking-form-field, .dob-container, .travel-date-picker, .passenger-card-block');
  if (wrapper && wrapper !== visualTarget) {
    wrapper.classList.add(ERROR_WRAPPER_CLASS);
  }

  return focusTarget || visualTarget;
}

function scrollToInvalid(element) {
  if (!element) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      window.setTimeout(() => {
        try {
          element.focus({ preventScroll: true });
        } catch {
          try { element.focus(); } catch { /* no-op */ }
        }
      }, 450);
    });
  });
}

function passengerName(card) {
  if (!card) return '';
  const first = card.querySelector('input[placeholder^="First Name"]')?.value || '';
  const last = card.querySelector('input[placeholder^="Last Name"]')?.value || '';
  return normalize(`${first} ${last}`);
}

function findPassengerCardFromMessage(page, message) {
  const normalizedMessage = normalize(message);
  const cards = Array.from(page.querySelectorAll('.passenger-card-block'));

  return cards.find((card) => {
    const name = passengerName(card);
    return name && normalizedMessage.startsWith(name);
  }) || null;
}

function firstMissingTravelerField(page) {
  const cards = Array.from(page.querySelectorAll('.passenger-card-block'));

  for (const card of cards) {
    const candidates = [
      card.querySelector('input[placeholder^="First Name"]'),
      card.querySelector('input[placeholder^="Last Name"]'),
      card.querySelector('select'),
      Array.from(card.querySelectorAll('select'))[1] || null,
      card.querySelector('.dob-input')
    ].filter(Boolean);

    for (const field of candidates) {
      if (!String(field.value || '').trim()) return field;
    }
  }

  return cards[0]?.querySelector('input, select') || null;
}

function firstMissingContactField(page) {
  const explicit = [
    page.querySelector('#contact-email'),
    page.querySelector('#contact-phone')
  ];

  const contactFirst = Array.from(page.querySelectorAll('input[placeholder="First Name"]'))
    .find((input) => !input.closest('.passenger-card-block'));
  const contactLast = Array.from(page.querySelectorAll('input[placeholder="Last Name"]'))
    .find((input) => !input.closest('.passenger-card-block'));

  const candidates = [contactFirst, contactLast, ...explicit].filter(Boolean);
  return candidates.find((field) => !String(field.value || '').trim()) || candidates[0] || null;
}

function targetFromTravelerMessage(page, message) {
  const text = normalize(message);
  const passengerCard = findPassengerCardFromMessage(page, message);

  if (passengerCard) {
    if (text.includes('date of birth') || text.includes('age requirement') || text.includes('children must') || text.includes('adults must') || text.includes('infants must')) {
      return passengerCard.querySelector('.dob-input');
    }

    if (text.includes('passport number')) {
      return passengerCard.querySelector('input[placeholder*="Passport Number"]');
    }

    if (text.includes('passport') && (text.includes('expiration') || text.includes('expiry') || text.includes('valid through'))) {
      return passengerCard.querySelector('input[id^="passport-exp-"]') || passengerCard.querySelector('input[placeholder="YYYY-MM-DD"]');
    }

    return passengerCard.querySelector('input, select');
  }

  if (text.includes('primary contact')) return firstMissingContactField(page);
  if (text.includes('required fields for all travelers') || text.includes('traveler and contact details')) {
    return firstMissingTravelerField(page) || firstMissingContactField(page);
  }

  return null;
}

function targetFromPaymentMessage(page, message) {
  const text = normalize(message);
  const mappings = [
    [['cardholder'], '#cardholderName'],
    [['15 or 16-digit', 'credit/debit card number', 'card number'], '#cardNumber'],
    [['expiration date', 'mm/yy'], '#expDate'],
    [['security code', 'cvv', 'cch'], '#cch'],
    [['billing address'], '#billingAddress'],
    [['billing city'], '#billingCity'],
    [['state or province'], '#billingState'],
    [['zip', 'postal code'], '#billingZip'],
    [['country'], '#billingCountry'],
    [['billing phone'], '#billingPhone'],
    [['terms of service', 'privacy policy', 'refund policy'], '#agree-check']
  ];

  for (const [needles, selector] of mappings) {
    if (needles.some((needle) => text.includes(needle))) {
      const found = page.querySelector(selector);
      if (found) return found;
    }
  }

  return null;
}

function findBestErrorTarget(page) {
  const globalError = page.querySelector('.booking-global-error');
  const globalMessage = globalError?.textContent?.trim() || '';

  if (globalMessage) {
    const travelerTarget = targetFromTravelerMessage(page, globalMessage);
    if (travelerTarget) return { target: travelerTarget, banner: globalError };
  }

  const paymentError = page.querySelector('.payment-error-banner');
  const paymentMessage = paymentError?.textContent?.trim() || '';
  if (paymentMessage) {
    const paymentTarget = targetFromPaymentMessage(page, paymentMessage);
    if (paymentTarget) return { target: paymentTarget, banner: paymentError };
  }

  const nativeInvalid = page.querySelector('input:invalid, select:invalid, textarea:invalid');
  if (nativeInvalid && isVisible(nativeInvalid)) {
    return { target: nativeInvalid, banner: globalError || paymentError || null };
  }

  return null;
}

function applyValidationFeedback() {
  const page = document.querySelector('.booking-page');
  if (!page) return;

  clearValidationHighlight(page);
  const result = findBestErrorTarget(page);
  if (!result?.target) return;

  const target = markInvalid(result.target);
  const passengerCard = target?.closest?.('.passenger-card-block');
  if (passengerCard) passengerCard.classList.add('tfs-passenger-card-error');

  if (result.banner) result.banner.classList.add('tfs-validation-alert-active');
  scrollToInvalid(target);
}

function clearFieldOnEdit(event) {
  const target = event.target;
  if (!target?.closest?.('.booking-page')) return;

  if (target.classList?.contains(ERROR_CLASS)) {
    target.classList.remove(ERROR_CLASS);
    target.removeAttribute('aria-invalid');
    target.closest(`.${ERROR_WRAPPER_CLASS}`)?.classList.remove(ERROR_WRAPPER_CLASS);
    target.closest('.tfs-passenger-card-error')?.classList.remove('tfs-passenger-card-error');
  }
}

export function installBookingValidationUX() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__tfsBookingValidationUXInstalled) return;
  window.__tfsBookingValidationUXInstalled = true;

  document.addEventListener('input', clearFieldOnEdit, true);
  document.addEventListener('change', clearFieldOnEdit, true);

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('.booking-page .amtrak-btn--cta, .booking-page .booking-submit-button');
    if (!button || button.disabled) return;

    window.setTimeout(applyValidationFeedback, 90);
    window.setTimeout(applyValidationFeedback, 280);
  }, true);

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
      return target?.closest?.('.booking-global-error, .payment-error-banner, .booking-page');
    });

    if (relevant) window.setTimeout(applyValidationFeedback, 80);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

export default installBookingValidationUX;
