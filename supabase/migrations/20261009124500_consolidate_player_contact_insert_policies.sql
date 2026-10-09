-- Consolidate eligible requester INSERT rules while preserving account-type and subscription requirements.
DROP POLICY IF EXISTS "premium scouts agents can request players" ON public.player_contact_requests;
DROP POLICY IF EXISTS "pro premium players can request players" ON public.player_contact_requests;
CREATE POLICY "eligible subscribers can request players" ON public.player_contact_requests FOR INSERT TO authenticated WITH CHECK (
  requester_id = (SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles requester WHERE requester.id = (SELECT auth.uid()) AND requester.account_type IN ('scout','agent','player'))
  AND EXISTS (SELECT 1 FROM public.subscriptions s JOIN public.profiles requester ON requester.id = s.user_id WHERE s.user_id = (SELECT auth.uid()) AND s.status IN ('active','trialing') AND ((requester.account_type IN ('scout','agent') AND s.plan = 'premium') OR (requester.account_type = 'player' AND s.plan IN ('pro','premium'))))
  AND EXISTS (SELECT 1 FROM public.profiles target WHERE target.id = player_contact_requests.player_id AND target.account_type = 'player' AND target.profile_visibility = 'public' AND target.moderation_status <> 'suspended')
);
