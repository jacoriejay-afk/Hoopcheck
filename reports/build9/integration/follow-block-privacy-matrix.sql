-- Build 9 follow/block privacy regression. ISOLATED PR17 TEST ONLY; NEVER PRODUCTION.
-- Self-contained rehearsal compiled from the referenced repo candidates and migrations.
-- Simulated role/JWT claims, not signed HTTP acceptance. No COMMIT; all DDL/DML rolled back.
-- Requires 3 public auth-backed fans and one public player in isolated database.
BEGIN;
DO $guard$ BEGIN
 IF to_regclass('public.follow_relationships') IS NOT NULL OR to_regclass('public.user_blocks') IS NOT NULL OR to_regprocedure('public.get_public_follow_list(text,text,uuid,uuid)') IS NOT NULL THEN
  RAISE EXCEPTION 'Refuse to overwrite existing follow/block schema; test requires clean isolated baseline';
 END IF;
END $guard$;
-- Build 9 canonical follow table prerequisite — ROLLBACK-ONLY CANDIDATE.
-- Isolated rehearsal ONLY. Not in supabase/migrations; never auto-apply.
-- Based on 20261006102000_phase8_community_womens_profile_controls.sql.
-- Does not attempt unrelated women's league, review or moderation DDL.
-- Before an actual rollout: reconcile all subsequent follow-related migrations,
-- existing grants, dependencies and any historical data.
DO $preflight$
BEGIN
 IF to_regclass('public.follow_relationships') IS NOT NULL THEN
   RAISE EXCEPTION 'follow_relationships already exists: stop for catalog review';
 END IF;
 IF to_regclass('public.profiles') IS NULL THEN
   RAISE EXCEPTION 'canonical profiles prerequisite missing';
 END IF;
 IF to_regprocedure('auth.uid()') IS NULL THEN
   RAISE EXCEPTION 'auth.uid() prerequisite missing';
 END IF;
END
$preflight$;

CREATE TABLE public.follow_relationships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 target_type text NOT NULL CHECK (target_type IN ('team','player','league')),
 target_id uuid NOT NULL,
 notify_reviews boolean NOT NULL DEFAULT true,
 notify_ratings boolean NOT NULL DEFAULT false,
 notify_updates boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (follower_id,target_type,target_id)
);

ALTER TABLE public.follow_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followers manage own"
 ON public.follow_relationships FOR ALL TO authenticated
 USING ((SELECT auth.uid())=follower_id)
 WITH CHECK ((SELECT auth.uid())=follower_id);

CREATE INDEX idx_follow_relationships_target
 ON public.follow_relationships(target_type,target_id);

-- Explicitly prevent accidental PUBLIC or anonymous access during rehearsal.
REVOKE ALL ON TABLE public.follow_relationships FROM PUBLIC, anon;
-- Authenticated users need table privileges in addition to owner-only RLS.
-- No UPDATE/DELETE/INSERT/SELECT privilege is given to anonymous users.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.follow_relationships TO authenticated;

DO $postcheck$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_class c
   WHERE c.oid='public.follow_relationships'::regclass
     AND c.relrowsecurity
 ) THEN
   RAISE EXCEPTION 'RLS not enabled';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='follow_relationships'
     AND policyname='followers manage own'
 ) THEN
   RAISE EXCEPTION 'Owner-only follow policy missing';
 END IF;
 IF NOT has_table_privilege('authenticated','public.follow_relationships','SELECT')
    OR NOT has_table_privilege('authenticated','public.follow_relationships','INSERT')
    OR NOT has_table_privilege('authenticated','public.follow_relationships','UPDATE')
    OR NOT has_table_privilege('authenticated','public.follow_relationships','DELETE') THEN
   RAISE EXCEPTION 'Authenticated follow table grants missing';
 END IF;
 IF has_table_privilege('anon','public.follow_relationships','SELECT')
    OR has_table_privilege('anon','public.follow_relationships','INSERT')
    OR has_table_privilege('anon','public.follow_relationships','UPDATE')
    OR has_table_privilege('anon','public.follow_relationships','DELETE') THEN
   RAISE EXCEPTION 'Anonymous follow table privileges detected';
 END IF;
END
$postcheck$;

-- No COMMIT. This candidate must remain rollback-only until the full
-- dependency graph, privileges and authenticated acceptance are reviewed.

-- Apply the same viewer boundary to original posts and every source in a reshare chain.
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
create policy "user blocks own select" on public.user_blocks
for select to authenticated using (blocker_id = (select auth.uid()));
create policy "user blocks own insert" on public.user_blocks
for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "user blocks own delete" on public.user_blocks
for delete to authenticated using (blocker_id = (select auth.uid()));


