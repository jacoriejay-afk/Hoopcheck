-- Apple IAP foundation only.
-- Additive schema: intentionally does not alter public.subscriptions or Stripe-owned columns.
-- Runtime handlers must verify Apple's signed data before writing any rows.

-- Server-only mapping between an authenticated HoopCheck user and Apple's
-- appAccountToken. Generate once per user with a cryptographically random UUID;
-- never accept a token supplied by an unauthenticated client as ownership proof.
create table if not exists public.apple_iap_account_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_account_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.apple_iap_account_tokens enable row level security;
-- No authenticated-client policies or grants: only trusted server code may read/write tokens.

create table if not exists public.apple_iap_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_transaction_id text not null,
  latest_transaction_id text not null,
  product_id text not null,
  plan text not null check (plan in ('pro', 'premium')),
  environment text not null check (environment in ('Sandbox', 'Production', 'Xcode')),
  status text not null check (status in (
    'active', 'billing_retry', 'grace_period', 'expired', 'revoked', 'refunded', 'unknown'
  )),
  current_period_start timestamptz,
  current_period_end timestamptz,
  revoked_at timestamptz,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apple_iap_subscriptions_original_transaction_key unique (environment, original_transaction_id)
);

create index if not exists apple_iap_subscriptions_user_status_idx
  on public.apple_iap_subscriptions (user_id, status, current_period_end);

create table if not exists public.apple_iap_transactions (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('Sandbox', 'Production', 'Xcode')),
  transaction_id text not null,
  original_transaction_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  transaction_type text not null default 'subscription',
  purchased_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  signed_date timestamptz,
  created_at timestamptz not null default now(),
  constraint apple_iap_transactions_transaction_key unique (environment, transaction_id)
);

create index if not exists apple_iap_transactions_original_idx
  on public.apple_iap_transactions (environment, original_transaction_id);

-- The UUID makes duplicate App Store Server Notifications V2 deliveries idempotent.
-- Store only processing metadata here, not unverified payloads or private credentials.
create table if not exists public.apple_iap_notification_events (
  notification_uuid text primary key,
  environment text not null check (environment in ('Sandbox', 'Production', 'Xcode')),
  notification_type text not null,
  subtype text,
  signed_date timestamptz,
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'retryable_error', 'rejected')),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists apple_iap_notification_events_pending_idx
  on public.apple_iap_notification_events (created_at)
  where processed_at is null;

alter table public.apple_iap_subscriptions enable row level security;
alter table public.apple_iap_transactions enable row level security;
alter table public.apple_iap_notification_events enable row level security;

-- Deliberately no authenticated-client policies or grants.
-- Server-side service-role handlers must be the only writers/readers until a reviewed
-- account-facing status endpoint is implemented. Never use these tables as a direct
-- replacement for public.subscriptions; entitlement reconciliation is a separate step.

comment on table public.apple_iap_subscriptions is
  'Apple subscription state after server-side App Store signed-data verification; separate from Stripe.';
comment on table public.apple_iap_transactions is
  'Idempotent Apple transaction ledger; values must originate from verified App Store signed transaction data.';
comment on table public.apple_iap_notification_events is
  'App Store Server Notifications V2 idempotency and processing ledger; notification signatures must be verified before applying state.';
