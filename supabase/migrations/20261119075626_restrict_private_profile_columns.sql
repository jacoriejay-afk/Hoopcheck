-- UNAPPLIED phase 2. Requires the owner-read API migration and compatible web /
-- native clients first. Old native versions using raw private columns will fail
-- those reads after this restriction; do not silently run during preparation.
-- No table replacement, record update, write-grant or RLS-policy change.
-- The interim Build 8 get_own_profile() is SECURITY INVOKER and reads
-- profiles.current_country directly. Revoke before the later protected
-- SECURITY DEFINER owner projection is installed => owner/editor read outage.
-- Refuse phase 2 unless the public wrapper already delegates to the protected
-- owner/MFA helper. Catalog assertions do NOT replace signed JWT rehearsals.
DO $private_boundary_preflight$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_proc wrapper
   JOIN pg_proc helper ON helper.oid = to_regprocedure('hoopcheck_security.own_profile()')
   WHERE wrapper.oid = to_regprocedure('public.get_own_profile()')
     AND NOT wrapper.prosecdef AND wrapper.provolatile = 's'
     AND helper.prosecdef AND helper.provolatile = 's'
     AND wrapper.proowner = helper.proowner
     AND position('hoopcheck_security.own_profile()' IN wrapper.prosrc) > 0
     AND position('auth.uid()' IN helper.prosrc) > 0
     AND position('hoopcheck_security.mfa_satisfied()' IN helper.prosrc) > 0
     AND has_function_privilege('authenticated',wrapper.oid,'EXECUTE')
     AND has_function_privilege('authenticated',helper.oid,'EXECUTE')
     AND NOT has_function_privilege('anon',wrapper.oid,'EXECUTE')
     AND NOT has_function_privilege('anon',helper.oid,'EXECUTE')
     AND EXISTS (SELECT 1 FROM pg_proc mfa WHERE mfa.oid = to_regprocedure('hoopcheck_security.mfa_satisfied()')
         AND mfa.prosecdef)
 ) OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.profiles'::regclass AND relrowsecurity)
 THEN
   RAISE EXCEPTION 'Private-column phase 2 requires protected owner/MFA projection; do not revoke on interim Build 8 RPC';
 END IF;
END;
$private_boundary_preflight$;
DO $$ DECLARE target text; readable text; BEGIN
 FOR target IN SELECT unnest(ARRAY['anon','authenticated']) LOOP
  SELECT string_agg(quote_ident(a.attname),',') INTO readable FROM pg_attribute a
  WHERE a.attrelid='public.profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped
   AND has_column_privilege(target,'public.profiles',a.attname,'SELECT')
   AND a.attname <> ALL(ARRAY['agreed_to_terms','terms_accepted_at','terms_version','current_country','moderation_note','moderation_updated_at','moderation_updated_by','avatar_moderation_note','display_name_changed_at','gender','last_seen_at','experience_goal','research_preferences','theme_preference','preferred_language','notification_preferences']::text[]);
  EXECUTE format('REVOKE SELECT ON public.profiles FROM %I',target);
  EXECUTE format('REVOKE SELECT (agreed_to_terms,terms_accepted_at,terms_version,current_country,moderation_note,moderation_updated_at,moderation_updated_by,avatar_moderation_note,display_name_changed_at,gender,last_seen_at,experience_goal,research_preferences,theme_preference,preferred_language,notification_preferences) ON public.profiles FROM %I',target);
  IF readable IS NOT NULL THEN EXECUTE format('GRANT SELECT (%s) ON public.profiles TO %I',readable,target); END IF;
 END LOOP;
 REVOKE SELECT ON public.profiles FROM PUBLIC;
 REVOKE SELECT (agreed_to_terms,terms_accepted_at,terms_version,current_country,moderation_note,moderation_updated_at,moderation_updated_by,avatar_moderation_note,display_name_changed_at,gender,last_seen_at,experience_goal,research_preferences,theme_preference,preferred_language,notification_preferences) ON public.profiles FROM PUBLIC;
END $$;
-- Check the sensitive column remains unavailable through direct reads,
-- while the owner API is still executable through the reviewed MFA boundary.
DO $private_boundary_postcheck$
BEGIN
 IF has_column_privilege('anon','public.profiles','current_country','SELECT')
   OR has_column_privilege('authenticated','public.profiles','current_country','SELECT')
   OR NOT has_function_privilege('authenticated','public.get_own_profile()','EXECUTE')
 THEN RAISE EXCEPTION 'Private-column phase 2 ACL postcondition failed'; END IF;
END;
$private_boundary_postcheck$;
NOTIFY pgrst,'reload schema';
