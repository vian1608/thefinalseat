import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const entry = read('frontend/src/index.js');
const mobileCss = read('frontend/src/shared/styles/MobileBookingUX.css');
const mobileUx = read('frontend/src/shared/mobile/installMobileBookingUX.js');

assert.match(entry, /MobileBookingUX\.css/);
assert.match(entry, /installMobileBookingUX/);

// Back button/title cannot overlap on phones.
assert.match(mobileCss, /booking-itinerary-top-panel__inner[\s\S]*padding-top:\s*4\.6rem\s*!important/);
assert.match(mobileCss, /tfs-customer-back-wrap--booking[\s\S]*top:\s*0\.45rem\s*!important/);

// The duplicate center route summary is hidden on mobile so airline names do
// not get crushed into one character per line.
assert.match(mobileCss, /\.itin-col-route\s*\{[\s\S]*display:\s*none\s*!important/);
assert.match(mobileCss, /\.itin-airline-name,[\s\S]*white-space:\s*nowrap\s*!important[\s\S]*word-break:\s*normal\s*!important/);
assert.match(mobileCss, /\.itin-summary-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto 18px\s*!important/);

// Multi-passenger mobile checkout is one-card-at-a-time while fields remain
// mounted for React state/validation/submission.
assert.match(mobileUx, /tfs-pax-collapsed/);
assert.match(mobileUx, /openOnly/);
assert.match(mobileUx, /passengerComplete/);
assert.match(mobileCss, /\.tfs-pax-collapsed > :not\(\.passenger-card-title\)[\s\S]*display:\s*none\s*!important/);
assert.match(mobileCss, /\.passenger-card-block \.booking-form-grid,[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);

// Validation errors must reopen the affected passenger automatically.
assert.match(mobileUx, /tfs-passenger-card-error/);
assert.match(mobileUx, /if \(errorCard && isMobile\(\)\) openOnly\(errorCard\)/);

// Footer stays compact on mobile.
assert.match(mobileCss, /\.footer-section__toggle[\s\S]*min-height:\s*40px\s*!important/);

console.log('compact mobile booking UX contract: PASS');
