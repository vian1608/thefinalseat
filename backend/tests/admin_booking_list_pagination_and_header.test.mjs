import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const wrapper = read('frontend/src/features/admin/pages/AdminDashboardPage.js');
const css = read('frontend/src/features/admin/pages/AdminDashboardEnhancements.css');
const globalStyles = read('frontend/src/shared/styles/styles.css');

// 20 bookings per backend page, not a visual-only truncation.
assert.match(wrapper, /ADMIN_BOOKINGS_PAGE_SIZE\s*=\s*20/);
assert.match(wrapper, /adminAPI\.getBookings\s*=\s*\(params\s*=\s*\{\}\)\s*=>\s*originalGetBookings\(\{[\s\S]*pageSize:\s*ADMIN_BOOKINGS_PAGE_SIZE/);

// Continuous serial numbering must account for the current page.
assert.match(wrapper, /\(\(pageNumber\s*-\s*1\)\s*\*\s*ADMIN_BOOKINGS_PAGE_SIZE\)\s*\+\s*rowIndex\s*\+\s*1/);
assert.match(wrapper, /adv2-serial-header/);
assert.match(wrapper, /adv2-serial-cell/);

// Table is scroll-bounded to about 15 rows while the page still carries 20.
assert.match(css, /adv2-bookings-scroll[\s\S]*15\s*\*\s*var\(--adv2-booking-row-height\)/);
assert.match(css, /overflow-y:\s*auto\s*!important/);
assert.match(css, /adv2-bookings-scroll \.adv2-table thead th[\s\S]*position:\s*sticky/);

// Admin brand row must use the same desktop container geometry as the customer header.
assert.match(globalStyles, /\.container\s*\{[\s\S]*max-width:\s*1200px[\s\S]*padding:\s*0 20px/);
assert.match(css, /\.adv2-header__inner\s*\{[\s\S]*max-width:\s*1200px\s*!important[\s\S]*padding:\s*12px 20px\s*!important/);

// Header reacts to scroll and remains responsive rather than being a fixed static bar.
assert.match(wrapper, /adv2-header--compact/);
assert.match(wrapper, /window\.addEventListener\('scroll',\s*updateHeaderState/);
assert.match(css, /@media \(max-width:\s*900px\)/);
assert.match(css, /@media \(max-width:\s*640px\)/);

console.log('admin booking pagination + serial + scroller + dynamic header contract: PASS');
