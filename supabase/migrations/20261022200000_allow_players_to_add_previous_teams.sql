-- Let authenticated players add their own former-team history from Settings.
-- Self-submitted affiliations remain unverified until an authorized review process confirms them.
DROP POLICY IF EXISTS "Players can add own unverified former teams" ON public.player_team_affiliations;
CREATE POLICY "Players can add own unverified former teams"
ON public.player_team_affiliations
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND relationship = 'former'
  AND verified = false
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.account_type = 'player'
  )
);
