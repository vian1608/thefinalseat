# Environment Safety Policy

## Production
- real traffic and real customer/business data
- no experimental writes or destructive QA
- non-destructive smoke checks only after release

## Staging
- production-like code candidate
- synthetic data only until isolated staging database is connected
- no real payment charges, real ticket issuance or real-customer email sends during QA

## Preview/develop
- integration and feature validation
- no reliance on production credentials for destructive workflows

## Secrets
All environment-specific secrets remain in managed environment configuration, not GitHub source. Payment gateway keys, Supabase server secrets, email credentials and JWT secrets must never be committed.

## Database
Prefer additive, backward-compatible migrations. Existing applied migrations are immutable. Destructive schema/data changes require explicit documented intent and rollback planning.
