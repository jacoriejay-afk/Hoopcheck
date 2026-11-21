-- Build 9 isolated Supabase pre-rehearsal inventory (read only).
-- Run on the isolated project before and after migration rehearsals;
-- export the complete results securely and compare. This is NOT a backup.
SELECT 'rls_scope' AS section, n.nspname||'.'||c.relname AS item,
       jsonb_build_object('rls_enabled',c.relrowsecurity,'force_rls',c.relforcerowsecurity) AS details
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p') AND c.relrowsecurity
  AND (n.nspname='public' OR (n.nspname='storage' AND c.relname='objects')
       OR (n.nspname='realtime' AND c.relname='messages'))
UNION ALL
SELECT 'policy',schemaname||'.'||tablename||'.'||policyname,
       jsonb_build_object('cmd',cmd,'permissive',permissive,'roles',roles,'qual',qual,'with_check',with_check)
FROM pg_policies WHERE schemaname IN ('public','storage','realtime')
UNION ALL
SELECT 'authenticator_setting',
       CASE WHEN s.setdatabase=0 THEN 'all_databases' ELSE 'database_specific' END,
       jsonb_build_object('setting',setting)
FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) setting
WHERE s.setrole IN (0,(SELECT oid FROM pg_roles WHERE rolname='authenticator'))
UNION ALL
SELECT 'migration_ledger',version::text,jsonb_build_object('name',name)
FROM supabase_migrations.schema_migrations
ORDER BY section,item;
-- Before proceeding, capture separate schema-only backup and successfully restore
-- it to a disposable clone. This inventory alone cannot restore data, RLS, or role settings.
