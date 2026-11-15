-- Issue #668: individual Stripe refund audit, separate from cumulative charge deductions.
-- This table is intentionally server-only. Do not grant anon/authenticated access.
create table if not exists public.ambassador_refund_audit (
  stripe_refund_id text primary key,
  stripe_charge_id text not null,
  commission_id uuid not null references public.ambassador_commissions(id) on delete restrict,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (char_length(currency) = 3),
  refund_status text not null,
  stripe_created_at timestamptz not null,
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ambassador_refund_audit_refund_id_format check (stripe_refund_id like 're_%'),
  constraint ambassador_refund_audit_charge_id_format check (stripe_charge_id like 'ch_%')
);
create index if not exists ambassador_refund_audit_commission_idx
  on public.ambassador_refund_audit (commission_id, stripe_created_at);
alter table public.ambassador_refund_audit enable row level security;
revoke all on table public.ambassador_refund_audit from anon, authenticated;
-- Deliberately no client RLS policy. Webhook writes require the service role.
-- Existing ambassador_commission_adjustments remain cumulative delta entries.
-- This migration is additive; it does not backfill or change production commissions.
