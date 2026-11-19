-- PROPOSAL ONLY: not applied to any database.
-- Trial reservation uses a unique user key to serialize concurrent checkout claims.
-- A claim is not proof of trial redemption; finalize only after Stripe confirms
-- the subscription is trialing. Abandoned sessions need a separately audited
-- expiration/reconciliation workflow before any automatic release.
create table if not exists public.stripe_trial_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null default 'reserved'
    check (state in ('reserved', 'redeemed')),
  checkout_session_id text unique,
  reserved_at timestamptz not null default now(),
  redeemed_at timestamptz,
  constraint redeemed_requires_timestamp check (state <> 'redeemed' or redeemed_at is not null)
);
alter table public.stripe_trial_claims enable row level security;
revoke all on public.stripe_trial_claims from anon, authenticated;
-- Only the server-side service role can claim; do not expose an
-- unauthenticated SECURITY DEFINER RPC for this operation.
create or replace function public.reserve_stripe_trial(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_inserted integer;
begin
  insert into public.stripe_trial_claims(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;
revoke all on function public.reserve_stripe_trial(uuid) from public, anon, authenticated;
grant execute on function public.reserve_stripe_trial(uuid) to service_role;
