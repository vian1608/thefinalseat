# Release Stage Map

| Stage | Git ref | Deployment | Purpose | Data rule |
|---|---|---|---|---|
| Local | developer machine | localhost | active coding | test data only |
| Feature | feature/fix branch | Vercel Preview | isolated change review | test data only |
| Develop | `develop` | Vercel Preview | integration | no destructive production-data testing |
| Staging | `staging` | Vercel Preview | full QA/UAT | synthetic data; isolated staging DB when provisioned |
| Production | `master` | www.thefinalseat.com | real users | production data |

Normal promotion is `feature -> develop -> staging -> master`.
