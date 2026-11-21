-- Build 9 follow-list block regression (ROLLBACK-ONLY, isolated database).
-- Concatenate AFTER, in this exact order within a single BEGIN:
--  1. build9_follow_relationships_prerequisite.sql (omit final ROLLBACK)
--  2. user_blocks DDL + RLS from historical HoopFeed migration
--  3. 20261113161000_public_follow_list_privacy.sql
--  4. build9_follow_list_block_filter.sql (omit its BEGIN/ROLLBACK)
-- This is NOT an automatic migration. It uses simulated claims, not signed JWTs.
-- Never run against production.

SELECT set_config('test.a', (SELECT p.id::text FROM public.profiles p
    JOIN auth.users u ON u.id=p.id
    WHERE p.account_type='fan' AND p.profile_visibility='public'
    ORDER BY p.id LIMIT 1),true);
SELECT set_config('test.b', (SELECT p.id::text FROM public.profiles p
    JOIN auth.users u ON u.id=p.id
    WHERE p.account_type='fan' AND p.profile_visibility='public'
    ORDER BY p.id OFFSET 1 LIMIT 1),true);
SELECT set_config('test.c', (SELECT p.id::text FROM public.profiles p
    JOIN auth.users u ON u.id=p.id
    WHERE p.account_type='fan' AND p.profile_visibility='public'
    ORDER BY p.id OFFSET 2 LIMIT 1),true);
SELECT set_config('test.player', (SELECT id::text FROM public.profiles
    WHERE account_type='player' AND profile_visibility='public'
    ORDER BY id LIMIT 1),true);
DO $fixtures$
BEGIN
  IF nullif(current_setting('test.a',true),'') IS NULL OR
     nullif(current_setting('test.b',true),'') IS NULL OR
     nullif(current_setting('test.c',true),'') IS NULL OR
     nullif(current_setting('test.player',true),'') IS NULL THEN
    RAISE EXCEPTION 'Not enough independent authenticated fan/public player fixtures';
  END IF;
END $fixtures$;

