\set ON_ERROR_STOP on
begin;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role hoopcheck_pending_signup nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key, email text, email_confirmed_at timestamptz,
  created_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb
);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create or replace function auth.role() returns text language sql stable as
$$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create table if not exists public.profiles (id uuid primary key);
create table if not exists public.subscriptions (user_id uuid, stripe_customer_id text);
alter table public.subscriptions add column if not exists stripe_customer_id text;
\ir ../migrations/20261114072000_ambassador_hq_foundation.sql
\ir ../migrations/20261114072854_ambassador_hq_workflows.sql
\ir ../candidates/ambassador_resume_signed_term.sql

insert into auth.users(id,email,email_confirmed_at,created_at,raw_app_meta_data,raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111','candidate-ambassador@example.invalid', now()-interval '4 days',
  now()-interval '4 days','{"provider":"email"}'::jsonb, '{}'::jsonb);
insert into public.profiles(id) values ('11111111-1111-4111-8111-111111111111');
insert into public.ambassador_grants(
  user_id, code, status, first_rate_bps, commission_rate_bps,
  agreement_signed_at, activated_at, ends_at, agreement_reference,
  payout_terms_reference, approved_by)
values (
  '11111111-1111-4111-8111-111111111111', 'CHRISLYKES', 'suspended',
  5000, 1000, now()-interval '5 days', now()-interval '3 days',
  now()-interval '1 day', 'signed-agreement-test', 'signed-payout-test',
  '22222222-2222-4222-8222-222222222222'
);
insert into public.ambassador_owner_audit(actor_id, ambassador_id, action, details, created_at)
select '22222222-2222-4222-8222-222222222222', g.id, 'activate',
  jsonb_build_object('ends_at', g.activated_at+interval '90 days'),
  now()-interval '3 days'
from public.ambassador_grants g where code='CHRISLYKES';
insert into public.ambassador_owner_audit(actor_id, ambassador_id, action, details, created_at)
select '22222222-2222-4222-8222-222222222222', g.id, 'pause',
  jsonb_build_object('ends_at', g.ends_at), now()-interval '1 day'
from public.ambassador_grants g where code='CHRISLYKES';

do $$
begin
  if has_function_privilege('anon', 'public.ambassador_resume_signed_term(uuid,text,date,text)','EXECUTE')
    or has_function_privilege('authenticated','public.ambassador_resume_signed_term(uuid,text,date,text)','EXECUTE')
    or not has_function_privilege('service_role','public.ambassador_resume_signed_term(uuid,text,date,text)','EXECUTE')
  then raise exception 'Unexpected RPC EXECUTE grants'; end if;
end $$;

-- Signed agreement end-date mismatch must not change the campaign.
do $$
begin
  perform public.ambassador_resume_signed_term(
    '22222222-2222-4222-8222-222222222222', 'CHRISLYKES',
    current_date + 1, 'Owner confirmed signed term continuation');
  raise exception 'Wrong-date resume was unexpectedly accepted';
exception when others then
  if SQLERRM = 'Wrong-date resume was unexpectedly accepted' then raise; end if;
end $$;
do $$
begin
  if (select status from public.ambassador_grants where code='CHRISLYKES') <> 'suspended'
  then raise exception 'Negative test changed suspended campaign'; end if;
end $$;

-- Successful only when exact audit-derived end date is confirmed and rates match.
select public.ambassador_resume_signed_term(
  '22222222-2222-4222-8222-222222222222','CHRISLYKES',
  (select (activated_at + interval '90 days')::date
   from public.ambassador_grants where code='CHRISLYKES'),
  'Owner confirmed original signed term and deliberate restart'
);
do $$
declare g public.ambassador_grants%rowtype;
begin
  select * into g from public.ambassador_grants where code='CHRISLYKES';
  if g.status <> 'active' or g.ends_at <> g.activated_at + interval '90 days'
    or g.first_rate_bps <> 5000 or g.commission_rate_bps <> 1000
    or (select count(*) from public.ambassador_owner_audit
        where ambassador_id=g.id and action='resume_signed_term') <> 1
  then raise exception 'Resume acceptance / rate / audit invariant failed'; end if;
end $$;

-- A second click must not restart, extend, or silently amend an active term.
do $$
begin
  perform public.ambassador_resume_signed_term(
    '22222222-2222-4222-8222-222222222222', 'CHRISLYKES',
    (select (activated_at + interval '90 days')::date
     from public.ambassador_grants where code='CHRISLYKES'),
    'Second-click should always be refused');
  raise exception 'Repeated resume was unexpectedly accepted';
exception when others then
  if SQLERRM = 'Repeated resume was unexpectedly accepted' then raise; end if;
end $$;

rollback;
