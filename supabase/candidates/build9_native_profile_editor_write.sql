-- Reviewed release candidate; isolated rehearsal only until production approval.
-- Prerequisites: opted-in MFA, owner profile boundary and private-column restriction.
DO $$ BEGIN
 IF to_regprocedure('public.get_own_profile()') IS NULL OR
    to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NULL THEN
   RAISE EXCEPTION 'Apply owner-profile and MFA prerequisites first';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass) THEN
   RAISE EXCEPTION 'Profile RLS must be enabled';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND cmd IN ('UPDATE','ALL') AND permissive='PERMISSIVE' AND ('authenticated'=ANY(roles) OR 'public'=ANY(roles))) THEN
   RAISE EXCEPTION 'Existing permissive owner UPDATE policy required';
 END IF;
 IF has_column_privilege('authenticated','public.profiles','moderation_note','UPDATE') THEN
   RAISE EXCEPTION 'Reconcile unsafe existing moderation UPDATE privileges first';
 END IF;
END $$;
-- AND with all existing permissive policies, including on a drifted staging schema.
DROP POLICY IF EXISTS build9_profile_editor_owner ON public.profiles;
CREATE POLICY build9_profile_editor_owner ON public.profiles AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()) AND (SELECT hoopcheck_security.mfa_satisfied()))
WITH CHECK (id = (SELECT auth.uid()) AND (SELECT hoopcheck_security.mfa_satisfied()));
-- Existing owner UPDATE policy and server-side field-lock triggers remain required.
GRANT UPDATE (display_name,bio,hometown,nationality,favorite_teams,favorite_leagues,
 interests,experience_summary,position,height,current_country,current_team,free_agent,
 current_country_public,profile_visibility) ON public.profiles TO authenticated;
NOTIFY pgrst, 'reload schema';
