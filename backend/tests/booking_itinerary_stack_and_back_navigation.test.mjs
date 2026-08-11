import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const appEntry = read('frontend/src/index.js');
const booking = read('frontend/src/features/bookings/pages/BookingPage.js');
const overrides = read('frontend/src/shared/styles/BookingFlowOverrides.css');
const validationUX = read('frontend/src/shared/validation/installBookingValidationUX.js');
const validationStyles = read('frontend/src/shared/styles/BookingValidationUX.css');
const itinerary = read('frontend/src/features/bookings/components/ItineraryCard.js');
const timeline = read('frontend/src/shared/components/ItineraryTimeline.js');
const transition = read('frontend/src/shared/components/PageTransition.js');
const backButton = read('frontend/src/shared/components/CustomerBackButton.js');

assert.match(booking, /YOUR SELECTED ITINERARY/);

// The approved booking layout only works if its override stylesheet is loaded.
// Guard the app entry import so desktop cannot silently fall back to the legacy
// outbound | return | price three-column layout.
assert.match(appEntry, /import ['"]\.\/shared\/styles\/BookingFlowOverrides\.css['"]/);

// Approved Option 1: one full-width itinerary column, then one equally-wide form column.
assert.match(overrides, /booking-itinerary-top-grid--roundtrip[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
assert.match(overrides, /\.booking-itinerary-top-panel__inner,[\s\S]*\.container\.booking-main-container[\s\S]*max-width:\s*1180px\s*!important/);
assert.match(overrides, /\.booking-layout[\s\S]*display:\s*block\s*!important[\s\S]*width:\s*100%\s*!important/);
assert.match(overrides, /\.booking-form-area[\s\S]*width:\s*100%\s*!important[\s\S]*max-width:\s*none\s*!important/);

// The actual sidebar classes used by BookingPage must be hidden so there is no
// second itinerary, second pricing breakdown, or Modify Search block.
assert.match(overrides, /\.booking-summary-sidebar,[\s\S]*\.mobile-summary-toggle-bar[\s\S]*display:\s*none\s*!important/);
assert.doesNotMatch(overrides, /\.booking-sidebar,[\s\S]*\.mobile-summary-toggle\s*\{/);

// Price stays compact in the itinerary header on desktop.
assert.match(overrides, /booking-itinerary-pricing-summary[\s\S]*position:\s*absolute\s*!important[\s\S]*right:\s*2rem\s*!important/);

// Multi-passenger checkout must visually separate each passenger. BookingPage
// renders passenger-card-block/passenger-card-title, so guard the production
// selectors rather than the obsolete passenger-entry-block class.
assert.match(booking, /className="passenger-card-block"/);
assert.match(booking, /className="passenger-card-title"/);
assert.match(overrides, /\.passenger-card-block\s*\{[\s\S]*border-left:\s*4px solid #8b1538\s*!important[\s\S]*padding:\s*1\.25rem\s*!important/);
assert.match(overrides, /\.passenger-card-block \+ \.passenger-card-block\s*\{[\s\S]*margin-top:\s*1\.45rem\s*!important/);
assert.match(overrides, /\.passenger-card-title\s*\{[\s\S]*background:\s*linear-gradient[\s\S]*border-bottom:\s*1px solid #e2e8f0\s*!important/);

// Checkout CTA must be a full-width branded control, and the existing
// fa-circle-notch processing state must become a visible waiting panel rather
// than a tiny browser-default spinner/text line.
assert.match(booking, /className="amtrak-btn amtrak-btn--cta amtrak-btn--full"/);
assert.match(booking, /fa-circle-notch fa-spin/);
assert.match(overrides, /\.amtrak-btn\.amtrak-btn--cta\.amtrak-btn--full\s*\{[\s\S]*width:\s*100%\s*!important[\s\S]*min-height:\s*58px\s*!important[\s\S]*background:\s*linear-gradient/);
assert.match(overrides, /:has\(\.fa-circle-notch\)[\s\S]*min-height:\s*104px\s*!important[\s\S]*cursor:\s*wait\s*!important/);
assert.match(overrides, /Creating your reservation securely\. Please keep this page open/);
assert.match(overrides, /@keyframes tfs-booking-wait-progress/);
assert.match(overrides, /@keyframes tfs-booking-wait-shimmer/);

// Validation failures must be actionable. The booking page must load the
// validation UX enhancer, auto-scroll to the first bad field, focus it, mark it
// aria-invalid, and render both the field and banner with strong red feedback.
assert.match(appEntry, /BookingValidationUX\.css/);
assert.match(appEntry, /installBookingValidationUX/);
assert.match(validationUX, /scrollIntoView\(\{ behavior: 'smooth', block: 'center'/);
assert.match(validationUX, /aria-invalid/);
assert.match(validationUX, /age requirement/);
assert.match(validationUX, /passengerCard\.querySelector\('\.dob-input'\)/);
assert.match(validationUX, /\.booking-global-error, \.payment-error-banner/);
assert.match(validationStyles, /\.booking-page \.booking-global-error/);
assert.match(validationStyles, /border-left:\s*4px solid #dc2626\s*!important/);
assert.match(validationStyles, /input\.tfs-validation-error-field/);
assert.match(validationStyles, /\.passenger-card-block\.tfs-passenger-card-error/);

// The colored OUTBOUND / RETURN card badge already identifies the leg. On the
// customer booking page, hide only the timeline's duplicate FLT/title/airline
// header and pull the actual airport route upward. Shared timeline headers stay
// available elsewhere in the application.
assert.match(itinerary, /className="itin-badge"/);
assert.match(overrides, /\.booking-itinerary-top-grid \.itin-card \.itinerary-timeline-container > div:first-child\s*\{[\s\S]*display:\s*none\s*!important/);
assert.match(overrides, /\.booking-itinerary-top-grid \.itin-card \.itinerary-timeline-container\s*\{[\s\S]*padding-top:\s*14px\s*!important[\s\S]*margin-bottom:\s*12px\s*!important/);

// Supplier segments are not guaranteed to use one schema. The visual timeline
// must resolve nested departure/arrival objects rather than showing ORIG/CONN/DEST.
assert.match(timeline, /nested\?\.airport/);
assert.match(timeline, /segment\.departure\?\.airport|segment\.departure/);
assert.match(timeline, /segment\.arrival\?\.airport|segment\.arrival/);
assert.match(timeline, /firstSeg\.origin_airport \|\| '---'/);
assert.match(timeline, /lastSeg\.destination_airport \|\| '---'/);
assert.doesNotMatch(timeline, /\|\| 'ORIG'|\|\| 'CONN'|\|\| 'DEST'/);

assert.match(transition, /<CustomerBackButton\s*\/>/);
assert.match(backButton, /navigate\(-1\)/);
assert.match(backButton, /pathname === '\/' \|\| pathname\.startsWith\('\/admin'\)/);
assert.match(backButton, /document\.querySelector\('\.booking-itinerary-top-panel__inner'\)/);
assert.match(backButton, /createPortal\(button, bookingTarget\)/);
assert.match(backButton, /\/return-flight/);
assert.match(backButton, /\/booking/);

console.log('booking itinerary stack + simplified timeline headers + passenger separation + submit waiting visuals + validation scroll + customer back navigation contract: PASS');
