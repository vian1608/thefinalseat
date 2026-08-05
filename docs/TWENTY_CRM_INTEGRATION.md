# Twenty CRM integration for The Final Seat

## Goal

Keep `thefinalseat.com` as the customer-facing website while using Twenty as the operational CRM for:

- booking management
- passengers and flight segments
- pricing revisions
- merchant payment splits
- booking confirmation email
- passenger authorization email
- PNR and final-ticket email
- safe billing/card metadata
- delivery history and audit status

Twenty must not receive full card numbers, CVV/CVC, PINs, authorization secrets, admin tokens, or provider API keys.

## Rollout strategy

### Phase 1 — safe shadow synchronization

Supabase remains the source of truth. New and selected existing bookings are copied to Twenty. CRM failures do not block checkout.

### Phase 2 — operational CRM

Twenty becomes the admin interface. The current React admin dashboard remains available as a fallback while actions are verified.

### Phase 3 — CRM source of truth

Twenty becomes authoritative for operational fields. Supabase keeps the public/customer-facing read model and immutable evidence tables.

## Required Twenty custom objects

Create these custom objects in **Settings → Data Model**. Record the generated plural API name for each object from **Settings → API & Webhooks**.

### TFS Booking (`tfsBookings` suggested)

| Field | Type | Notes |
|---|---|---|
| bookingReference | Text, unique | `TFS-...` public reference |
| externalBookingId | Text, unique | Supabase booking UUID |
| customerName | Text | Primary passenger/customer |
| customerEmail | Email | |
| customerPhone | Phone/Text | |
| bookingStatus | Select | PENDING, CONFIRMED, DONE, FAILED, CANCELLED |
| paymentStatus | Select | PENDING, PROCESSING, PAID, FAILED, REFUNDED |
| authorizationStatus | Select | NOT_SENT, AWAITING_PASSENGER, ACCEPTED, EXPIRED, FAILED, REAUTHORIZATION_REQUIRED |
| ticketingStatus | Select | NOT_TICKETED, READY_FOR_TICKETING, TICKETED |
| tripType | Select | ONE_WAY, ROUND_TRIP, MULTI_CITY |
| passengerCount | Number | |
| supplierFare | Currency | USD initially |
| taxesAndFees | Currency | |
| agencyServiceFee | Currency | |
| customerTotal | Currency | Canonical operational total |
| currency | Text/Select | USD initially |
| routeSummary | Text | e.g. JFK → LAS |
| carrierSummary | Text | |
| departureDate | Date | |
| returnDate | Date | optional |
| internalNotes | Long text | |
| sourceUpdatedAt | Date-time | Supabase `updated_at` |

### TFS Flight Segment (`tfsFlightSegments` suggested)

Fields:

- bookingReference
- externalSegmentId
- journeyType
- segmentOrder
- airlineName
- carrierCode
- flightNumber
- originAirport
- destinationAirport
- departureAt
- arrivalAt
- cabinClass

Add a relation to TFS Booking after the base integration is verified.

### TFS Payment Split (`tfsPaymentSplits` suggested)

Fields:

- bookingReference
- externalSplitId
- merchantName
- amount
- currency
- status
- transactionReference

Add a relation to TFS Booking after the base integration is verified.

### Later objects

After the first synchronization test passes, add:

- TFS Passenger
- TFS Authorization Request
- TFS Ticket Detail
- TFS Email Delivery
- TFS Billing Reference

Authorization acceptance evidence and ticket snapshots should remain immutable in the existing backend database and be represented in Twenty by status/reference fields rather than being rewritten.

## Credentials required

Create a dedicated Twenty integration user/role with access only to the TFS custom objects. Then create an API key under **Settings → API & Webhooks**.

Configure these Vercel/backend variables:

```env
TWENTY_SYNC_ENABLED=false
TWENTY_BASE_URL=https://api.twenty.com
TWENTY_API_KEY=...
TWENTY_WEBHOOK_SECRET=...
TWENTY_REQUEST_TIMEOUT_MS=15000
TWENTY_BOOKINGS_OBJECT=tfsBookings
TWENTY_FLIGHT_SEGMENTS_OBJECT=tfsFlightSegments
TWENTY_PAYMENT_SPLITS_OBJECT=tfsPaymentSplits
```

Keep `TWENTY_SYNC_ENABLED=false` until the custom objects and API names are confirmed.

## Webhook

Create a Twenty webhook pointing to:

```text
https://www.thefinalseat.com/api/twenty/webhook
```

The backend validates `X-Twenty-Webhook-Signature` and `X-Twenty-Webhook-Timestamp` using `TWENTY_WEBHOOK_SECRET`.

## Health check

After deployment:

```text
GET /api/twenty/status
```

The response intentionally reports only whether the integration is configured and the API hostname. It never returns the API key.

## Safety rules

- Do not enable dual writes as a checkout requirement during phase 1.
- Do not independently edit the same financial field in both systems.
- Do not send emails from both the old admin dashboard and Twenty for the same action without idempotency.
- Do not store full PAN, CVV/CVC, PIN, raw authorization tokens, or admin credentials in Twenty.
- Do not migrate real bookings until one complete test booking passes refresh, email, authorization, ticketing, and audit checks.

## First end-to-end test

Use a test booking and verify:

1. Booking appears in Twenty with the same TFS reference.
2. Passenger and itinerary data are correct.
3. Customer total matches Supabase.
4. Merchant split total matches customer total.
5. Updating a CRM field produces a signed webhook.
6. No duplicate record is created on retry.
7. No real customer email is sent during testing.
