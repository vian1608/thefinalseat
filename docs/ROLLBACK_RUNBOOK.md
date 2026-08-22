# Production Rollback Runbook

Use this when a production release is unhealthy after deployment.

## Trigger conditions

Rollback or revert should be considered when any of these are true:
- Production Smoke fails after a release.
- `/api/health` is unavailable.
- booking creation, authorization, payment, ticketing or admin access is materially broken.
- a security or data-integrity regression is discovered.
- error rates increase immediately after the release.

## Immediate actions

1. Stop merging unrelated changes.
2. Record the production commit SHA and the previous known-good SHA.
3. Check Vercel deployment status/build/runtime logs.
4. Determine whether the defect is code-only or requires database/data recovery.
5. Do not roll the database backward destructively unless there is a separately tested recovery plan.

## Preferred rollback order

### Option A — Vercel deployment rollback
Use Vercel to promote the most recent known-good deployment when the database remains backward compatible.

### Option B — Git revert
Create a revert commit for the offending release and promote that revert through the emergency hotfix path. This keeps repository history explicit and ensures the current source matches production.

## Verification after rollback

Verify at minimum:
- homepage
- `/api/health`
- `/hotels`
- `/car-rentals`
- `/my-bookings`
- `/admin/login`
- `/contact`
- legal pages
- canonical non-www -> www redirect

For a booking-runtime incident also verify, with synthetic/test data only:
- flight search
- booking create/read
- authorization preview
- email preview
- ticket preview
- admin booking detail

## Database rule

Production migrations should be additive first. A code rollback must remain possible without requiring a destructive schema rollback. If a release removed data or columns, stop and prepare a specific database recovery plan rather than improvising.

## After recovery

1. Open a root-cause fix from `develop` or an emergency `hotfix/*` branch.
2. Add or strengthen a regression test that would have caught the incident.
3. Reconcile `develop`, `staging`, and `master` so all environment branches contain the fix.
4. Re-run staging QA/UAT before the next normal release.
