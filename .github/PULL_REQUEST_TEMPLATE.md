## What changed

<!-- Briefly describe the user-visible, operational, data, or infrastructure change. -->

## Promotion stage

- [ ] Feature/fix -> `develop`
- [ ] `develop` -> `staging`
- [ ] `staging` -> `master`
- [ ] Emergency `hotfix/*` -> `master`

## Technical quality

- [ ] Relevant automated tests were added/updated where behavior changed.
- [ ] Delivery Gates / existing repository CI are green.
- [ ] Vercel Preview/deployment status is green for this candidate.
- [ ] No production secrets, passwords, full card numbers, CVV/CVC values, or real customer PII were added to source/logs.
- [ ] Database changes are additive/backward-compatible, or have an explicit migration and rollback plan.
- [ ] Existing applied migration files were not rewritten.

## UI/UX QA when applicable

- [ ] Desktop layout checked.
- [ ] Mobile/responsive layout checked.
- [ ] Fonts, spacing, alignment, truncation and overflow checked.
- [ ] Changed buttons/links/forms work in normal, loading, success and error states.
- [ ] Refresh/back navigation and duplicate-click behavior were considered.

## Business workflow QA when applicable

- [ ] Frontend action reaches the intended API/backend operation.
- [ ] Database/read-after-write result is correct.
- [ ] RBAC/scope behavior was checked.
- [ ] Email/authorization/ticket/payment preview behavior was checked where relevant.
- [ ] Synthetic/test data only was used for risky workflow validation.

## Staging / UAT

<!-- Required for develop -> staging and staging -> master releases. -->

- [ ] Staging candidate passed full regression/build checks.
- [ ] Changed workflow was manually reviewed in the staging Vercel Preview.
- [ ] Business/UAT result is acceptable.
- [ ] Known limitations are documented.

## Production release

<!-- Required for staging -> master or hotfix -> master. -->

- [ ] Rollback path and previous known-good release are understood.
- [ ] Shared-core changes are classified against `.sync/ownership.yml` before FareTransit promotion.
- [ ] After merge, Production Smoke must pass before the release is considered complete.
