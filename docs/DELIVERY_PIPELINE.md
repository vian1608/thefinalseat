# Full Delivery Pipeline

The Final Seat is the canonical shared-product repository. Releases now move through explicit development, staging, and production branches instead of going directly from a feature PR to production.

## Environment and branch model

```text
local development
      ↓
feature/* | fix/* | reconcile/* | delivery/*
      ↓ PR
   develop
      ↓ PR
   staging
      ↓ PR
    master
      ↓
production
```

Vercel continues to create Preview Deployments for non-production branches. The long-lived `staging` branch is the permanent pre-production code line; its Vercel Preview deployment is the staging deployment until a dedicated staging Vercel project/domain is introduced.

## Environment responsibilities

### Local / feature branch
- active code changes
- local component and API testing
- no real customer data

### Develop
- integration branch
- all normal features and fixes enter here first
- Delivery Gates run the complete backend regression suite, backend syntax checks, frontend production build, migration safety guard, and changed-code secret scan

### Staging
- only receives promotion from `develop`
- Vercel builds the exact staging commit as a Preview Deployment
- Staging Quality reruns the full regression/build suite and waits for Vercel success
- manual QA/UAT is performed against this deployed candidate
- use synthetic/test records only

### Production
- `master` only receives normal releases from `staging`
- explicit `hotfix/*` PRs remain available for emergency fixes
- Vercel deploys `master` to `https://www.thefinalseat.com`
- Production Smoke verifies the exact merge deployment and then checks important live routes
- the same smoke suite runs every six hours as lightweight monitoring

## Required normal release path

1. Branch from `develop`.
2. Implement and test the change.
3. Open a PR to `develop`.
4. Delivery Gates and the Vercel Preview must succeed.
5. Merge to `develop`.
6. Open `develop -> staging` PR.
7. Delivery Gates must succeed; merge to `staging`.
8. Staging Quality waits for the Vercel staging Preview and reruns full regression/build checks.
9. Perform UAT against the staging Preview, including responsive UI and the changed business workflow.
10. Open `staging -> master` PR.
11. Reconfirm release notes, database compatibility, rollback path, and shared-core classification.
12. Merge to `master`.
13. Vercel deploys production.
14. Production Smoke must pass before the release is considered complete.
15. Monitor the scheduled smoke checks and runtime logs.

## Emergency hotfix path

`hotfix/* -> master` is permitted only for urgent production defects. The full Delivery Gates still run. After the hotfix, merge/cherry-pick the same fix back into `develop` and `staging` so the environment branches do not drift.

## Database migration policy

Database releases use an expand-and-contract approach:

1. Add backward-compatible tables/columns/indexes first.
2. Deploy code that can work with the old and new schema during the transition.
3. Verify the change in staging before production.
4. Remove legacy structures only in a later release after all runtime references are gone.

Delivery Gates reject edits to existing migration files. New destructive SQL (`DROP`, `TRUNCATE`, destructive `ALTER`, bulk `DELETE`) is blocked unless the migration contains an explicit `-- ALLOW_DESTRUCTIVE_MIGRATION: <reason>` marker. That marker documents intent; it is not a substitute for review and rollback planning.

## QA/UAT expectations

For any changed workflow, staging review should cover:
- desktop and mobile layout
- fonts, spacing, alignment and responsive behavior
- every changed button, link, form and loading/error state
- API response and backend persistence
- read-after-write state in admin/back office
- role/permission behavior
- email/ticket/authorization preview when applicable
- duplicate-click, timeout, retry and refresh behavior
- browser console/network failures

Automated regression remains the technical gate; UAT confirms the business workflow is understandable and correct.

## Shared-core rule

Generic product improvements are finalized in The Final Seat first. Once production is healthy, promote approved shared-core changes through a separate FareTransit branch/PR sequence.

Do not automatically sync business-specific boundaries:
- branding, legal identity and support contacts
- payment/secure-payment implementation
- merchant IDs, gateway credentials or secrets
- Supabase projects/data/migrations unless explicitly reconciled
- Vercel environment variables
- FareTransit merchant-demo functionality

`.sync/ownership.yml` is the source of truth for these boundaries.

## Production-data safety

Use synthetic records for staging/release verification. Never commit or log full card numbers, CVV/CVC values, production secrets, temporary passwords, or real customer PII. Staging must not intentionally send real customer emails or create real charges/tickets.

## Monitoring and rollback

Production Smoke runs after every `master` push and every six hours. If production smoke fails:
1. stop further releases;
2. identify whether the issue is deployment, runtime, integration or data related;
3. revert the offending Git commit or use Vercel rollback to the last healthy production deployment;
4. verify `/`, `/api/health`, `/admin/login`, public service/legal routes and canonical redirects;
5. fix forward through the normal branch path.

See `docs/ROLLBACK_RUNBOOK.md` for the operational rollback checklist.

## Dedicated staging database

The code pipeline is ready for an isolated staging Supabase database. Until one is created, do not run destructive or payment-affecting UAT against the production database. A dedicated Supabase branch/project should be connected to the Vercel staging environment before advanced write-heavy UAT is enabled.
