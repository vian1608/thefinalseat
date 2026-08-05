-- Durable synchronization state between Supabase bookings and Twenty CRM.
-- This migration is intentionally non-destructive and does not alter booking data.

CREATE TABLE IF NOT EXISTS public.twenty_crm_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  booking_reference text NOT NULL,
  twenty_booking_id text,
  sync_status text NOT NULL DEFAULT 'PENDING'
    CHECK (sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'DISABLED')),
  last_synced_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  source_updated_at timestamptz,
  twenty_updated_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id),
  UNIQUE (booking_reference)
);

CREATE INDEX IF NOT EXISTS idx_twenty_crm_sync_state_status
  ON public.twenty_crm_sync_state(sync_status, last_attempt_at);

CREATE INDEX IF NOT EXISTS idx_twenty_crm_sync_state_twenty_booking
  ON public.twenty_crm_sync_state(twenty_booking_id)
  WHERE twenty_booking_id IS NOT NULL;

COMMENT ON TABLE public.twenty_crm_sync_state IS
  'Tracks synchronization between The Final Seat bookings and Twenty CRM without making Twenty part of the customer checkout transaction.';

COMMENT ON COLUMN public.twenty_crm_sync_state.last_error_message IS
  'Safe operational error only. Never store API keys, full card data, CVV, tokens, or passenger-sensitive payloads here.';

-- Service-role backend access is expected. No anonymous/client policies are added.
ALTER TABLE public.twenty_crm_sync_state ENABLE ROW LEVEL SECURITY;
