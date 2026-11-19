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

-- Bind a reservation to its Checkout Session once Stripe creates it.
-- Service-role only. Refuse to replace a different session or redeem twice.
create or replace function public.bind_stripe_trial_session(
  p_user_id uuid, p_session_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_updated integer;
begin
  if p_session_id is null or p_session_id !~ '^cs_' then
    return false;
  end if;
  update public.stripe_trial_claims
     set checkout_session_id = p_session_id
   where user_id = p_user_id
     and state = 'reserved'
     and (checkout_session_id is null or checkout_session_id = p_session_id);
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;
revoke all on function public.bind_stripe_trial_session(uuid,text) from public, anon, authenticated;
grant execute on function public.bind_stripe_trial_session(uuid,text) to service_role;

-- Redeem only when the signed Stripe webhook confirms trialing status
-- and the session matches the previously bound reservation.
create or replace function public.redeem_stripe_trial(
  p_user_id uuid, p_session_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $trialbody$
declare v_updated integer;
begin
  update public.stripe_trial_claims
     set state = 'redeemed', redeemed_at = now()
   where user_id = p_user_id
     and checkout_session_id = p_session_id
     and state = 'reserved';
  get diagnostics v_updated = row_count;
  if v_updated = 1 then
    return true;
  end if;
  -- Stripe can redeliver an event after the reservation was redeemed
  -- but before the webhook's event ledger was marked complete.
  -- A replay for the exact same session is safe; a different one is not.
  return exists (
    select 1 from public.stripe_trial_claims
     where user_id = p_user_id
       and checkout_session_id = p_session_id
       and state = 'redeemed'
       and redeemed_at is not null
  );
end;
$trialbody$;
revoke all on function public.redeem_stripe_trial(uuid,text) from public, anon, authenticated;
grant execute on function public.redeem_stripe_trial(uuid,text) to service_role;

-- Release a reservation only after server-side Stripe reconciliation has
-- independently confirmed the session is expired and no trial was granted.
-- The caller must supply the exact bound session; never release redeemed rows.
create or replace function public.release_expired_stripe_trial(
  p_user_id uuid, p_session_id text
)
returns boolean language plpgsql security invoker set search_path = ''
as $releasebody$
declare v_deleted integer;
begin
  if p_session_id is null or p_session_id !~ '^cs_' then
    return false;
  end if;
  delete from public.stripe_trial_claims
   where user_id = p_user_id
     and checkout_session_id = p_session_id
     and state = 'reserved';
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$releasebody$;
revoke all on function public.release_expired_stripe_trial(uuid,text) from public, anon, authenticated;
grant execute on function public.release_expired_stripe_trial(uuid,text) to service_role;
