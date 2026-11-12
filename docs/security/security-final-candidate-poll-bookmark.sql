-- SECURITY-FINAL CANDIDATE ONLY — DO NOT EXECUTE IN PRODUCTION.
-- Draft policy replacements. Review product visibility semantics and rehearse
-- against separate authenticated users before promoting to supabase/migrations.
-- SELECT from feed_posts is intentionally subject to the caller's feed_posts RLS;
-- do not use a SECURITY DEFINER visibility shortcut.
-- This preserves permanent posts (expires_at IS NULL) while rejecting expired posts.
BEGIN;
DROP POLICY IF EXISTS "feed poll votes read" ON public.feed_poll_votes;
CREATE POLICY "feed poll votes read" ON public.feed_poll_votes
 FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.feed_posts fp
 WHERE fp.id=feed_poll_votes.post_id AND fp.status='approved'
 AND fp.post_kind='poll'
 AND (fp.expires_at IS NULL OR fp.expires_at>now())
 AND jsonb_typeof(fp.poll_options)='array'
 AND feed_poll_votes.option_index>=0
 AND feed_poll_votes.option_index<jsonb_array_length(fp.poll_options)));
DROP POLICY IF EXISTS "feed poll votes insert own" ON public.feed_poll_votes;
CREATE POLICY "feed poll votes insert own" ON public.feed_poll_votes
 FOR INSERT TO authenticated WITH CHECK (
 user_id=(SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.feed_posts fp WHERE fp.id=feed_poll_votes.post_id
 AND fp.status='approved' AND fp.post_kind='poll'
 AND (fp.expires_at IS NULL OR fp.expires_at>now())
 AND jsonb_typeof(fp.poll_options)='array'
 AND feed_poll_votes.option_index>=0
 AND feed_poll_votes.option_index<jsonb_array_length(fp.poll_options)));
DROP POLICY IF EXISTS "feed poll votes update own" ON public.feed_poll_votes;
CREATE POLICY "feed poll votes update own" ON public.feed_poll_votes
 FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.feed_posts fp WHERE fp.id=feed_poll_votes.post_id
 AND fp.status='approved' AND fp.post_kind='poll'
 AND (fp.expires_at IS NULL OR fp.expires_at>now())))
 WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.feed_posts fp WHERE fp.id=feed_poll_votes.post_id
 AND fp.status='approved' AND fp.post_kind='poll'
 AND (fp.expires_at IS NULL OR fp.expires_at>now())
 AND jsonb_typeof(fp.poll_options)='array'
 AND feed_poll_votes.option_index>=0
 AND feed_poll_votes.option_index<jsonb_array_length(fp.poll_options)));
DROP POLICY IF EXISTS "feed bookmarks insert own" ON public.feed_post_bookmarks;
CREATE POLICY "feed bookmarks insert own" ON public.feed_post_bookmarks
 FOR INSERT TO authenticated WITH CHECK (
 user_id=(SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.feed_posts fp WHERE fp.id=feed_post_bookmarks.post_id
 AND fp.status='approved' AND (fp.expires_at IS NULL OR fp.expires_at>now())));
COMMIT;

-- BEFORE PROMOTION: check all other permissive policies, verify blocked-user
-- behavior, confirm vote UPDATE cannot move post_id or user_id across records,
-- and test SELECT/INSERT/UPDATE with real authenticated REST sessions.
-- Note: this draft does not alter comments/checks/admin/media; separate reviews required.
