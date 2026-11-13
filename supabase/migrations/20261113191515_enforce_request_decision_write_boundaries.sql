-- Limit direct request writes to pending submissions and owner cancellation.
-- Review decisions still use the existing SECURITY DEFINER review RPCs.
ALTER POLICY "coach team requests eligible insert"
ON public.coach_team_requests TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.profiles AS profile
    JOIN public.subscriptions AS subscription ON subscription.user_id = profile.id
    WHERE profile.id = (SELECT auth.uid())
      AND profile.account_type = 'coach'
      AND subscription.plan IN ('pro', 'premium')
      AND subscription.status IN ('active', 'trialing')
      AND (subscription.current_period_end IS NULL OR subscription.current_period_end > now())
  )
);

ALTER POLICY "coach team requests own cancel"
ON public.coach_team_requests TO authenticated
USING (user_id = (SELECT auth.uid()) AND status = 'pending')
WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'cancelled');

REVOKE INSERT, UPDATE ON public.coach_team_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT (user_id, team_id, requested_role, note, status),
      UPDATE (status) ON public.coach_team_requests TO authenticated;

ALTER POLICY directory_team_requests_insert
ON public.directory_team_requests TO authenticated
WITH CHECK (requester_id = (SELECT auth.uid()) AND status = 'pending');

REVOKE INSERT ON public.directory_team_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT (requester_id, team_name, country, city, league_name, note, status)
ON public.directory_team_requests TO authenticated;