-- A follows the public player. B/C can discover the follow initially.
SELECT set_config('request.jwt.claim.sub',current_setting('test.a'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.follow_relationships(follower_id,target_type,target_id)
VALUES(current_setting('test.a')::uuid,'player',current_setting('test.player')::uuid);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.b'),true);
SET LOCAL ROLE authenticated;
DO $baseline$
BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','player',current_setting('test.player')::uuid,NULL)) <> 1 THEN
    RAISE EXCEPTION 'baseline followers result missing';
 END IF;
END $baseline$;

-- Forward block: B blocks actual follower A.
INSERT INTO public.user_blocks(blocker_id,blocked_id)
VALUES(current_setting('test.b')::uuid,current_setting('test.a')::uuid);
DO $forward$
BEGIN
 IF EXISTS (SELECT 1 FROM public.get_public_follow_list('followers','player',current_setting('test.player')::uuid,NULL)) THEN
   RAISE EXCEPTION 'B block A failed to hide A from B';
 END IF;
END $forward$;
RESET ROLE;

-- Unrelated C and A should not lose A's unrelated follow relationship.
SELECT set_config('request.jwt.claim.sub',current_setting('test.c'),true);
SET LOCAL ROLE authenticated;
DO $unrelated$
BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','player',current_setting('test.player')::uuid,NULL)) <> 1 THEN
   RAISE EXCEPTION 'unrelated C was incorrectly affected by B block A';
 END IF;
END $unrelated$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.a'),true);
SET LOCAL ROLE authenticated;
DO $owner$
BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('following',NULL,NULL,current_setting('test.a')::uuid)) <> 1 THEN
   RAISE EXCEPTION 'A following incorrectly hidden after unrelated B block';
 END IF;
END $owner$;
RESET ROLE;

-- Reverse block: A blocks B, whose direct SELECT must not reveal A's block.
SELECT set_config('request.jwt.claim.sub',current_setting('test.b'),true);
SET LOCAL ROLE authenticated;
DELETE FROM public.user_blocks WHERE blocker_id=current_setting('test.b')::uuid
 AND blocked_id=current_setting('test.a')::uuid;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.a'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.user_blocks(blocker_id,blocked_id)
 VALUES(current_setting('test.a')::uuid,current_setting('test.b')::uuid);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.b'),true);
SET LOCAL ROLE authenticated;
DO $reverse$
BEGIN
 IF EXISTS (SELECT 1 FROM public.user_blocks) THEN
   RAISE EXCEPTION 'B can enumerate A reverse block';
 END IF;
 IF EXISTS (SELECT 1 FROM public.get_public_follow_list('followers','player',current_setting('test.player')::uuid,NULL)) THEN
   RAISE EXCEPTION 'reverse A block B not enforced';
 END IF;
END $reverse$;
RESET ROLE;

-- Historical anonymous discovery only for public profiles (no identity to block).
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $anonymous$
BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','player',current_setting('test.player')::uuid,NULL)) <> 1 THEN
   RAISE EXCEPTION 'historical anonymous public discovery changed';
 END IF;
END $anonymous$;
RESET ROLE;

-- Do not allow ALTERed ACL/security-mode, anonymous user_blocks access.
DO $boundary$
BEGIN
 IF NOT (SELECT p.prosecdef AND p.proconfig @> ARRAY['search_path=""']::text[]
         FROM pg_proc p WHERE p.oid='public.get_public_follow_list(text,text,uuid,uuid)'::regprocedure)
 OR has_table_privilege('anon','public.user_blocks','SELECT') THEN
  RAISE EXCEPTION 'public list security boundary changed';
 END IF;
END $boundary$;

-- Team IDs are not user identities. Deliberately reuse B's user UUID as a
-- synthetic team UUID to catch accidental fr.target_id-to-user comparisons.
-- A follows this synthetic team. C blocks B, which MUST NOT hide A's team
-- follow from C: B is not a user participant in the follow edge.
SELECT set_config('request.jwt.claim.sub',current_setting('test.a'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.follow_relationships(follower_id,target_type,target_id)
VALUES(current_setting('test.a')::uuid,'team',current_setting('test.b')::uuid);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.c'),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.user_blocks(blocker_id,blocked_id)
VALUES(current_setting('test.c')::uuid,current_setting('test.b')::uuid);
DO $team_uuid_collision$
BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','team',current_setting('test.b')::uuid,NULL)) <> 1 THEN
   RAISE EXCEPTION 'team UUID collision was incorrectly treated as a user block';
 END IF;
END $team_uuid_collision$;
RESET ROLE;

-- Preserve privacy for a player whose profile is temporarily changed to
-- private through the existing owner-claim and database trigger; rollback
-- ensures this never persists. No auth.users record is fabricated.
SELECT set_config('request.jwt.claim.sub',current_setting('test.player'),true);
UPDATE public.profiles SET profile_visibility='private'
 WHERE id=current_setting('test.player')::uuid;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $private_anon$
BEGIN
 IF EXISTS (SELECT 1 FROM public.get_public_follow_list('followers','player',current_setting('test.player')::uuid,NULL)) THEN
  RAISE EXCEPTION 'anonymous private player followers leaked';
 END IF;
END $private_anon$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.c'),true);
SET LOCAL ROLE authenticated;
DO $private_other$
BEGIN
 IF EXISTS (SELECT 1 FROM public.get_public_follow_list('followers','player',current_setting('test.player')::uuid,NULL)) THEN
  RAISE EXCEPTION 'authenticated non-owner sees private player followers';
 END IF;
END $private_other$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.player'),true);
SET LOCAL ROLE authenticated;
DO $private_owner$
BEGIN
 IF (SELECT count(*) FROM public.get_public_follow_list('followers','player',current_setting('test.player')::uuid,NULL)) <> 1 THEN
  RAISE EXCEPTION 'simulated private owner unable to see followers';
 END IF;
END $private_owner$;
RESET ROLE;

ROLLBACK;
