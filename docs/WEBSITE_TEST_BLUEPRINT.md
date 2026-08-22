# Whole-Site Production Test Blueprint

This document is the release QA map for The Final Seat. It complements automated regression tests with UI/UX, operational, integration, security and production checks.

## Traceability rule

For every important operation verify the complete chain:

`screen -> control -> frontend handler -> API client -> HTTP route -> auth/RBAC -> controller -> service -> repository -> database -> audit/integration -> response -> frontend state -> user feedback`

A button is not considered working merely because it changes the screen; the intended backend/data effect must be verified where applicable.

## Coverage areas

### UI/UX
- typography hierarchy and font consistency
- spacing, containers, alignment, border radius, shadows and visual hierarchy
- desktop/mobile responsive behavior
- overflow, truncation, wrapping and touch targets
- loading, empty, success and error states
- keyboard/focus behavior and accessible labels

### Public navigation and forms
- all public routes, navigation, footer and redirects
- required/invalid/edge input validation
- date boundaries, international names/phones, long input and Unicode
- browser refresh/back/forward behavior
- duplicate submit protection and timeout recovery

### Flight workflow
- airport autocomplete by IATA/city/name
- one-way/round-trip and passenger combinations
- supplier result truthfulness: airline, flight number, times, airports, duration, stops, cabin, currency and total
- no fabricated taxes/fees/provider/authorization data
- price math, vouchers, rounding and party-total protection
- search -> selection -> passenger/contact -> booking -> confirmation -> authorization -> ticketing

### Hotels and cars
- search/autocomplete, filters/sort, details, pagination/load-more
- request creation and CRM/back-office linkage
- supplier timeout/error handling
- duplicate request protection

### Admin/back office
- login/logout and session expiry
- booking create/draft/open/edit
- passenger/contact/itinerary/pricing/status updates
- GDS import and save/read-after-write
- authorization, email preview/send state, ticket/PNR, PDF/export
- CRM leads/customers/tasks/notes/trips
- finance/suppliers/refund/dispute flows where enabled
- search/filter/pagination/bulk operations

### Permissions
- frontend visibility plus backend enforcement
- owner/staff/finance/operations scopes
- OWN/TEAM/ALL booking access
- unauthenticated and wrong-role access rejection

### Payments and authorization
- exact amount/currency ownership checks
- masked/safe payment metadata only
- no raw card/CVV persistence or logging
- authorization token expiry/replay protection
- evidence/snapshot/audit records
- valid booking/payment status transitions

### Email and ticketing
- subject/recipient/rendered HTML/text
- passenger/contact/itinerary/pricing correctness
- no placeholder airline or blank final-ticket content
- delivery activity and preview consistency
- PNR/ticket validation and ticket snapshot

### Backend/API/database
- route inventory and frontend/API contract alignment
- 2xx/4xx/5xx/error normalization
- timeouts and external-provider failure handling
- foreign keys, indexes, uniqueness, soft delete, status casing, orphan/duplicate checks
- RLS/security-advisor review after DDL
- migration additivity and rollback compatibility

### Security
- authentication/authorization/IDOR checks
- rate limiting and token expiry
- XSS/injection/sensitive error/log checks
- secret leakage and frontend-bundle exposure
- payment-data boundary

### Performance and reliability
- frontend build and major-page performance
- duplicate/cancelled external requests, caching and debounce
- slow/offline/429/500/timeout scenarios
- no infinite spinners
- production runtime-error review

### SEO/legal/brand
- title/meta/canonical/robots/sitemap/structured data
- internal links and redirects
- legal pages/support details
- no FareTransit identity leakage into customer-facing Final Seat surfaces

## Release severity

- P0: security/payment/data catastrophe — block/revert immediately
- P1: core booking/admin workflow broken — block release
- P2: important functional defect — fix before normal release unless explicitly accepted
- P3: UI/UX defect — schedule/fix based on impact
- P4: cosmetic cleanup

## Environment execution

- feature/develop: automated regression + focused changed-workflow QA
- staging: full regression/build + deployed UAT with synthetic data
- production: non-destructive smoke only, followed by monitoring

A release is complete only when the deployed production revision is healthy, not merely when GitHub reports a successful merge.
