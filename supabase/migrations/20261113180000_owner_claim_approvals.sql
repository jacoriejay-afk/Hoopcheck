-- Claim approval confers club-management capabilities. Content moderators must not grant them.
-- Keep the existing SELECT and INSERT policies unchanged.
DROP POLICY IF EXISTS "admins manage profile claim queue" ON public.profile_claim_requests;
DROP POLICY IF EXISTS "approved owners manage profile claim queue" ON public.profile_claim_requests;
CREATE POLICY "approved owners manage profile claim queue"
ON public.profile_claim_requests
FOR UPDATE TO authenticated
USING (hoopcheck_security.is_approved_owner())
WITH CHECK (hoopcheck_security.is_approved_owner());
