create extension if not exists pgcrypto;

create table if not exists public.booking_addons (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  traveller_id uuid references public.travellers(id) on delete cascade,
  traveler_index integer check (traveler_index is null or traveler_index >= 0),
  addon_type text not null check (addon_type in ('FLEX_ASSIST','CHECKED_BAGGAGE')),
  journey_scope text not null default 'ALL' check (journey_scope in ('ALL','OUTBOUND','RETURN')),
  quantity integer not null default 1 check (quantity between 1 and 3),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_price numeric(12,2) not null default 0 check (total_price >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  pricing_source text not null default 'FORMULA' check (pricing_source in ('FORMULA','AIRLINE','SUPPLIER','REQUEST_ONLY','POST_RESERVATION_QUOTE')),
  status text not null default 'ACTIVE',
  terms_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_booking_addons_flex
  on public.booking_addons(booking_id, addon_type)
  where addon_type = 'FLEX_ASSIST';

create unique index if not exists uq_booking_addons_baggage
  on public.booking_addons(booking_id, traveller_id, journey_scope, addon_type)
  where addon_type = 'CHECKED_BAGGAGE';

create index if not exists idx_booking_addons_booking on public.booking_addons(booking_id);
create index if not exists idx_booking_addons_traveller on public.booking_addons(traveller_id);
create index if not exists idx_booking_addons_status on public.booking_addons(status);

create table if not exists public.addon_quotes (
  id uuid primary key default gen_random_uuid(),
  addon_id uuid not null unique references public.booking_addons(id) on delete cascade,
  supplier_cost numeric(12,2) check (supplier_cost is null or supplier_cost >= 0),
  customer_price numeric(12,2) check (customer_price is null or customer_price >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  valid_until timestamptz,
  payment_url text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','EXPIRED','ACCEPTED','DECLINED','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (supplier_cost is null or customer_price is null or customer_price >= supplier_cost)
);

create table if not exists public.addon_payments (
  id uuid primary key default gen_random_uuid(),
  addon_id uuid not null unique references public.booking_addons(id) on delete cascade,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  payment_provider text,
  provider_transaction_id text unique,
  status text not null default 'NOT_REQUIRED_YET' check (status in ('NOT_REQUIRED_YET','AWAITING_PAYMENT','PENDING','PROCESSING','PAID','FAILED','REFUNDED')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addon_fulfillments (
  id uuid primary key default gen_random_uuid(),
  addon_id uuid not null unique references public.booking_addons(id) on delete cascade,
  supplier text,
  supplier_reference text,
  status text not null default 'PURCHASE_PENDING' check (status in ('PURCHASE_PENDING','CONFIRMED','PURCHASE_FAILED','REFUNDED','CANCELLED')),
  notes text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flex_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_addon_id uuid not null references public.booking_addons(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  request_type text not null check (request_type in ('TRAVEL_DATE','FLIGHT_TIME','FLIGHT','DESTINATION','OTHER')),
  requested_details jsonb not null default '{}'::jsonb,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','REVIEWING','OPTION_FOUND','CUSTOMER_APPROVAL','REBOOKING','COMPLETED','DECLINED','CANCELLED')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_flex_change_requests_booking on public.flex_change_requests(booking_id);
create index if not exists idx_flex_change_requests_status on public.flex_change_requests(status);

alter table public.booking_addons enable row level security;
alter table public.addon_quotes enable row level security;
alter table public.addon_payments enable row level security;
alter table public.addon_fulfillments enable row level security;
alter table public.flex_change_requests enable row level security;

revoke all on table public.booking_addons, public.addon_quotes, public.addon_payments, public.addon_fulfillments, public.flex_change_requests from anon, authenticated;
grant select, insert, update, delete on table public.booking_addons, public.addon_quotes, public.addon_payments, public.addon_fulfillments, public.flex_change_requests to service_role;
