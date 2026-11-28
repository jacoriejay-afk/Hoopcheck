-- Disposable stand-in for existing membership_sources contract.
-- No changes to actual public views. Run only in isolated CI database.
\set ON_ERROR_STOP on
create table public.fixture_membership_sources(
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 plan text,status text,access_status text,current_period_end timestamptz,
 cancel_at_period_end boolean,billing_interval text,provider text
);
create view public.membership_sources with(security_invoker=true) as select * from public.fixture_membership_sources;
grant select on public.fixture_membership_sources,public.membership_sources to service_role;
insert into public.fixture_membership_sources(user_id,plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,provider)
values
 ('11111111-1111-4111-8111-111111111111','premium','active','premium',now()+interval '2 days',false,'month','stripe'),
 ('11111111-1111-4111-8111-111111111111','pro','active','pro',now()+interval '3 days',false,'month','apple'),
 ('22222222-2222-4222-8222-222222222222','premium','active','free',now()+interval '2 days',false,'month','manual'),
 ('22222222-2222-4222-8222-222222222222','pro','active','pro',now()+interval '3 days',false,'month','apple');
