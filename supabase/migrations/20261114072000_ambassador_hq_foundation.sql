-- AMB-1 foundation. No ambassador is activated by this migration.
-- Only service_role may mutate these tables; authenticated ambassadors can read their own grants and commissions.
create table if not exists public.ambassador_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  code text not null,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  commission_rate_bps integer check (commission_rate_bps between 0 and 10000),
  agreement_signed_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ambassador_activation_requires_contract check (
    status <> 'active' or (agreement_signed_at is not null and commission_rate_bps is not null and activated_at is not null)
  ),
  constraint ambassador_code_format check (code ~ '^[A-Z0-9_-]{4,40}$')
);
create unique index if not exists ambassador_grants_code_unique on public.ambassador_grants (upper(code));

create table if not exists public.ambassador_attributions (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassador_grants(id) on delete restrict,
  referred_user_id uuid not null unique references auth.users(id) on delete restrict,
  captured_at timestamptz not null default now(),
  first_paid_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);
create index if not exists ambassador_attributions_owner_idx on public.ambassador_attributions(ambassador_id);
create unique index if not exists ambassador_attributions_subscription_idx
  on public.ambassador_attributions(stripe_subscription_id) where stripe_subscription_id is not null;

create table if not exists public.ambassador_commissions (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassador_grants(id) on delete restrict,
  attribution_id uuid not null references public.ambassador_attributions(id) on delete restrict,
  stripe_invoice_id text not null unique,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  gross_minor bigint not null check (gross_minor >= 0),
  net_minor bigint not null check (net_minor >= 0),
  commission_rate_bps integer not null check (commission_rate_bps between 0 and 10000),
  commission_minor bigint not null check (commission_minor >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','reversed')),
  paid_invoice_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists ambassador_commissions_owner_idx on public.ambassador_commissions(ambassador_id, created_at desc);

create table if not exists public.ambassador_commission_adjustments (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.ambassador_commissions(id) on delete restrict,
  stripe_refund_id text unique,
  amount_minor bigint not null check (amount_minor >= 0),
  reason text not null check (reason in ('refund','dispute','correction')),
  created_at timestamptz not null default now()
);

create table if not exists public.ambassador_payouts (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassador_grants(id) on delete restrict,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','cancelled')),
  approved_at timestamptz,
  paid_at timestamptz,
  external_reference text,
  created_at timestamptz not null default now()
);
create table if not exists public.ambassador_payout_items (
  payout_id uuid not null references public.ambassador_payouts(id) on delete restrict,
  commission_id uuid not null unique references public.ambassador_commissions(id) on delete restrict,
  primary key (payout_id, commission_id)
);

alter table public.ambassador_grants enable row level security;
alter table public.ambassador_attributions enable row level security;
alter table public.ambassador_commissions enable row level security;
alter table public.ambassador_commission_adjustments enable row level security;
alter table public.ambassador_payouts enable row level security;
alter table public.ambassador_payout_items enable row level security;

revoke all on public.ambassador_grants, public.ambassador_attributions,
  public.ambassador_commissions, public.ambassador_commission_adjustments,
  public.ambassador_payouts, public.ambassador_payout_items from public, anon, authenticated;
grant select on public.ambassador_grants, public.ambassador_commissions,
  public.ambassador_commission_adjustments, public.ambassador_payouts,
  public.ambassador_payout_items to authenticated;
grant all on public.ambassador_grants, public.ambassador_attributions,
  public.ambassador_commissions, public.ambassador_commission_adjustments,
  public.ambassador_payouts, public.ambassador_payout_items to service_role;

create policy ambassador_read_own_grant on public.ambassador_grants
  for select to authenticated using (user_id = (select auth.uid()));
create policy ambassador_read_own_commissions on public.ambassador_commissions
  for select to authenticated using (exists (
    select 1 from public.ambassador_grants g
    where g.id = ambassador_id and g.user_id = (select auth.uid())
  ));
create policy ambassador_read_own_adjustments on public.ambassador_commission_adjustments
  for select to authenticated using (exists (
    select 1 from public.ambassador_commissions c
    join public.ambassador_grants g on g.id = c.ambassador_id
    where c.id = commission_id and g.user_id = (select auth.uid())
  ));
create policy ambassador_read_own_payouts on public.ambassador_payouts
  for select to authenticated using (exists (
    select 1 from public.ambassador_grants g
    where g.id = ambassador_id and g.user_id = (select auth.uid())
  ));
create policy ambassador_read_own_payout_items on public.ambassador_payout_items
  for select to authenticated using (exists (
    select 1 from public.ambassador_payouts p
    join public.ambassador_grants g on g.id = p.ambassador_id
    where p.id = payout_id and g.user_id = (select auth.uid())
  ));
-- Attribution records intentionally remain service-role-only to avoid exposing referred users.
