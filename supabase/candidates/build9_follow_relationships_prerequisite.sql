-- Build 9 canonical follow table prerequisite — ROLLBACK-ONLY CANDIDATE.
-- Isolated rehearsal ONLY. Not in supabase/migrations; never auto-apply.
-- Based on 20261006102000_phase8_community_womens_profile_controls.sql.
-- Does not attempt unrelated women's league, review or moderation DDL.
-- Before an actual rollout: reconcile all subsequent follow-related migrations,
-- existing grants, dependencies and any historical data.
BEGIN;

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
ROLLBACK;
