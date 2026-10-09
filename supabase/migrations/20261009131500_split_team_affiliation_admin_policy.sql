-- Split the admin ALL policy so SELECT access is covered by one owner/admin policy.
DROP POLICY IF EXISTS "Admins manage team affiliations" ON public.player_team_affiliations;
DROP POLICY IF EXISTS "Players can view their team affiliations" ON public.player_team_affiliations;

CREATE POLICY "Team affiliations owner or admin read"
ON public.player_team_affiliations
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_current_user_admin_or_moderator()
);

CREATE POLICY "Admins insert team affiliations"
ON public.player_team_affiliations
FOR INSERT TO authenticated
WITH CHECK (public.is_current_user_admin_or_moderator());

CREATE POLICY "Admins update team affiliations"
ON public.player_team_affiliations
FOR UPDATE TO authenticated
USING (public.is_current_user_admin_or_moderator())
WITH CHECK (public.is_current_user_admin_or_moderator());

CREATE POLICY "Admins delete team affiliations"
ON public.player_team_affiliations
FOR DELETE TO authenticated
USING (public.is_current_user_admin_or_moderator());
