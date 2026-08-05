-- CRM Stability: canonical financial source of truth
-- Safe to run more than once in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- Ensure both canonical and legacy compatibility columns exist before data reconciliation.
alter table if exists public.bookings
  add column if not exists customer_price numeric(12,2),
  add column if not exists total_amount numeric(12,2),
  add column if not exists original_api_price numeric(12,2),
  add column if not exists supplier_price numeric(12,2),
  add column if not exists taxes numeric(12,2),
  add column if not exists service_fee numeric(12,2),
  add column if not exists supplier_fare numeric(12,2),
  add column if not exists taxes_and_fees numeric(12,2),
  add column if not exists agency_markup numeric(12,2),
  add column if not exists authorized_amount numeric(12,2),
  add column if not exists price_change_reason text,
  add column if not exists transaction_reference text;

update public.bookings
set customer_price = coalesce(customer_price, total_amount, 0),
    total_amount = coalesce(customer_price, total_amount, 0),
    supplier_fare = coalesce(supplier_fare, supplier_price, original_api_price, 0),
    taxes_and_fees = coalesce(taxes_and_fees, taxes, 0),
    agency_markup = coalesce(
      agency_markup,
      service_fee,
      coalesce(customer_price, total_amount, 0)
        - coalesce(supplier_fare, supplier_price, original_api_price, 0)
        - coalesce(taxes_and_fees, taxes, 0)
    ),
    authorized_amount = coalesce(authorized_amount, customer_price, total_amount, 0)
where customer_price is null
   or total_amount is null
   or supplier_fare is null
   or taxes_and_fees is null
   or agency_markup is null
   or authorized_amount is null;

create table if not exists public.booking_price_revisions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  supplier_fare numeric(12,2) not null default 0,
  taxes numeric(12,2) not null default 0,
  taxes_and_fees numeric(12,2),
  agency_markup numeric(12,2) not null default 0,
  customer_total numeric(12,2) not null,
  currency text not null default 'USD',
  reason text not null,
  admin_id text,
  created_at timestamptz not null default now()
);

alter table if exists public.booking_price_revisions
  add column if not exists supplier_fare numeric(12,2),
  add column if not exists taxes numeric(12,2),
  add column if not exists taxes_and_fees numeric(12,2),
  add column if not exists agency_markup numeric(12,2),
  add column if not exists customer_total numeric(12,2),
  add column if not exists currency text default 'USD',
  add column if not exists reason text,
  add column if not exists admin_id text,
  add column if not exists created_at timestamptz default now();

create table if not exists public.payment_authorization_splits (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  merchant_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

alter table if exists public.payment_authorization_splits
  add column if not exists merchant_name text,
  add column if not exists amount numeric(12,2),
  add column if not exists currency text default 'USD',
  add column if not exists created_at timestamptz default now();

create index if not exists idx_booking_price_revisions_booking_created
  on public.booking_price_revisions (booking_id, created_at desc);

create index if not exists idx_payment_authorization_splits_booking
  on public.payment_authorization_splits (booking_id, created_at asc);

-- Financial records must never silently accept invalid negative values.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_customer_price_nonnegative'
  ) then
    alter table public.bookings
      add constraint bookings_customer_price_nonnegative
      check (customer_price is null or customer_price >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bookings_total_amount_nonnegative'
  ) then
    alter table public.bookings
      add constraint bookings_total_amount_nonnegative
      check (total_amount is null or total_amount >= 0) not valid;
  end if;
end $$;

comment on column public.bookings.customer_price is
  'Canonical customer-facing booking total. CRM reads and writes this together with total_amount.';

comment on table public.payment_authorization_splits is
  'Canonical merchant-level payment authorization split records. Split sum must equal bookings.customer_price.';
