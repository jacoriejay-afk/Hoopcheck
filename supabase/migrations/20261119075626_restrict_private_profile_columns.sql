-- UNAPPLIED phase 2. Requires the owner-read API migration and compatible web /
-- native clients first. Old native versions using raw private columns will fail
-- those reads after this restriction; do not silently run during preparation.
-- No table replacement, record update, write-grant or RLS-policy change.
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
NOTIFY pgrst,'reload schema';
