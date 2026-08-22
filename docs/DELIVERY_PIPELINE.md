# Lightweight Delivery Pipeline

The Final Seat is the canonical shared-product repository. The project intentionally uses a small-team delivery model today: **feature branch -> pull request -> automated CI + Vercel Preview -> merge -> production -> smoke check**.

## Environments

1. **Local / feature branch** — code may change freely. No customer traffic.
2. **Vercel Preview** — every pull request is deployed to a temporary preview URL by the existing Vercel Git integration. Use this as the current test/pre-production environment.
3. **Production** — `master` deploys to `https://www.thefinalseat.com`.

A permanent staging environment is intentionally deferred until traffic/team size makes it worthwhile.

## Required release path

1. Create a `feature/*`, `fix/*`, `delivery/*`, or `reconcile/*` branch from current `master`.
2. Make the change on that branch. Do not intentionally develop directly on `master`.
3. Open a pull request into `master`.
4. Wait for **Production Safety CI** and the **Vercel Preview** status to succeed.
5. Review the preview for the changed workflow, including responsive UI when relevant.
6. Merge the pull request only after the checks are green.
7. Vercel deploys the merge commit to production.
8. **Production Smoke** waits for Vercel to report success for that exact commit, then verifies the live home page, health endpoint, admin login route, and canonical-domain redirect.
9. If the deployment or smoke check fails, stop further rollout, investigate, and roll back/revert before unrelated changes are added.

## Shared-core rule

Generic product improvements are finalized in The Final Seat first. After the TFS production release is healthy, create a separate FareTransit sync PR containing only approved shared-core changes.

Never sync business-specific boundaries automatically:

- branding, legal identity and support contacts
- payment/secure-payment implementation
- merchant IDs, gateway credentials or secrets
- Supabase projects/data/migrations unless explicitly reconciled
- Vercel environment variables
- FareTransit merchant-demo functionality

The repository ownership rules under `.sync/ownership.yml` are the source of truth for this boundary.

## Production-data safety

Use synthetic records for release verification. Never place full card numbers, CVV/CVC values, production secrets, or temporary passwords in source, PR descriptions, test fixtures, logs, or screenshots committed to GitHub.

## Later upgrade path

When needed, insert a dedicated staging environment between Preview and Production:

`feature -> PR/CI -> Preview -> Staging -> E2E/UAT -> Production`

The current pipeline is intentionally designed so staging can be added later without changing the branch-first release discipline.
