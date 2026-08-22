# Pipeline Status Reference

Environment branches:
- integration: `develop`
- pre-production: `staging`
- production: `master`

Primary automated gates:
- `Delivery Gates` on PRs into develop/staging/master
- `Staging Quality` on staging pushes
- `Production Safety CI` on production PR/push
- `Production Smoke` on production pushes and scheduled monitoring

Vercel Preview is the deployed review/staging surface for non-production branches.