-- Keep public follower discovery, but never disclose the followers of a private
-- player/fan profile to an unrelated anonymous or authenticated visitor.
-- This is deliberately narrow: team follower lists remain public.
CREATE OR REPLACE FUNCTION public.get_public_follow_list(
  p_mode text, p_target_type text DEFAULT NULL::text,
  p_target_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, target_type text, target_id uuid, display_name text,
              avatar_url text, account_type text, player_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT
    CASE WHEN p_mode = 'followers' THEN follower.id ELSE fr.target_id END,
    fr.target_type, fr.target_id,
    CASE WHEN p_mode = 'followers' THEN follower.display_name
      WHEN fr.target_type IN ('player','fan') THEN target_profile.display_name
      WHEN fr.target_type = 'team' THEN coalesce(team.name,womens_team.name)
      ELSE NULL END,
    CASE WHEN p_mode = 'followers' THEN follower.avatar_url
      ELSE coalesce(target_profile.avatar_url,team.logo_url,womens_team.logo_url) END,
    CASE WHEN p_mode = 'followers' THEN follower.account_type ELSE target_profile.account_type END,
    CASE WHEN p_mode = 'followers' THEN coalesce(follower.player_verified,false)
      ELSE coalesce(target_profile.player_verified,false) END
  FROM public.follow_relationships fr
  LEFT JOIN public.profiles follower ON follower.id = fr.follower_id
  LEFT JOIN public.profiles target_profile ON fr.target_type IN ('player','fan') AND target_profile.id=fr.target_id
  LEFT JOIN public.teams team ON fr.target_type='team' AND team.id=fr.target_id
  LEFT JOIN public.womens_teams womens_team ON fr.target_type='team' AND womens_team.id=fr.target_id
  WHERE (
    (p_mode='followers' AND fr.target_type=p_target_type AND fr.target_id=p_target_id)
    OR (p_mode='following' AND fr.follower_id=p_user_id
      AND (auth.uid()=p_user_id OR follower.profile_visibility='public'))
  )
  AND (
    (p_mode='followers' AND follower.profile_visibility='public')
    OR (p_mode='following' AND (fr.target_type='team'
      OR target_profile.profile_visibility='public' OR target_profile.id=auth.uid()))
  )
  AND (
    p_mode <> 'followers'
    OR p_target_type='team'
    OR (p_target_type IN ('player','fan') AND EXISTS (
      SELECT 1 FROM public.profiles requested
      WHERE requested.id=p_target_id
        AND (requested.profile_visibility='public' OR requested.id=auth.uid())
    ))
  )
  ORDER BY fr.created_at DESC;
$function$;

-- REVIEW CANDIDATE ONLY: follow-list block filtering. Do not auto-apply.
-- Requires reviewed user_blocks and follow_relationships prerequisites.
DO $guard$
BEGIN
 IF to_regclass('public.user_blocks') IS NULL OR to_regclass('public.follow_relationships') IS NULL THEN
  RAISE EXCEPTION 'Missing reviewed follow/block prerequisites';
 END IF;
 IF to_regprocedure('public.get_public_follow_list(text,text,uuid,uuid)') IS NULL THEN
  RAISE EXCEPTION 'Missing reviewed follow-list function';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_class c WHERE c.oid='public.user_blocks'::regclass AND c.relrowsecurity
 ) OR NOT EXISTS (
  SELECT 1 FROM pg_class c WHERE c.oid='public.follow_relationships'::regclass AND c.relrowsecurity
 ) THEN
  RAISE EXCEPTION 'RLS must be enabled on both follow and block tables';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_blocks'
    AND policyname='user blocks own select'
 ) OR has_table_privilege('anon','public.user_blocks','SELECT')
    OR NOT has_table_privilege('authenticated','public.user_blocks','SELECT') THEN
  RAISE EXCEPTION 'Unexpected block-table select policy or privilege; refuse replacement';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_proc p
  WHERE p.oid='public.get_public_follow_list(text,text,uuid,uuid)'::regprocedure
    AND p.prosecdef
    AND p.proconfig @> ARRAY['search_path=""']::text[]
    AND p.prosrc LIKE '%follower.profile_visibility%'
    AND p.prosrc NOT LIKE '%public.user_blocks%'
 ) THEN
  RAISE EXCEPTION 'Installed follow-list definition differs from reviewed historical baseline';
 END IF;
