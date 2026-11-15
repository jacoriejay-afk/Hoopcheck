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

-- SECURITY DEFINER is intentionally restricted to the service role. No client may
-- forge Stripe refund evidence, even when a client can call other RPCs.
create or replace function public.ambassador_record_refund_audit(
  p_refund text, p_charge text, p_amount bigint, p_currency text,
  p_status text, p_created_at timestamptz
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_commission uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  if p_refund is null or p_charge is null or p_amount is null
    or p_currency is null or p_status is null or p_created_at is null then
    raise exception 'missing refund audit fields';
  end if;
  select id into v_commission
    from public.ambassador_commissions where stripe_charge_id = p_charge;
  if v_commission is null then return; end if;
  insert into public.ambassador_refund_audit
    (stripe_refund_id, stripe_charge_id, commission_id, amount_minor,
     currency, refund_status, stripe_created_at)
  values (p_refund, p_charge, v_commission, p_amount, lower(p_currency),
          p_status, p_created_at)
  on conflict (stripe_refund_id) do update
    set refund_status = excluded.refund_status, updated_at = now()
    where public.ambassador_refund_audit.stripe_charge_id = excluded.stripe_charge_id
      and public.ambassador_refund_audit.commission_id = excluded.commission_id
      and public.ambassador_refund_audit.amount_minor = excluded.amount_minor
      and public.ambassador_refund_audit.currency = excluded.currency
      and public.ambassador_refund_audit.stripe_created_at = excluded.stripe_created_at;
end;
$$;
revoke all on function public.ambassador_record_refund_audit(text,text,bigint,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.ambassador_record_refund_audit(text,text,bigint,text,text,timestamptz) to service_role;
