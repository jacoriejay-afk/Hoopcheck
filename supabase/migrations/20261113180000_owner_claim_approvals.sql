-- Claim approvals confer club-management capabilities. Only approved owners may update.
-- Public wrapper does not grant access to the private security schema itself.
CREATE OR REPLACE FUNCTION public.is_approved_claim_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT hoopcheck_security.is_approved_owner() $$;
REVOKE ALL ON FUNCTION public.is_approved_claim_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_claim_owner() TO authenticated;

DROP POLICY IF EXISTS "admins manage profile claim queue" ON public.profile_claim_requests;
DROP POLICY IF EXISTS "approved owners manage profile claim queue" ON public.profile_claim_requests;
CREATE POLICY "approved owners manage profile claim queue"
ON public.profile_claim_requests
FOR UPDATE TO authenticated
USING (public.is_approved_claim_owner())
WITH CHECK (public.is_approved_claim_owner());