END $guard$;
-- Keep public follower discovery, but never disclose the followers of a private
-- player/fan profile to an unrelated anonymous or authenticated visitor.
-- This is deliberately narrow: team follower lists remain public.
CREATE OR REPLACE FUNCTION public.get_public_follow_list(
  p_mode text, p_target_type text DEFAULT NULL::text,
  p_target_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, target_type text, target_id uuid, display_name text,
              avatar_url text, account_type text, player_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT
    CASE WHEN p_mode = 'followers' THEN follower.id ELSE fr.target_id END,
    fr.target_type, fr.target_id,
    CASE WHEN p_mode = 'followers' THEN follower.display_name
      WHEN fr.target_type IN ('player','fan') THEN target_profile.display_name
      WHEN fr.target_type = 'team' THEN coalesce(team.name,womens_team.name)
      ELSE NULL END,
    CASE WHEN p_mode = 'followers' THEN follower.avatar_url
      ELSE coalesce(target_profile.avatar_url,team.logo_url,womens_team.logo_url) END,
    CASE WHEN p_mode = 'followers' THEN follower.account_type ELSE target_profile.account_type END,
    CASE WHEN p_mode = 'followers' THEN coalesce(follower.player_verified,false)
      ELSE coalesce(target_profile.player_verified,false) END
  FROM public.follow_relationships fr
  LEFT JOIN public.profiles follower ON follower.id = fr.follower_id
  LEFT JOIN public.profiles target_profile ON fr.target_type IN ('player','fan') AND target_profile.id=fr.target_id
  LEFT JOIN public.teams team ON fr.target_type='team' AND team.id=fr.target_id
  LEFT JOIN public.womens_teams womens_team ON fr.target_type='team' AND womens_team.id=fr.target_id
  WHERE (
    (p_mode='followers' AND fr.target_type=p_target_type AND fr.target_id=p_target_id)
    OR (p_mode='following' AND fr.follower_id=p_user_id
      AND (auth.uid()=p_user_id OR follower.profile_visibility='public'))
  )
  AND (
    (p_mode='followers' AND follower.profile_visibility='public')
    OR (p_mode='following' AND (fr.target_type='team'
      OR target_profile.profile_visibility='public' OR target_profile.id=auth.uid()))
  )
  AND (
    p_mode <> 'followers'
    OR p_target_type='team'
    OR (p_target_type IN ('player','fan') AND EXISTS (
      SELECT 1 FROM public.profiles requested
      WHERE requested.id=p_target_id
        AND (requested.profile_visibility='public' OR requested.id=auth.uid())
    ))
  )
  AND (
    (SELECT auth.uid()) IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
      WHERE (
        (ub.blocker_id = (SELECT auth.uid()) AND ub.blocked_id IN (fr.follower_id, fr.target_id, p_user_id, p_target_id))
        OR
        (ub.blocked_id = (SELECT auth.uid()) AND ub.blocker_id IN (fr.follower_id, fr.target_id, p_user_id, p_target_id))
      )
    )
  )
  ORDER BY fr.created_at DESC;
$function$;

-- Historical function permits public discovery; do not broaden EXECUTE permissions.
DO $guard$
BEGIN
 IF NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.get_public_follow_list(text,text,uuid,uuid)'::regprocedure) THEN
  RAISE EXCEPTION 'Unexpected security mode';
 END IF;
END $guard$;


SELECT set_config('b9.a',(SELECT p.id::text FROM public.profiles p JOIN auth.users a ON a.id=p.id WHERE p.account_type='fan' AND p.profile_visibility='public' ORDER BY p.id LIMIT 1),true);
SELECT set_config('b9.b',(SELECT p.id::text FROM public.profiles p JOIN auth.users a ON a.id=p.id WHERE p.account_type='fan' AND p.profile_visibility='public' ORDER BY p.id OFFSET 1 LIMIT 1),true);
SELECT set_config('b9.c',(SELECT p.id::text FROM public.profiles p JOIN auth.users a ON a.id=p.id WHERE p.account_type='fan' AND p.profile_visibility='public' ORDER BY p.id OFFSET 2 LIMIT 1),true);
SELECT set_config('b9.player',(SELECT id::text FROM public.profiles WHERE account_type='player' AND profile_visibility='public' ORDER BY id LIMIT 1),true);
DO $t$ BEGIN
 IF current_setting('b9.a',true) IS NULL OR current_setting('b9.b',true) IS NULL OR current_setting('b9.c',true) IS NULL OR current_setting('b9.player',true) IS NULL
 THEN RAISE EXCEPTION 'Requires three public auth-backed fans and one public player'; END IF;
END $t$;
INSERT INTO public.follow_relationships(follower_id,target_type,target_id)
 VALUES(current_setting('b9.a')::uuid,'player',current_setting('b9.player')::uuid);
-- Canonical follow table: anon has no direct access; authenticated owner sees
-- only their rows, while unrelated authenticated users cannot mutate those rows.
SET LOCAL ROLE anon;
DO $t$ BEGIN
 BEGIN
  PERFORM 1 FROM public.follow_relationships;
  RAISE EXCEPTION 'Anonymous follow-table SELECT unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('b9.b'),true);
