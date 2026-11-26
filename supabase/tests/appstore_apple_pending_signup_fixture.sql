\set ON_ERROR_STOP on
-- Disposable PostgreSQL only. Never connect to a hosted Supabase database.
begin;
create schema auth;
create schema private;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role authenticator nologin;
create table auth.users (
 id uuid primary key, email text, email_confirmed_at timestamptz,
 raw_app_meta_data jsonb, raw_user_meta_data jsonb default '{}', role text
);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create table public.profiles (
 id uuid primary key references auth.users(id), display_name text, first_name text,
 last_name text, username text unique, account_type text, position text, years_pro integer,
 professional_experience boolean, is_adult boolean, agreed_to_terms boolean,
 terms_accepted_at timestamptz, terms_version text, birthdate date, gender text, basketball_type text
);
alter table public.profiles enable row level security;
grant usage on schema auth to anon, authenticated;
\i supabase/migrations/20261110135216_google_signup_onboarding.sql
create trigger on_auth_user_created after insert on auth.users
 for each row execute function public.handle_new_user();
\i supabase/candidates/appstore_apple_pending_signup.sql
insert into auth.users (id,email,email_confirmed_at,raw_app_meta_data,role) values
 ('11111111-1111-4111-8111-111111111111','apple@example.test',now(),'{"provider":"apple"}','authenticated'),
 ('22222222-2222-4222-8222-222222222222','google@example.test',now(),'{"provider":"google"}','authenticated'),
 ('33333333-3333-4333-8333-333333333333','unconfirmed@example.test',null,'{"provider":"apple"}','authenticated');
update auth.users set role='authenticated';
do $$ begin
 if exists(select 1 from auth.users where role is distinct from 'hoopcheck_pending_signup') or exists(select 1 from public.profiles)
 then raise exception 'Pending social identity escaped restriction'; end if;
 if has_function_privilege('anon','public.complete_apple_signup(jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.complete_apple_signup(jsonb)','EXECUTE')
 or has_function_privilege('service_role','public.complete_apple_signup(jsonb)','EXECUTE')
 or has_function_privilege('anon','private.complete_apple_signup(jsonb)','EXECUTE')
 or has_table_privilege('hoopcheck_pending_signup','public.profiles','INSERT')
 then raise exception 'Unexpected account completion privilege'; end if;
end $$;
-- Fixture consent form; caller-supplied identity and privileged fields must be ignored.
select set_config('fixture.signup','{"first_name":"Test","last_name":"Person","username":"applefixture","account_type":"fan","gender":"prefer_not_to_say","birthdate":"1990-01-01","terms_version":"2026-10-01","agreed_to_terms":true,"user_id":"22222222-2222-4222-8222-222222222222","is_admin":true}',true);
set local role hoopcheck_pending_signup;
select set_config('request.jwt.claims','{"role":"hoopcheck_pending_signup"}',true);
do $$
declare denied boolean; who uuid; input jsonb := current_setting('fixture.signup')::jsonb;
begin
 foreach who in array array['22222222-2222-4222-8222-222222222222'::uuid,'33333333-3333-4333-8333-333333333333'::uuid] loop
  perform set_config('request.jwt.claim.sub',who::text,true);
  denied:=false;
  begin perform public.complete_apple_signup(input); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Wrong provider or unconfirmed email accepted'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 denied:=false;
 begin perform public.complete_google_signup(input); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Apple caller accepted by Google completion'; end if;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 denied:=false;
 begin perform public.complete_apple_signup(input); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Wrong JWT role accepted'; end if;
 perform set_config('request.jwt.claims','{"role":"hoopcheck_pending_signup"}',true);
 denied:=false;
 begin perform public.complete_apple_signup(input || jsonb_build_object('birthdate',current_date::text)); exception when others then if sqlerrm <> 'You must be 18 or older' then raise; end if; denied:=true; end;
 if not denied then raise exception 'Underage signup accepted'; end if;
 denied:=false;
 begin perform public.complete_apple_signup(input || '{"agreed_to_terms":false}'); exception when others then if sqlerrm <> 'Acceptance of the current Terms of Service is required' then raise; end if; denied:=true; end;
 if not denied then raise exception 'Missing consent accepted'; end if;
 perform public.complete_apple_signup(input);
 perform public.complete_apple_signup(input || '{"username":"changed"}');
 perform set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 perform public.complete_google_signup(input || '{"username":"googlefixture"}');
end $$;
reset role;
do $$ begin
 if (select count(*) from public.profiles) <> 2
 or not exists(select 1 from public.profiles where id='11111111-1111-4111-8111-111111111111' and username='applefixture' and is_adult and agreed_to_terms and account_type='fan')
 or not exists(select 1 from public.profiles where id='22222222-2222-4222-8222-222222222222' and username='googlefixture')
 or (select count(*) from auth.users where role='authenticated') <> 2
 or exists(select 1 from auth.users where raw_user_meta_data ? 'is_admin' or raw_user_meta_data ? 'user_id')
 then raise exception 'Unexpected completion state or cross-account mutation'; end if;
end $$;
rollback;
\echo PASS: synthetic Apple and Google pending-signup checks
