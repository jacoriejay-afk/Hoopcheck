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
-- Bind/redeem lifecycle regression (still rolled back).
create function public.bind_stripe_trial_session(p_user_id uuid,p_session_id text)
returns boolean language plpgsql security invoker set search_path = '' as $trialtest$
declare n integer;
begin
 if p_session_id is null or p_session_id !~ '^cs_' then return false; end if;
 update public.stripe_trial_claims set checkout_session_id=p_session_id
 where user_id=p_user_id and state='reserved'
 and (checkout_session_id is null or checkout_session_id=p_session_id);
 get diagnostics n=row_count;
 return n=1;
end $trialtest$;
create function public.redeem_stripe_trial(p_user_id uuid,p_session_id text)
returns boolean language plpgsql security invoker set search_path = '' as $trialtest$
declare n integer;
begin
 update public.stripe_trial_claims set state='redeemed',redeemed_at=now()
 where user_id=p_user_id and checkout_session_id=p_session_id and state='reserved';
 get diagnostics n=row_count;
 return n=1;
end $trialtest$;
do $trialtest$
declare uid uuid := '11111111-1111-4111-8111-111111111111';
begin
 if public.bind_stripe_trial_session(uid,'invalid') then raise exception 'invalid session accepted'; end if;
 if not public.bind_stripe_trial_session(uid,'cs_test_first') then raise exception 'binding failed'; end if;
 if public.bind_stripe_trial_session(uid,'cs_test_other') then raise exception 'session replaced'; end if;
 if public.redeem_stripe_trial(uid,'cs_test_other') then raise exception 'wrong session redeemed'; end if;
 if not public.redeem_stripe_trial(uid,'cs_test_first') then raise exception 'redemption failed'; end if;
 if public.redeem_stripe_trial(uid,'cs_test_first') then raise exception 'duplicate redemption'; end if;
 if public.bind_stripe_trial_session(uid,'cs_test_first') then raise exception 'redeemed session rebound'; end if;
end $trialtest$;
rollback;
