-- Build 9 follow graph security inventory; READ ONLY.
-- Run on approved isolated test project. Do not use this as migration DDL.
-- Missing objects are not authorization to recreate a permissive replacement.

select
 to_regclass('public.follow_relationships')::text as canonical_follow_table,
 to_regprocedure('public.can_user_follow_target(uuid,text,uuid)')::text as follow_eligibility_rpc,
 to_regprocedure('public.get_follow_count(text,uuid)')::text as follow_count_rpc,
 to_regprocedure('public.get_public_following_count(uuid)')::text as following_count_rpc,
 to_regprocedure('public.get_public_follow_list(text,text,uuid,uuid)')::text as public_follow_list_rpc,
 to_regprocedure('public.get_shared_team_followers(uuid)')::text as shared_team_followers_rpc,
 to_regprocedure('public.get_social_suggestions()')::text as social_suggestions_rpc;

select n.nspname as schema_name,c.relname as relation_name,
 c.relrowsecurity as rls_enabled,c.relforcerowsecurity as force_rls,
 pg_get_userbyid(c.relowner) as table_owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='follow_relationships';

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename='follow_relationships'
order by policyname;

select p.oid::regprocedure::text as rpc,pg_get_userbyid(p.proowner) as owner,
 p.prosecdef as security_definer,p.proconfig as settings,p.proacl::text as acl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('can_user_follow_target','get_follow_count','get_public_following_count',
 'get_public_follow_list','get_shared_team_followers','get_social_suggestions')
order by p.proname,p.oid::regprocedure::text;

-- Review canonical chain, not just the table-creation migration:
-- 20261006102000 phase8 community follows (table, RLS, constraints)
-- 20261008181751 authenticated follow eligibility
-- 20261008220500 anonymous count revocation
-- 20261009111500 bind eligibility to auth.uid()
-- 20261102150000 public follow lists
-- 20261102153000 restrict private follow RPCs
-- 20261113090000 private following count
-- 20261113161000 public follow-list privacy
-- 20261113182500 follower-only HoopFeed RLS
-- 20261113191336 private follower counts
-- Do not apply any historical file wholesale until all other DDL and data
-- side effects have been reviewed against the installed schema.
