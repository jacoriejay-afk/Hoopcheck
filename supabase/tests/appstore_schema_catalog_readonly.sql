-- Catalog only: run separately against an explicitly verified production read-only
-- connection and a disposable/test database. No user records, DDL, DML or secrets.
BEGIN READ ONLY;
SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,
 c.relforcerowsecurity AS force_rls,
 (SELECT count(*) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
 (SELECT count(*) FROM pg_constraint k WHERE k.contype='f' AND k.conrelid=c.oid) AS fk_count,
 (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
ORDER BY 1,2;
ROLLBACK;
