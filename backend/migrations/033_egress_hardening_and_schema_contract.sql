-- 033_egress_hardening_and_schema_contract.sql
-- Egress hardening + schema drift repair identified from July 18-August 11 production logs.

-- 1) Abandoned checkout autosave must be a single UPSERT.
DELETE FROM public.abandoned_bookings a
USING public.abandoned_bookings b
WHERE a.session_key IS NOT NULL
  AND a.session_key = b.session_key
  AND (
    COALESCE(a.updated_at, a.created_at) < COALESCE(b.updated_at, b.created_at)
    OR (COALESCE(a.updated_at, a.created_at) = COALESCE(b.updated_at, b.created_at) AND a.id::text < b.id::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_abandoned_bookings_session_key
  ON public.abandoned_bookings(session_key)
  WHERE session_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_abandoned_bookings_updated_at
  ON public.abandoned_bookings(updated_at DESC);

-- 2) Persist request idempotency instead of probing a missing column.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_client_request_id
  ON public.bookings(client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_idempotency_key
  ON public.bookings(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3) Canonical operational booking/payment statuses are uppercase everywhere.
ALTER TABLE public.bookings ALTER COLUMN status TYPE VARCHAR(50);
ALTER TABLE public.bookings ALTER COLUMN payment_status TYPE VARCHAR(50);

UPDATE public.bookings SET status = UPPER(status) WHERE status IS NOT NULL;
UPDATE public.bookings SET payment_status = UPPER(payment_status) WHERE payment_status IS NOT NULL;
UPDATE public.payments SET payment_status = UPPER(payment_status) WHERE payment_status IS NOT NULL;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (
  'PENDING','AWAITING_AUTHORIZATION','AUTHORIZED','REAUTHORIZATION_REQUIRED',
  'READY_FOR_TICKETING','TICKETED','DONE','FAILED','CANCELLED'
));

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check CHECK (payment_status IN (
  'PENDING','PROCESSING','PAID','FAILED','REFUNDED'
));

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_status_check CHECK (payment_status IN (
  'PENDING','PROCESSING','PAID','FAILED','REFUNDED'
));

-- 4) Fields observed hitting narrow production varchar limits.
-- These changes are widening-only and preserve existing data/constraints.
ALTER TABLE public.contacts ALTER COLUMN country_code TYPE VARCHAR(16);
ALTER TABLE public.contacts ALTER COLUMN phone_number TYPE VARCHAR(50);
ALTER TABLE public.flights ALTER COLUMN carrier_code TYPE VARCHAR(16);
ALTER TABLE public.flights ALTER COLUMN departure_airport TYPE VARCHAR(16);
ALTER TABLE public.flights ALTER COLUMN arrival_airport TYPE VARCHAR(16);

-- 5) Canonical indexes used by high-volume relation lookups.
CREATE INDEX IF NOT EXISTS idx_travellers_booking_id ON public.travellers(booking_id);
CREATE INDEX IF NOT EXISTS idx_contacts_booking_id ON public.contacts(booking_id);
CREATE INDEX IF NOT EXISTS idx_flights_booking_id ON public.flights(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);

NOTIFY pgrst, 'reload schema';
