# The Final Seat / FareTransit shared-core reconciliation

Date: 2026-08-22

## Direction

The Final Seat (`vian1608/thefinalseat`, `master`) is the canonical shared-product repository.
FareTransit (`vian1608/FareTransit`, `main`) remains a separate branded deployment and receives reviewed shared-core changes by pull request.

The repositories, databases, production secrets, legal identity, branding, payment implementation and deployment configuration remain separate.

## Initial audit

The applications already share the same major product areas: flights, hotels, cars, bookings, journey, customers, authorizations and back office. Several modules are byte-identical, while admin, booking, car, flight, payment and secure-payment areas have diverged.

### FareTransit improvements promoted to canonical core

- Car-rental location autocomplete now uses the broad flight airport source plus Booking.com city catalogs with fallback data instead of a small hard-coded list.
- Booking.com common location catalog requests use the correct POST method.
- Airport autocomplete normalizes malformed international geography returned as fake US state/country data.
- Booking DTO mapping no longer invents taxes, service fees, payment providers or authorization amounts when the underlying data is unknown.
- Added a regression contract that enforces truthful booking projections.

### The Final Seat improvements selected for FareTransit

- Medellin/MDE added to the local airport catalog.
- Airport autocomplete prefers the local catalog before spending paid SerpAPI requests.
- Very short autocomplete fragments do not trigger paid SerpAPI fallback searches.
- Duplicate identical flight searches share in-flight provider work and use a short-lived result cache.

## Protected FareTransit behavior

The reconciliation deliberately does not copy The Final Seat payment/secure-payment implementation into FareTransit. FareTransit keeps its manual masked-payment metadata model, no VGS runtime, read-only merchant demo, FareTransit branding, FareTransit legal content, its own Supabase project, Vercel configuration and production secrets.

## Protected The Final Seat behavior

The Final Seat keeps its own brand, legal content, support contacts, payment stack, data, environment variables and deployment configuration. Payment convergence will happen only through a provider-neutral interface, not by copying processor-specific files.

## Change-delivery rule

1. Generic changes are developed or promoted into The Final Seat first.
2. The Final Seat release must pass its own tests.
3. A downstream FareTransit branch/PR receives only reviewed shared-core files.
4. FareTransit identity, payment, demo and infrastructure guards run before merge.
5. FareTransit-specific generic improvements are promoted upstream before they become canonical.

See `.sync/ownership.yml` for the machine-readable ownership boundary.
