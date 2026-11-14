\set ON_ERROR_STOP on
begin;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role hoopcheck_pending_signup nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb
);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table if not exists public.profiles (id uuid primary key);
create table public.subscriptions (user_id uuid, stripe_customer_id text);
\ir ../migrations/20261114072000_ambassador_hq_foundation.sql
\ir ../migrations/20261114072854_ambassador_hq_workflows.sql
\ir ambassador_hq.sql
rollback;
