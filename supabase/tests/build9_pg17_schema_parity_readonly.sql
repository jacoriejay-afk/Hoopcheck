-- Build 9 PostgreSQL 17 production-equivalence preflight, READ ONLY.
-- Run the identical statement separately on production and a disposable rehearsal
-- database. Compare every returned field. No writes, grants, DDL, secrets or user rows.
-- A MATCH is only catalog preflight evidence, not a substitute for actual schema
-- snapshot/rehearsal, owner/nonowner signed HTTP, AAL1/AAL2 or Build7/8 acceptance.
WITH
  wanted_tables AS (
    SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND c.relname IN ('profiles','player_career_stops','hoop_group_spaces','fan_live_chat_messages')
  ),
  column_catalog AS (
    SELECT t.relname,a.attnum,a.attname,
      pg_catalog.format_type(a.atttypid,a.atttypmod) AS data_type,
      a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expression
    FROM wanted_tables t JOIN pg_attribute a ON a.attrelid=t.oid
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped
  ),
  policy_catalog AS (
    SELECT tablename,policyname,roles,cmd,qual,with_check
    FROM pg_policies WHERE schemaname='public'
  ),
  rpc_catalog AS (
    SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
      pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,
      p.proconfig AS settings,md5(pg_get_functiondef(p.oid)) AS function_digest
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.oid IN
      (to_regprocedure('public.get_own_profile()'),to_regprocedure('public.get_public_player_profile(uuid)'))
  )
SELECT
  current_setting('server_version') AS postgres_version,
  (SELECT count(*) FROM supabase_migrations.schema_migrations) AS migration_count,
  (SELECT count(*) FROM policy_catalog) AS public_policy_count,
  (SELECT jsonb_agg(jsonb_build_object('table',relname,'rls_enabled',relrowsecurity,'force_rls',relforcerowsecurity) ORDER BY relname) FROM wanted_tables) AS target_tables,
  (SELECT md5(coalesce(string_agg(concat_ws('|',relname,attnum::text,attname,data_type,attnotnull::text,coalesce(default_expression,'')), E'\n' ORDER BY relname,attnum),'')) FROM column_catalog) AS target_column_digest,
  (SELECT md5(coalesce(string_agg(concat_ws('|',tablename,policyname,array_to_string(roles,','),cmd,coalesce(qual,''),coalesce(with_check,'')), E'\n' ORDER BY tablename,policyname),'')) FROM policy_catalog) AS public_policy_digest,
  (SELECT jsonb_agg(jsonb_build_object('name',proname,'args',arguments,'owner',owner,'security_definer',security_definer,'settings',settings,'definition_digest',function_digest) ORDER BY proname) FROM rpc_catalog) AS protected_profile_rpcs,
  jsonb_build_object(
    'anon_country_select',has_column_privilege('anon','public.profiles','current_country','SELECT'),
    'authenticated_country_select',has_column_privilege('authenticated','public.profiles','current_country','SELECT'),
    'authenticated_moderation_note_select',has_column_privilege('authenticated','public.profiles','moderation_note','SELECT')
  ) AS protected_column_grants;
