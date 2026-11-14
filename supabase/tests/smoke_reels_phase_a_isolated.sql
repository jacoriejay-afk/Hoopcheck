-- Execute against the disposable PostgreSQL 16 CI service only.
-- Parse and execute the real migration, then verify default-deny invariants.
\set ON_ERROR_STOP on
begin;
create role anon nologin;
create role authenticated nologin;
create schema if not exists public;
create table public.profiles (id uuid primary key);
create table public.teams (id uuid primary key);
create table public.leagues (id uuid primary key);

\i supabase/migrations/20261114095000_reels_phase_a_default_deny.sql

do $$
declare t text;
begin
  foreach t in array array['reels','reel_checks','reel_bookmarks','reel_comments'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=t and c.relrowsecurity
    ) then raise exception 'RLS disabled on %', t; end if;
    if exists (
      select 1 from pg_policies where schemaname='public' and tablename=t
    ) then raise exception 'Unexpected RLS policy on %', t; end if;
    if has_table_privilege('authenticated','public.'||t,'SELECT')
      or has_table_privilege('authenticated','public.'||t,'INSERT')
      or has_table_privilege('authenticated','public.'||t,'UPDATE')
      or has_table_privilege('authenticated','public.'||t,'DELETE')
      or has_table_privilege('anon','public.'||t,'SELECT')
    then raise exception 'Client table privilege leaked on %', t; end if;
  end loop;
end $$;
rollback;
\echo REELS-1 isolated PostgreSQL migration and default-deny checks passed
