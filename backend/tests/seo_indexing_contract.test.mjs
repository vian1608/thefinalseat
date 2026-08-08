import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

const sitemap = read('frontend', 'public', 'sitemap.xml');
const robots = read('frontend', 'public', 'robots.txt');
const indexHtml = read('frontend', 'public', 'index.html');
const app = read('frontend', 'src', 'app', 'App.js');
const seoGuard = read('frontend', 'src', 'shared', 'components', 'SeoRouteGuard.js');
const vercel = read('vercel.json');

// Canonical host must be consistent everywhere Google is explicitly instructed.
assert.match(sitemap, /https:\/\/www\.thefinalseat\.com\//);
assert.doesNotMatch(sitemap, /<loc>https:\/\/thefinalseat\.com/);
assert.match(robots, /Sitemap: https:\/\/www\.thefinalseat\.com\/sitemap\.xml/);
assert.match(indexHtml, /<link rel="canonical" href="https:\/\/www\.thefinalseat\.com\/"/);
assert.match(seoGuard, /https:\/\/www\.thefinalseat\.com/);

// Sitemap must contain only public, canonical landing/content pages.
for (const privatePath of [
  '/admin', '/search', '/payment', '/booking', '/authorize/', '/confirmation/',
  '/booking-confirmed', '/my-bookings', '/signin', '/signup', '/return-flight',
  '/car-rentals/search', '/car-rentals/results'
]) {
  assert.equal(sitemap.includes(`<loc>https://www.thefinalseat.com${privatePath}`), false, `Private path leaked into sitemap: ${privatePath}`);
}

const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.ok(locs.length >= 20, 'Sitemap should expose the core SEO landing/content pages.');
assert.equal(new Set(locs).size, locs.length, 'Sitemap contains duplicate URLs.');
assert.ok(locs.every((url) => url.startsWith('https://www.thefinalseat.com/')), 'Every sitemap URL must use the canonical www HTTPS origin.');

// noindex must remain crawlable so Google can actually see the directive.
assert.doesNotMatch(robots, /Disallow: \/search/);
assert.doesNotMatch(robots, /Disallow: \/booking/);
assert.match(robots, /Disallow: \/admin\//);
assert.match(robots, /Disallow: \/api\//);

// SPA must not redirect every bad URL to the homepage (soft-404 pattern).
assert.match(app, /import SeoRouteGuard/);
assert.match(app, /import NotFoundPage/);
assert.match(app, /<Route path="\*" element={<NotFoundPage \/>} \/>/);
assert.doesNotMatch(app, /<Route path="\*" element={<Navigate to="\/" replace \/>} \/>/);
assert.match(seoGuard, /noindex, nofollow, noarchive/);
assert.match(seoGuard, /INDEXABLE_EXACT/);
assert.match(seoGuard, /INDEXABLE_PREFIXES/);

// Homepage must provide crawl/index signals and entity structured data.
assert.match(indexHtml, /name="google-site-verification"/);
assert.match(indexHtml, /name="robots" content="index, follow/);
assert.match(indexHtml, /"@type": "TravelAgency"/);
assert.match(indexHtml, /"@type": "WebSite"/);

// Edge configuration must consolidate the hostname and protect private pages.
const vercelConfig = JSON.parse(vercel);
const canonicalHostRedirect = (vercelConfig.redirects || []).find((rule) =>
  Array.isArray(rule.has) && rule.has.some((condition) => condition.type === 'host' && condition.value === 'thefinalseat.com')
);
assert.ok(canonicalHostRedirect, 'Missing non-www to www host redirect.');
assert.equal(canonicalHostRedirect.destination, 'https://www.thefinalseat.com/:path*');
assert.equal(canonicalHostRedirect.permanent, true);

const noindexHeaderRules = (vercelConfig.headers || []).filter((rule) =>
  (rule.headers || []).some((header) => header.key === 'X-Robots-Tag' && header.value.includes('noindex'))
);
assert.ok(noindexHeaderRules.length >= 10, 'Expected private admin/transaction routes to have X-Robots-Tag noindex protection.');

console.log(`SEO indexing contract passed (${locs.length} canonical sitemap URLs).`);
