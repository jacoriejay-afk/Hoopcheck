-- Durable, atomic Stripe webhook event claims with lease-based retry recovery.
-- Review before applying to production; webhook source uses these RPCs only after deployment.

create table if not exists public.stripe_webhook_event_claims (
  stripe_event_id text primary key,
  event_type text not null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  lease_expires_at timestamptz,
  claim_token uuid,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_webhook_event_claims_status_lease_idx
  on public.stripe_webhook_event_claims (status, lease_expires_at);

-- Preserve prior deduplication history so migration rollout does not replay
-- Stripe events already recorded by the existing webhook implementation.
insert into public.stripe_webhook_event_claims (
  stripe_event_id, event_type, status, lease_expires_at, created_at, updated_at
)
select stripe_event_id, event_type, 'processed', null, now(), now()
from public.subscription_events
on conflict (stripe_event_id) do nothing;

alter table public.stripe_webhook_event_claims add column if not exists claim_token uuid;

alter table public.stripe_webhook_event_claims enable row level security;
revoke all on table public.stripe_webhook_event_claims from public, anon, authenticated;

create or replace function public.claim_stripe_webhook_event(
  p_stripe_event_id text,
  p_event_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_claim_token uuid := gen_random_uuid();
  v_claimed_token uuid;
  v_current_status text;
begin
  if nullif(trim(p_stripe_event_id), '') is null
     or nullif(trim(p_event_type), '') is null then
    raise exception 'Stripe event ID and type are required';
  end if;

  insert into public.stripe_webhook_event_claims (
    stripe_event_id, event_type, status, lease_expires_at, claim_token, updated_at
  )
  values (
    p_stripe_event_id, p_event_type, 'processing', now() + interval '5 minutes', v_claim_token, now()
  )
  on conflict (stripe_event_id) do update
    set event_type = excluded.event_type,
        status = 'processing',
        lease_expires_at = now() + interval '5 minutes',
        claim_token = v_claim_token,
        last_error = null,
        updated_at = now()
    where public.stripe_webhook_event_claims.status = 'failed'
       or (
         public.stripe_webhook_event_claims.status = 'processing'
         and public.stripe_webhook_event_claims.lease_expires_at < now()
       )
  returning claim_token into v_claimed_token;

  if v_claimed_token is not null then
    return jsonb_build_object('status', 'claimed', 'claim_token', v_claimed_token);
  end if;

  select status into v_current_status
  from public.stripe_webhook_event_claims
  where stripe_event_id = p_stripe_event_id;

  if v_current_status = 'processed' then
    return jsonb_build_object('status', 'processed', 'claim_token', null);
  end if;

  return jsonb_build_object('status', 'in_progress', 'claim_token', null);
end;
$function$;

create or replace function public.complete_stripe_webhook_event(
  p_stripe_event_id text,
  p_event_type text,
  p_claim_token uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if not exists (
    select 1
    from public.stripe_webhook_event_claims
    where stripe_event_id = p_stripe_event_id
      and status = 'processing'
      and claim_token = p_claim_token
  ) then
    raise exception 'Stripe webhook event is not currently claimed';
  end if;

  insert into public.subscription_events (stripe_event_id, event_type, payload)
  values (p_stripe_event_id, p_event_type, p_payload)
  on conflict (stripe_event_id) do nothing;

  update public.stripe_webhook_event_claims
  set status = 'processed',
      lease_expires_at = null,
      claim_token = null,
      last_error = null,
      updated_at = now()
  where stripe_event_id = p_stripe_event_id
    and status = 'processing'
    and claim_token = p_claim_token;

  if not found then
    raise exception 'Stripe webhook claim ownership changed before completion';
  end if;
end;
$function$;

create or replace function public.release_stripe_webhook_event(
  p_stripe_event_id text,
  p_claim_token uuid,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  update public.stripe_webhook_event_claims
  set status = 'failed',
      lease_expires_at = null,
      claim_token = null,
      last_error = left(coalesce(p_error, 'Webhook processing failed'), 1000),
      updated_at = now()
  where stripe_event_id = p_stripe_event_id
    and status = 'processing'
    and claim_token = p_claim_token;
end;
$function$;

revoke all on function public.claim_stripe_webhook_event(text, text) from public, anon, authenticated;
revoke all on function public.complete_stripe_webhook_event(text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.release_stripe_webhook_event(text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text) to service_role;
grant execute on function public.complete_stripe_webhook_event(text, text, uuid, jsonb) to service_role;
grant execute on function public.release_stripe_webhook_event(text, uuid, text) to service_role;
