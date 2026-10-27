-- HoopCheck Apple IAP groundwork.
-- Separate provider records from public.subscriptions so Apple transactions
-- never overwrite Stripe customer/subscription identifiers or billing state.
-- This migration is intentionally additive; entitlement consumers are not
-- switched until server-side StoreKit verification and the shared resolver exist.

create table if not exists public.apple_subscription_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id text not null unique,
  original_transaction_id text not null,
  product_id text not null check (
    product_id in (
      'online.hoopcheck.pro.monthly',
      'online.hoopcheck.premium.monthly'
    )
  ),
  environment text not null check (environment in ('Sandbox', 'Production', 'Xcode')),
  transaction_status text not null check (
    transaction_status in ('active', 'expired', 'revoked', 'billing_retry', 'grace_period', 'unknown')
  ) default 'unknown',
  purchased_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  signed_transaction_jws text not null,
  app_account_token uuid,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apple_subscription_transactions_user_status_expiry_idx
  on public.apple_subscription_transactions (user_id, transaction_status, expires_at desc);

create index if not exists apple_subscription_transactions_original_id_idx
  on public.apple_subscription_transactions (original_transaction_id);

alter table public.apple_subscription_transactions enable row level security;

-- Clients may inspect only their own verified records. No client INSERT/UPDATE/
-- DELETE policies are provided; writes must use a trusted server/service role
-- after validating Apple's signed transaction and ownership mapping.
drop policy if exists "Users read own Apple subscription transactions"
  on public.apple_subscription_transactions;

create policy "Users read own Apple subscription transactions"
  on public.apple_subscription_transactions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

comment on table public.apple_subscription_transactions is
  'Server-verified Apple StoreKit subscription transactions; kept separate from Stripe-shaped public.subscriptions. Client writes are intentionally not allowed.';
comment on column public.apple_subscription_transactions.signed_transaction_jws is
  'Signed StoreKit transaction JWS retained for audit/reconciliation; never accept as verified until server-side signature and App Store transaction checks succeed.';
