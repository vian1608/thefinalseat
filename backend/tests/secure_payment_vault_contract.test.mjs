import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));

const cardFields = read('frontend/src/features/secure-payments/VgsCheckoutCardFields.js');
const bookingPage = read('frontend/src/features/bookings/pages/BookingPage.js');
const index = read('frontend/src/index.js');

// The legacy component filename is retained only for import compatibility. The
// active checkout must not load VGS or expose a public/admin card-reveal runtime.
assert.match(cardFields, /Legacy filename retained only/);
assert.match(cardFields, /does not load or call VGS/);
assert.doesNotMatch(cardFields, /VGSCollect\.create|VGSShow\.create|verygoodvault|vgs-collect\/|vgs-show\//i);
assert.equal(exists('backend/src/modules/secure-payments/secure-payment.routes.mjs'), false);
assert.equal(exists('backend/src/modules/secure-payments/vgs-vault.service.mjs'), false);
assert.equal(exists('backend/src/modules/backoffice/secure-payment-admin.routes.mjs'), false);
assert.equal(exists('frontend/src/features/secure-payments/SecurePaymentPage.js'), false);
assert.equal(exists('frontend/src/features/backoffice/SecurePaymentAdminPages.js'), false);
assert.equal(exists('frontend/src/features/admin/components/AdminSecurePaymentPanel.js'), false);

// Current reservation checkout stores only a non-sensitive card reference.
assert.match(cardFields, /CARD_BRANDS/);
assert.match(cardFields, /cardBrand/);
assert.match(cardFields, /last4/);
assert.match(cardFields, /cardExpDate/);
assert.match(cardFields, /getMaskedMetadata:\s*\(\) => reference/);
assert.match(cardFields, /provider: 'INTERNAL_REFERENCE'/);
assert.match(cardFields, /only a non-sensitive card reference/);
assert.doesNotMatch(cardFields, /id="(?:cardNumber|cvv|cvc|securityCode)"/i);
assert.doesNotMatch(cardFields, /name="(?:cardNumber|cvv|cvc|securityCode)"/i);
assert.doesNotMatch(cardFields, /set(?:CardNumber|Cvv|Cvc|SecurityCode)/i);

// BookingPage may use the legacy import name, but it can receive only masked
// metadata and the compatibility secureBooking result from that safe component.
assert.match(bookingPage, /VgsCheckoutCardFields/);
assert.match(bookingPage, /secureCardRef\.current\.getMaskedMetadata\(\)/);
assert.match(bookingPage, /secureCardRef\.current\.secureBooking\(\{/);
assert.doesNotMatch(bookingPage, /cleanCardNum/);
assert.doesNotMatch(bookingPage, /\b(cardNumber|cvv|cvc|securityCode)\s*:/i);

// Removed standalone secure-payment/reveal pages must not be mounted again.
assert.doesNotMatch(index, /SecurePaymentPage|SecurePaymentAdminPages|AdminSecurePaymentPanel/);

console.log('safe card-reference checkout contract: PASS');
