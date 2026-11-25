-- REVIEW ONLY: do not apply until genuine JWT owner/nonowner and archived-client acceptance.
-- No profile column grants are changed by this candidate.
-- BEGIN OWNER PROJECTION
CREATE FUNCTION private.read_verified_own_profile()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $profile$
DECLARE caller uuid := auth.uid(); result jsonb;
BEGIN
 IF caller IS NULL OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated'
 OR coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
 OR NOT (
   coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
   OR (coalesce(auth.jwt()->>'aal','aal1') = 'aal1'
       AND NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=caller AND f.status='verified'))
 ) THEN RAISE EXCEPTION 'Verified owner session required' USING ERRCODE='42501', HINT='mfa_required';
 END IF;
 SELECT jsonb_build_object(
    'id',p.id,
    'account_type',p.account_type,
    'display_name',p.display_name,
    'bio',p.bio,
    'username',p.username,
    'first_name',p.first_name,
    'last_name',p.last_name,
    'years_pro',p.years_pro,
    'current_country',p.current_country,
    'current_country_public',p.current_country_public,
    'position',p.position,
    'height',p.height,
    'free_agent',p.free_agent,
    'current_team',p.current_team,
    'profile_visibility',p.profile_visibility,
    'hometown',p.hometown,
    'nationality',p.nationality,
    'interests',p.interests,
    'favorite_leagues',p.favorite_leagues,
    'favorite_teams',p.favorite_teams,
    'experience_summary',p.experience_summary,
    'avatar_url',p.avatar_url,
    'avatar_moderation_status',p.avatar_moderation_status,
    'player_verified',p.player_verified,
    'player_verified_at',p.player_verified_at,
    'created_at',p.created_at,
    'updated_at',p.updated_at,
    'is_adult',p.is_adult,
    'agreed_to_terms',p.agreed_to_terms,
    'moderation_status',p.moderation_status,
    'notification_preferences',p.notification_preferences,
    'country',p.country,
    'basketball_type',p.basketball_type,
    'professional_experience',p.professional_experience,
    'coach_verified',p.coach_verified,
    'coach_profile_id',p.coach_profile_id,
    'profile_claimed',p.profile_claimed,
    'moderation_note',p.moderation_note,
    'theme_preference',p.theme_preference,
    'preferred_language',p.preferred_language
 ) INTO result FROM public.profiles p WHERE p.id=caller;
 RETURN result;
END;
$profile$;
REVOKE ALL ON FUNCTION private.read_verified_own_profile() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.read_verified_own_profile() TO authenticated;
CREATE FUNCTION public.get_own_profile()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $wrapper$
 SELECT private.read_verified_own_profile();
$wrapper$;
REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
-- END OWNER PROJECTION
