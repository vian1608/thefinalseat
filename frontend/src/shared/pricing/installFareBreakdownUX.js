const moneyFromText = (text = '') => {
  const match = String(text).replace(/,/g, '').match(/-?\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : 0;
};

const formatMoney = (value) => {
  const amount = Number.isFinite(value) ? value : 0;
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

function buildBreakdown(card) {
  const totalNode = card.querySelector('.booking-itinerary-pricing-summary__discounted');
  if (!totalNode) return;

  const total = moneyFromText(totalNode.textContent);
  if (!total) return;

  const originalNode = card.querySelector('.booking-itinerary-pricing-summary__original');
  const savingNode = card.querySelector('.booking-itinerary-pricing-summary__saving');
  const originalTotal = moneyFromText(originalNode?.textContent || '') || total;
  const savingTotal = moneyFromText(savingNode?.textContent || '') || Math.max(0, originalTotal - total);

  const travelerText = Array.from(card.querySelectorAll('p'))
    .map((node) => node.textContent || '')
    .find((text) => /\btravelers?\b/i.test(text)) || '';
  const travelerMatch = travelerText.match(/(\d+)\s+travelers?/i);
  const travelerCount = Math.max(1, Number(travelerMatch?.[1] || 1));

  const perTravelerFinal = total / travelerCount;
  const perTravelerOriginal = originalTotal / travelerCount;
  const perTravelerSaving = savingTotal / travelerCount;

  let root = card.querySelector('.tfs-fare-breakdown-root');
  if (!root) {
    root = document.createElement('div');
    root.className = 'tfs-fare-breakdown-root';
    card.appendChild(root);
  }

  root.innerHTML = `
    <div class="tfs-fare-summary-line">
      <div>
        <span class="tfs-fare-kicker">Trip total</span>
        <strong class="tfs-fare-total">${formatMoney(total)} <small>USD</small></strong>
      </div>
      ${savingTotal > 0 ? '<span class="tfs-fare-discount-chip">10% OFF</span>' : ''}
    </div>

    <div class="tfs-fare-per-traveler">
      <strong>${formatMoney(perTravelerFinal)}</strong>
      <span>× ${travelerCount} traveler${travelerCount === 1 ? '' : 's'}</span>
      <span class="tfs-fare-equals">= ${formatMoney(total)}</span>
    </div>

    <details class="tfs-fare-details">
      <summary>
        <span>View fare breakdown</span>
        <i class="fas fa-chevron-down" aria-hidden="true"></i>
      </summary>
      <div class="tfs-fare-details-body">
        ${originalTotal > total ? `
          <div class="tfs-fare-row">
            <span>Original fare / traveler</span>
            <strong>${formatMoney(perTravelerOriginal)}</strong>
          </div>
          <div class="tfs-fare-row tfs-fare-row--saving">
            <span>Member discount / traveler</span>
            <strong>−${formatMoney(perTravelerSaving)}</strong>
          </div>
        ` : ''}
        <div class="tfs-fare-row">
          <span>Final fare / traveler</span>
          <strong>${formatMoney(perTravelerFinal)}</strong>
        </div>
        <div class="tfs-fare-row">
          <span>Number of travelers</span>
          <strong>× ${travelerCount}</strong>
        </div>
        <div class="tfs-fare-row tfs-fare-row--total">
          <span>Trip total</span>
          <strong>${formatMoney(total)} USD</strong>
        </div>
        ${savingTotal > 0 ? `
          <div class="tfs-fare-savings-note">You save ${formatMoney(savingTotal)} total.</div>
        ` : ''}
      </div>
    </details>
  `;

  card.classList.add('tfs-fare-breakdown-ready');
}

function enhanceFareBreakdown() {
  document.querySelectorAll('.booking-itinerary-pricing-summary').forEach(buildBreakdown);
}

export function installFareBreakdownUX() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__tfsFareBreakdownUXInstalled) return;
  window.__tfsFareBreakdownUXInstalled = true;

  const run = () => window.requestAnimationFrame(enhanceFareBreakdown);
  run();

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
      return target?.closest?.('.booking-itinerary-pricing-summary, .booking-itinerary-top-panel, .booking-page');
    });
    if (relevant) run();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

export default installFareBreakdownUX;
