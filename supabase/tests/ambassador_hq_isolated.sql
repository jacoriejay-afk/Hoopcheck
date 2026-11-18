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
create or replace function auth.role() returns text language sql stable as
$$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
-- Minimal private owner registry, matching the deployed table's user_id column.
-- Only synthetic fixture identities are inserted, inside this rollback transaction.
create schema if not exists hoopcheck_security;
create table if not exists hoopcheck_security.owner_accounts (user_id uuid primary key);
revoke all on schema hoopcheck_security from public,anon,authenticated;
revoke all on table hoopcheck_security.owner_accounts from public,anon,authenticated;
create table if not exists public.profiles (id uuid primary key);
create table if not exists public.subscriptions (user_id uuid, stripe_customer_id text);
alter table public.subscriptions add column if not exists stripe_customer_id text;
\ir ../migrations/20261114072000_ambassador_hq_foundation.sql
\ir ../migrations/20261114072854_ambassador_hq_workflows.sql
\ir ../migrations/20261115195000_ambassador_refund_audit.sql
\ir ../migrations/20261118090000_ambassador_payout_owner_guard.sql
\ir ambassador_hq.sql
\ir ambassador_refund_audit.sql
rollback;
