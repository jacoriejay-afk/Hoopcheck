-- Build 9 isolated hosted preflight. READ ONLY. Never apply DDL from this file.
-- Intended target: HoopCheck-PR17-Test; verify project identity in operator console.
-- Run before any approved reconciliation, then attach the results to PR #755.
select
 current_database() as database_name,
 current_user as executor,
 session_user as session_executor,
 to_regclass('public.follow_relationships') is not null as has_canonical_follows,
 to_regprocedure('public.get_own_profile()') is not null as has_owner_profile_rpc,
 to_regprocedure('public.get_public_player_profile(uuid)') is not null as has_public_profile_rpc,
 to_regclass('supabase_migrations.schema_migrations') is not null as has_migration_history;

select p.oid::regprocedure::text as function_signature,
 pg_get_userbyid(p.proowner) as owner_role,
 p.prosecdef as security_definer,
 p.proconfig as function_settings,
 p.proacl::text as execution_acl,
 r.rolcanlogin as owner_can_login,
 r.rolbypassrls as owner_bypasses_rls,
 pg_has_role(current_user,p.proowner,'SET') as executor_can_set_owner,
 pg_has_role(current_user,p.proowner,'USAGE') as executor_can_use_owner,
 has_schema_privilege(pg_get_userbyid(p.proowner),'public','CREATE') as owner_has_public_create
from pg_proc p
join pg_roles r on r.oid=p.proowner
where p.oid=to_regprocedure('public.get_public_player_profile(uuid)');

-- An absent historical version is a reconciliation signal, NOT permission
-- to replay the entire historical migration (which also changes other objects).
select version
from supabase_migrations.schema_migrations
where version in ('20261006102000','20261121060907','20261121061419',
 '20261121061620','20261121062159','20261121062209','20261121062223',
 '20261121062342')
order by version;

-- Release gate:
-- 1. Review historical 20261006102000 migration and later follow contracts.
-- 2. Obtain an EXISTING authorized owner-capable executor; never grant SET,
--    CREATE, BYPASSRLS or change function owner merely to pass this check.
-- 3. Rehearse reviewed migrations in an isolated transaction, rollback first.
-- 4. Assert unchanged scoped definer, ACL, search_path, moderation and country
--    consent; then run real owner/non-owner and enrolled AAL1/AAL2 sessions.
-- 5. Keep production, deployment, merge, EAS and billing untouched.