SET LOCAL ROLE authenticated;
DO $t$ DECLARE v_count integer; BEGIN
 IF EXISTS(SELECT 1 FROM public.follow_relationships) THEN
  RAISE EXCEPTION 'Nonowner can read another fan follow row';
 END IF;
 UPDATE public.follow_relationships SET notify_updates=false
 WHERE follower_id=current_setting('b9.a')::uuid;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count <> 0 THEN RAISE EXCEPTION 'Nonowner could UPDATE follow'; END IF;
 DELETE FROM public.follow_relationships
 WHERE follower_id=current_setting('b9.a')::uuid;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count <> 0 THEN RAISE EXCEPTION 'Nonowner could DELETE follow'; END IF;
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('b9.a'),true);
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
 IF (SELECT count(*) FROM public.follow_relationships
     WHERE follower_id=current_setting('b9.a')::uuid) <> 1 THEN
  RAISE EXCEPTION 'Owner cannot read own follow row';
 END IF;
END $t$;
RESET ROLE;
-- Public baseline, both list directions.
SELECT set_config('request.jwt.claim.sub',current_setting('b9.b'),true);
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','player',current_setting('b9.player')::uuid,NULL)) <> 1
 OR (SELECT count(*) FROM public.get_public_follow_list('following',NULL,NULL,current_setting('b9.a')::uuid)) <> 1
 THEN RAISE EXCEPTION 'Public baseline failed'; END IF;
END $t$;
-- Forward block B -> A.
INSERT INTO public.user_blocks(blocker_id,blocked_id)
 VALUES(current_setting('b9.b')::uuid,current_setting('b9.a')::uuid);
DO $t$ BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','player',current_setting('b9.player')::uuid,NULL)) <> 0
 OR (SELECT count(*) FROM public.get_public_follow_list('following',NULL,NULL,current_setting('b9.a')::uuid)) <> 0
 THEN RAISE EXCEPTION 'Forward block visible'; END IF;
END $t$;
-- Reverse block is confidential; B is unrelated to A->player for A's own view.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('b9.a'),true);
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
 IF EXISTS(SELECT 1 FROM public.user_blocks) THEN RAISE EXCEPTION 'Reverse block record exposed'; END IF;
 IF (SELECT count(*) FROM public.get_public_follow_list('following',NULL,NULL,current_setting('b9.a')::uuid)) <> 1
 THEN RAISE EXCEPTION 'Unrelated B block incorrectly hides A own following'; END IF;
END $t$;
-- C must still see public A.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('b9.c'),true);
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','player',current_setting('b9.player')::uuid,NULL)) <> 1
 THEN RAISE EXCEPTION 'Unrelated viewer visibility regression'; END IF;
END $t$;
-- Reverse-direction block A -> B; B must not see A's follower row.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('b9.a'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.user_blocks(blocker_id,blocked_id)
 VALUES(current_setting('b9.a')::uuid,current_setting('b9.b')::uuid);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('b9.b'),true);
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','player',current_setting('b9.player')::uuid,NULL)) <> 0
 THEN RAISE EXCEPTION 'Reverse block follower leak'; END IF;
END $t$;
-- Anonymous public discovery is intentional in historical contract; no block rows.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $t$ BEGIN
 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Expected anonymous identity'; END IF;
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','player',current_setting('b9.player')::uuid,NULL)) <> 1
 THEN RAISE EXCEPTION 'Anonymous public discovery regression'; END IF;
 BEGIN
  PERFORM 1 FROM public.user_blocks;
  RAISE EXCEPTION 'Anonymous block table access';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $t$;
-- Private fan and owner boundary.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('b9.a'),true);
UPDATE public.profiles SET profile_visibility='private' WHERE id=current_setting('b9.a')::uuid;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $t$ BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','player',current_setting('b9.player')::uuid,NULL)) <> 0
 OR (SELECT count(*) FROM public.get_public_follow_list('following',NULL,NULL,current_setting('b9.a')::uuid)) <> 0
 THEN RAISE EXCEPTION 'Anonymous private fan leak'; END IF;
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('b9.c'),true);
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('following',NULL,NULL,current_setting('b9.a')::uuid)) <> 0
 THEN RAISE EXCEPTION 'Unrelated viewer private fan leak'; END IF;
END $t$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('b9.a'),true);
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('following',NULL,NULL,current_setting('b9.a')::uuid)) <> 1
 THEN RAISE EXCEPTION 'Private fan cannot access own following'; END IF;
END $t$;
RESET ROLE;
DO $t$ BEGIN
 BEGIN
  INSERT INTO public.follow_relationships(follower_id,target_type,target_id)
   VALUES(current_setting('b9.a')::uuid,'fan',current_setting('b9.b')::uuid);
  RAISE EXCEPTION 'Unsupported fan target allowed';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $t$;
ROLLBACK;