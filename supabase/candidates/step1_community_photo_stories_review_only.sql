-- REVIEW ONLY, do not apply to a hosted project. PG17, reviewed baseline required.
-- Narrow additive SELECT policy for eligible community PHOTO Stories only.
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='4s';
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.feed_posts'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.feed_posts'::regclass AND polname='unified hoopfeed approved posts read' AND polcmd='r')
 OR to_regprocedure('private.hoopfeed_can_read_author(uuid)') IS NULL
 OR to_regprocedure('public.can_use_unified_hoopfeed()') IS NULL
 OR has_table_privilege('anon','public.feed_posts','SELECT')
 THEN RAISE EXCEPTION 'Community Story baseline drift'; END IF;
END $guard$;
-- Only checks reverse blocks; does not expose block records. No writes or elevated role grants.
CREATE FUNCTION private.hoopfeed_community_story_author(p_author uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND p_author IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM public.user_blocks b WHERE
 (b.blocker_id=auth.uid() AND b.blocked_id=p_author) OR (b.blocker_id=p_author AND b.blocked_id=auth.uid()))
$$;
REVOKE ALL ON FUNCTION private.hoopfeed_community_story_author(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.hoopfeed_community_story_author(uuid) TO authenticated;
CREATE POLICY "eligible community photo stories read" ON public.feed_posts FOR SELECT TO authenticated
 USING (status='approved' AND post_kind='story' AND community_visible IS TRUE
 AND expires_at>now() AND shared_post_id IS NULL AND video_url IS NULL
 AND image_url IS NOT NULL AND (SELECT public.can_use_unified_hoopfeed())
 AND private.hoopfeed_community_story_author(author_id));
-- Caller-scoped readiness check; deployment flag still independently required.
CREATE FUNCTION public.confirm_community_photo_story_policy() RETURNS boolean
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.can_use_unified_hoopfeed()
 AND EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.feed_posts'::regclass AND polname='eligible community photo stories read' AND polcmd='r')
$$;
REVOKE ALL ON FUNCTION public.confirm_community_photo_story_policy() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_community_photo_story_policy() TO authenticated;
-- Existing follower policies still apply; do not enable until full effective policy audit and older-client checks pass.
