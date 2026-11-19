-- Isolated Postgres test. Never run against production.
begin;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create table public.stripe_trial_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null default 'reserved' check (state in ('reserved','redeemed')),
  checkout_session_id text unique,
  reserved_at timestamptz not null default now(),
  redeemed_at timestamptz,
  constraint redeemed_requires_timestamp check (state <> 'redeemed' or redeemed_at is not null)
);
alter table public.stripe_trial_claims enable row level security;
revoke all on public.stripe_trial_claims from public;
create function public.reserve_stripe_trial(p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_inserted integer;
begin
 insert into public.stripe_trial_claims(user_id) values (p_user_id)
 on conflict (user_id) do nothing;
 get diagnostics v_inserted = row_count;
 return v_inserted = 1;
end;
$$;
revoke all on function public.reserve_stripe_trial(uuid) from public;
do $$
declare uid uuid := '11111111-1111-4111-8111-111111111111';
begin
 insert into auth.users(id) values(uid);
 if not public.reserve_stripe_trial(uid) then raise exception 'first reservation failed'; end if;
 if public.reserve_stripe_trial(uid) then raise exception 'duplicate reservation succeeded'; end if;
 if (select count(*) from public.stripe_trial_claims where user_id=uid) <> 1 then
  raise exception 'unexpected reservation count';
 end if;
end $$;
rollback;
