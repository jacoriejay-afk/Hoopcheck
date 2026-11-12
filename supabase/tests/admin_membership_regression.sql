\set ON_ERROR_STOP on
create schema if not exists auth;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create table public.admin_roles(user_id uuid not null, role text not null);
create table public.subscriptions(
  user_id uuid primary key, plan text, status text, access_status text,
  stripe_price_id text, stripe_subscription_id text,
  current_period_end timestamptz, cancel_at_period_end boolean,
  updated_at timestamptz default now(), billing_interval text
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
\i supabase/migrations/20261112163000_admin_only_membership_grants.sql
do $$
declare f oid;
begin
  select 'public.admin_set_membership(uuid,text)'::regprocedure::oid into f;
  if has_function_privilege('anon',f,'EXECUTE') then raise exception 'anon execute allowed'; end if;
  if not has_function_privilege('authenticated',f,'EXECUTE') then raise exception 'authenticated execute missing'; end if;
end $$;
insert into public.admin_roles values
 ('11111111-1111-1111-1111-111111111111','admin'),
 ('22222222-2222-2222-2222-222222222222','moderator');
insert into public.subscriptions(user_id,stripe_subscription_id)
 values ('44444444-4444-4444-4444-444444444444','sub_fixture');
do $$
declare who uuid; denied boolean;
begin
  foreach who in array array[
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub',who::text,true);
    denied:=false;
    begin
      perform public.admin_set_membership('55555555-5555-5555-5555-555555555555','premium');
    exception when insufficient_privilege then denied:=true;
    end;
    if not denied then raise exception 'non-admin membership grant succeeded: %',who; end if;
  end loop;
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  if not public.admin_set_membership('55555555-5555-5555-5555-555555555555','premium') then
    raise exception 'admin grant failed';
  end if;
  if (select plan from public.subscriptions where user_id='55555555-5555-5555-5555-555555555555') <> 'premium'
    then raise exception 'premium plan not persisted'; end if;
  denied:=false;
  begin
    perform public.admin_set_membership('44444444-4444-4444-4444-444444444444','free');
  exception when others then denied:=true;
  end;
  if not denied then raise exception 'Stripe-linked subscription was mutable'; end if;
  if not exists(select 1 from public.subscriptions where user_id='44444444-4444-4444-4444-444444444444' and stripe_subscription_id='sub_fixture')
    then raise exception 'Stripe fixture modified'; end if;
end $$;
