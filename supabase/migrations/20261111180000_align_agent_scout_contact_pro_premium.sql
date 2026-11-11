-- ROLE-AUDIT-1: align direct player-contact RLS with Pro/Premium Ask Player entitlements.
-- This migration is intentionally NOT applied to production as part of the audit.
-- Preserve the live INSERT policy conditions; change only Agent/Scout plan eligibility.
-- Existing accepted-only messaging policies are unchanged.
DROP POLICY IF EXISTS "eligible subscribers can request players" ON public.player_contact_requests;
CREATE POLICY "eligible subscribers can request players"
ON public.player_contact_requests
FOR INSERT TO authenticated
WITH CHECK (
  requester_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles requester
    WHERE requester.id = (SELECT auth.uid())
      AND requester.account_type IN ('scout', 'agent', 'player')
  )
  AND EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = (SELECT auth.uid())
      AND s.status IN ('active', 'trialing')
      AND s.plan IN ('pro', 'premium')
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles target
    WHERE target.id = player_contact_requests.player_id
      AND target.account_type = 'player'
      AND target.profile_visibility = 'public'
      AND target.moderation_status <> 'suspended'
  )
);
