-- Build 9 follow RPC implementation candidate — ISOLATED REHEARSAL ONLY.
-- Not under supabase/migrations: no automatic deployment.
-- Preconditions: reviewed canonical follow_relationships schema and privacy
-- migrations have been applied and validated in the isolated test project.
-- Preserve public invoker wrappers and their existing ACLs.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.follow_relationships') IS NULL THEN
    RAISE EXCEPTION 'Missing canonical follow_relationships prerequisite'
      USING ERRCODE='42P01';
  END IF;
  IF to_regprocedure('private.can_user_follow_target(uuid,text,uuid)') IS NULL
     OR to_regprocedure('private.get_follow_count(text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing private follow RPC stubs' USING ERRCODE='42883';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid=to_regprocedure('private.can_user_follow_target(uuid,text,uuid)')
      AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres'
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND pg_get_functiondef(p.oid) LIKE '%select null::boolean%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid=to_regprocedure('private.get_follow_count(text,uuid)')
      AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres'
      AND p.proconfig @> ARRAY['search_path=""']::text[]
      AND pg_get_functiondef(p.oid) LIKE '%select null::bigint%'
  ) THEN
    RAISE EXCEPTION 'Private RPC contracts changed; stop and re-review'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c WHERE c.oid='public.follow_relationships'::regclass
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Follow graph RLS must remain enabled' USING ERRCODE='42501';
  END IF;
END
$preflight$;

-- Canonical 20261009111500 semantics: no arbitrary user-ID probing.
CREATE OR REPLACE FUNCTION private.can_user_follow_target(
  p_user_id uuid, p_target_type text, p_target_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND p_target_type IN ('team','player','league')
    AND p_target_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    );
$function$;

-- Canonical 20261113191336 privacy filter: private player/fan counts
-- visible only to their owner. Keep the existing public wrapper invoker.
CREATE OR REPLACE FUNCTION private.get_follow_count(
  p_target_type text, p_target_id uuid
)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT count(*)::bigint
  FROM public.follow_relationships AS follow
  WHERE follow.target_type = p_target_type
    AND follow.target_id = p_target_id
    AND (
      p_target_type NOT IN ('player','fan')
      OR EXISTS (
        SELECT 1 FROM public.profiles AS target
        WHERE target.id = p_target_id
          AND (
            target.profile_visibility = 'public'
            OR target.id = (SELECT auth.uid())
          )
      )
    );
$function$;

-- Verify public wrappers were not converted into elevated SECURITY DEFINER
-- entrypoints or exposed to anonymous callers.
DO $postcheck$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'public.can_user_follow_target(uuid,text,uuid)',
    'public.get_follow_count(text,uuid)'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.oid=to_regprocedure(v_name)
        AND NOT p.prosecdef
        AND p.proconfig @> ARRAY['search_path=""']::text[]
        AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
    ) THEN
      RAISE EXCEPTION 'Public wrapper security boundary changed: %', v_name
        USING ERRCODE='42501';
    END IF;
  END LOOP;
END
$postcheck$;

-- This is a candidate, not authorization to COMMIT on hosted systems.
-- Run inside a rollback-only isolated rehearsal; validate real signed-in
-- non-owner, owner, anonymous, blocked, and privacy scenarios first.
ROLLBACK;
