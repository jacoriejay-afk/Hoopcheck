-- Draft-only: replace the feed authorization predicate before private-country SELECT is revoked.
-- Preserve the production authorization semantics; never expose a standalone country-equality oracle.
CREATE OR REPLACE FUNCTION public.can_view_player_feed_post(p_author_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p_author_id = (SELECT auth.uid())
    OR public.is_current_user_admin_or_moderator()
    OR EXISTS (
      SELECT 1
      FROM public.profiles viewer
      JOIN public.subscriptions sub ON sub.user_id = viewer.id
      JOIN public.profiles author ON author.id = p_author_id
      JOIN public.follow_relationships fr
        ON fr.follower_id = viewer.id
       AND fr.target_id = p_author_id
       AND fr.target_type = author.account_type
      WHERE viewer.id = (SELECT auth.uid())
        AND viewer.account_type IN ('player', 'fan', 'coach', 'agent', 'scout', 'club_admin', 'manager')
        AND author.account_type IN ('player', 'fan', 'coach', 'agent', 'scout', 'club_admin', 'manager')
        AND sub.plan IN ('pro', 'premium')
        AND sub.status IN ('active', 'trialing')
        AND coalesce(sub.access_status, 'active') IN ('active', 'trialing', 'pro', 'premium')
        AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
        AND (
          viewer.account_type <> 'player'
          OR author.account_type <> 'player'
          OR (
            viewer.current_country IS NOT NULL
            AND author.current_country IS NOT NULL
            AND lower(viewer.current_country) = lower(author.current_country)
          )
        )
    );
$function$;
-- SECURITY DEFINER must never be executable by PUBLIC/anonymous roles.
REVOKE ALL ON FUNCTION public.can_view_player_feed_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_player_feed_post(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_view_player_feed_post(uuid) TO authenticated;
-- IMPORTANT: This migration does not revoke SELECT on profiles.current_country.
-- Masked directory RPCs must be made compatible and tested before that separate release step.
