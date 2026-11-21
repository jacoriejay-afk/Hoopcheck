-- Build 9 staging integration gate. Read-only: no fixture or schema mutation.
-- Run against an isolated staging database with reviewed migrations applied.
DO $$
BEGIN
 IF to_regclass('public.membership_entitlements') IS NULL THEN
  RAISE EXCEPTION 'Build 9 native bootstrap blocked: missing membership_entitlements';
 END IF;
 IF to_regprocedure('public.get_own_profile()') IS NULL THEN
  RAISE EXCEPTION 'Build 9 native profile editor blocked: missing get_own_profile()';
 END IF;
 IF to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NULL THEN
  RAISE EXCEPTION 'Build 9 MFA boundary blocked: missing mfa_satisfied()';
 END IF;
 IF NOT has_function_privilege('authenticated','public.get_own_profile()','EXECUTE') THEN
  RAISE EXCEPTION 'Authenticated users cannot invoke owner profile API';
 END IF;
 IF has_function_privilege('anon','public.get_own_profile()','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous role can invoke owner profile API';
 END IF;
 IF NOT has_column_privilege('authenticated','public.profiles','id','SELECT') THEN
  RAISE EXCEPTION 'Native profile UPDATE RETURNING id cannot read id';
 END IF;
 RAISE NOTICE 'Static integration prerequisites present; runtime owner/MFA/membership checks still required';
END $$;
