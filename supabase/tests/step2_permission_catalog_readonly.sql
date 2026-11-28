-- Step 2 permission catalog comparison, READ ONLY, PostgreSQL 17.
-- Run separately on the independently verified disposable baseline and candidate.
-- No connection strings, credentials, user rows, role passwords or settings are emitted.
-- Use the same PG major version and search_path. Compare every category, count and digest.
-- This is a preflight, not proof of effective HTTP authorization, function body equivalence,
-- managed-service configuration, storage bucket configuration or complete schema parity.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path = pg_catalog;
WITH ns AS (
 SELECT oid,nspname,nspowner,nspacl FROM pg_namespace
 WHERE nspname NOT LIKE 'pg\\_%' ESCAPE '\\' AND nspname <> 'information_schema'
), rel AS (
 SELECT c.*,n.nspname FROM pg_class c JOIN ns n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p','v','m','f','S')
), evidence(category, value) AS (
 SELECT 'schemas',jsonb_build_array(nspname,pg_get_userbyid(nspowner),
   CASE WHEN nspacl IS NULL THEN NULL ELSE ARRAY(SELECT a::text FROM unnest(nspacl) a ORDER BY a::text COLLATE "C") END)
 FROM ns
 UNION ALL
 SELECT 'relations',jsonb_build_array(nspname,relname,relkind,pg_get_userbyid(relowner),
   relrowsecurity,relforcerowsecurity,
   ARRAY(SELECT o FROM unnest(reloptions) o ORDER BY o COLLATE "C"),
   CASE WHEN relacl IS NULL THEN NULL ELSE ARRAY(SELECT a::text FROM unnest(relacl) a ORDER BY a::text COLLATE "C") END)
 FROM rel
 UNION ALL
 SELECT 'columns',jsonb_build_array(r.nspname,r.relname,a.attname,a.attnum,
   CASE WHEN a.attacl IS NULL THEN NULL ELSE ARRAY(SELECT x::text FROM unnest(a.attacl) x ORDER BY x::text COLLATE "C") END)
 FROM rel r JOIN pg_attribute a ON a.attrelid=r.oid
 WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL
 SELECT 'policies',jsonb_build_array(r.nspname,r.relname,p.polname,p.polcmd,p.polpermissive,
   ARRAY(SELECT CASE WHEN id=0 THEN 'PUBLIC' ELSE pg_get_userbyid(id)::text END
         FROM unnest(p.polroles) id ORDER BY 1),
   pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))
 FROM pg_policy p JOIN rel r ON r.oid=p.polrelid
 UNION ALL
 SELECT 'routines',jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),
   p.prokind,pg_get_userbyid(p.proowner),p.prosecdef,p.proleakproof,
   CASE WHEN p.proacl IS NULL THEN NULL ELSE ARRAY(SELECT a::text FROM unnest(p.proacl) a ORDER BY a::text COLLATE "C") END)
 FROM pg_proc p JOIN ns n ON n.oid=p.pronamespace
 UNION ALL
 SELECT 'default_acls',jsonb_build_array(pg_get_userbyid(d.defaclrole),
   CASE WHEN d.defaclnamespace=0 THEN NULL ELSE n.nspname END,d.defaclobjtype,
   ARRAY(SELECT a::text FROM unnest(d.defaclacl) a ORDER BY a::text COLLATE "C"))
 FROM pg_default_acl d LEFT JOIN ns n ON n.oid=d.defaclnamespace
 WHERE d.defaclnamespace=0 OR n.oid IS NOT NULL
 UNION ALL
 SELECT 'role_flags',jsonb_build_array(rolname,rolsuper,rolinherit,rolcreaterole,
   rolcreatedb,rolcanlogin,rolreplication,rolbypassrls)
 FROM pg_roles
 UNION ALL
 SELECT 'role_memberships',jsonb_build_array(pg_get_userbyid(roleid),pg_get_userbyid(member),
   pg_get_userbyid(grantor),admin_option,inherit_option,set_option)
 FROM pg_auth_members
), categories(category) AS (
 VALUES ('schemas'),('relations'),('columns'),('policies'),('routines'),
        ('default_acls'),('role_flags'),('role_memberships')
)
SELECT c.category,count(e.value) AS entry_count,
 encode(sha256(convert_to(coalesce(jsonb_agg(e.value ORDER BY e.value::text COLLATE "C")
   FILTER (WHERE e.value IS NOT NULL),'[]'::jsonb)::text,'UTF8')),'hex') AS digest
FROM categories c LEFT JOIN evidence e ON e.category=c.category
GROUP BY c.category ORDER BY c.category COLLATE "C";
ROLLBACK;
