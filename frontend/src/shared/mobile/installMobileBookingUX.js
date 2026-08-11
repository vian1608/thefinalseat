const MOBILE_QUERY = '(max-width: 640px)';
const COLLAPSED_CLASS = 'tfs-pax-collapsed';
const COMPLETE_CLASS = 'tfs-pax-complete';

const isMobile = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;

function fieldValue(card, selector) {
  return String(card.querySelector(selector)?.value || '').trim();
}

function passengerComplete(card) {
  const selects = Array.from(card.querySelectorAll('select'));
  const title = String(selects[0]?.value || '').trim();
  const gender = String(selects[1]?.value || '').trim();
  const firstName = fieldValue(card, 'input[placeholder^="First Name"]');
  const lastName = fieldValue(card, 'input[placeholder^="Last Name"]');
  const dob = fieldValue(card, '.dob-input');
  return Boolean(title && firstName && lastName && gender && dob);
}

function ensureHeaderControls(card) {
  const header = card.querySelector('.passenger-card-title');
  if (!header) return null;

  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');

  let state = header.querySelector('.tfs-pax-mobile-state');
  if (!state) {
    state = document.createElement('span');
    state.className = 'tfs-pax-mobile-state';
    header.appendChild(state);
  }

  let chevron = header.querySelector('.tfs-pax-mobile-chevron');
  if (!chevron) {
    chevron = document.createElement('i');
    chevron.className = 'fas fa-chevron-down tfs-pax-mobile-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    header.appendChild(chevron);
  }

  return { header, state, chevron };
}

function updateCardState(card) {
  const controls = ensureHeaderControls(card);
  if (!controls) return;

  const complete = passengerComplete(card);
  card.classList.toggle(COMPLETE_CLASS, complete);
  const label = complete ? 'Done' : 'Required';
  if (controls.state.textContent !== label) controls.state.textContent = label;
  controls.header.setAttribute('aria-expanded', card.classList.contains(COLLAPSED_CLASS) ? 'false' : 'true');
}

function setExpanded(card, expanded) {
  card.classList.toggle(COLLAPSED_CLASS, !expanded);
  updateCardState(card);
}

function openOnly(targetCard) {
  if (!isMobile() || !targetCard) return;
  document.querySelectorAll('.booking-page .passenger-card-block').forEach((card) => {
    setExpanded(card, card === targetCard);
  });
}

function initializePassengerCards() {
  const cards = Array.from(document.querySelectorAll('.booking-page .passenger-card-block'));
  if (!cards.length) return;

  cards.forEach((card, index) => {
    const newlyInitialized = card.dataset.tfsPaxMobileInitialized !== 'true';
    if (newlyInitialized) {
      card.dataset.tfsPaxMobileInitialized = 'true';
      if (isMobile()) card.classList.toggle(COLLAPSED_CLASS, index !== 0);
    }
    updateCardState(card);
  });
}

function activatePassengerHeader(header) {
  if (!isMobile()) return;
  const card = header.closest('.passenger-card-block');
  if (!card) return;

  const wasCollapsed = card.classList.contains(COLLAPSED_CLASS);
  if (wasCollapsed) {
    openOnly(card);
  } else {
    setExpanded(card, false);
  }
}

export function installMobileBookingUX() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__tfsMobileBookingUXInstalled) return;
  window.__tfsMobileBookingUXInstalled = true;

  initializePassengerCards();

  document.addEventListener('click', (event) => {
    const header = event.target.closest?.('.booking-page .passenger-card-title');
    if (!header) return;
    if (event.target.closest('input, select, textarea, button, a')) return;
    activatePassengerHeader(header);
  }, true);

  document.addEventListener('keydown', (event) => {
    const header = event.target.closest?.('.booking-page .passenger-card-title');
    if (!header || !isMobile()) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activatePassengerHeader(header);
  }, true);

  const updateFromField = (event) => {
    const card = event.target.closest?.('.booking-page .passenger-card-block');
    if (card) updateCardState(card);
  };
  document.addEventListener('input', updateFromField, true);
  document.addEventListener('change', updateFromField, true);

  const observer = new MutationObserver((mutations) => {
    let needsInit = false;
    let errorCard = null;

    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
        if (target?.closest?.('.booking-page') || Array.from(mutation.addedNodes).some((node) => node instanceof Element && (node.matches?.('.booking-page') || node.querySelector?.('.booking-page')))) {
          needsInit = true;
        }
      }
      if (mutation.type === 'attributes') {
        const card = mutation.target.closest?.('.passenger-card-block');
        if (card?.classList.contains('tfs-passenger-card-error')) errorCard = card;
      }
    });

    if (needsInit) initializePassengerCards();
    if (errorCard && isMobile()) openOnly(errorCard);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  const media = window.matchMedia(MOBILE_QUERY);
  const handleViewportChange = () => initializePassengerCards();
  if (media.addEventListener) media.addEventListener('change', handleViewportChange);
  else media.addListener?.(handleViewportChange);
}

export default installMobileBookingUX;
